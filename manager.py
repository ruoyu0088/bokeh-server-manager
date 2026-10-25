"""Server discovery and file-system helpers for the Bokeh server manager.

The Flask layer in :mod:`app` is intentionally thin.  This module owns the
on-disk conventions:

* every application lives in ``servers/<name>/``;
* an application is a Bokeh *directory application* with a ``main.py`` entry;
* generated files (``theme.yaml``) live next to the application code.
"""

from __future__ import annotations

import atexit
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, TextIO

import psutil

ROOT = Path(__file__).resolve().parent
SERVERS_DIR = ROOT / "servers"
RUNTIME_DIR = ROOT / ".runtime"
LOGS_DIR = RUNTIME_DIR / "logs"
THEMES_DIR = ROOT / "themes"

SERVER_FILE = "main.py"
THEME_FILE = "theme.yaml"
METADATA_FILE = "server.json"

MAX_EDIT_BYTES = 2 * 1024 * 1024
MAX_METADATA_BYTES = 64 * 1024
METADATA_FIELDS = ("title", "description", "usage")
HOST = "127.0.0.1"
START_TIMEOUT = 20.0
STOP_TIMEOUT = 5.0
HEALTH_GRACE = 8.0
SKIP_NAMES = {
    ".git",
    ".hg",
    ".svn",
    ".runtime",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
}
SKIP_SUFFIXES = {".pyc", ".pyo"}

SERVER_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
RESERVED_NAMES = {"servers", "static", "templates", "themes", "api", "editor"}


class ManagerError(Exception):
    """An expected error that can be returned to the browser."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class ServerInfo:
    name: str
    path: Path
    entry: Path | None
    valid: bool
    error: str | None
    file_count: int
    title: str = ""
    description: str = ""
    usage: str = ""
    metadata_error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "valid": self.valid,
            "error": self.error,
            "entry": self.entry.name if self.entry else None,
            "file_count": self.file_count,
            "title": self.title,
            "description": self.description,
            "usage": self.usage,
            "metadata_error": self.metadata_error,
        }


@dataclass
class Runtime:
    name: str
    path: Path
    port: int
    theme: str
    log_path: Path
    process: subprocess.Popen[Any] | None = None
    log_handle: TextIO | None = None
    status: str = "starting"
    error: str | None = None
    started_at: float | None = None
    last_pid: int | None = None
    last_seen_at: float | None = None

    @property
    def url(self) -> str:
        return f"http://{HOST}:{self.port}/{urllib.parse.quote(self.name)}"

    def to_dict(self) -> dict[str, Any]:
        uptime = None
        if self.status == "running" and self.started_at is not None:
            uptime = max(0.0, time.time() - self.started_at)
        return {
            "name": self.name,
            "status": self.status,
            "port": self.port,
            "url": self.url,
            "theme": self.theme,
            "pid": self.last_pid,
            "started_at": self.started_at,
            "uptime": uptime,
            "error": self.error,
        }


_runtimes: dict[str, Runtime] = {}
_runtime_lock = threading.RLock()


def ensure_directories() -> None:
    for path in (SERVERS_DIR, RUNTIME_DIR, LOGS_DIR, THEMES_DIR):
        path.mkdir(parents=True, exist_ok=True)


def validate_server_name(name: str) -> str:
    if not isinstance(name, str) or not SERVER_NAME_RE.fullmatch(name):
        raise ManagerError(
            "Server names may contain only letters, numbers, underscores, or hyphens, and must start with a letter or number."
        )
    if name.lower() in RESERVED_NAMES:
        raise ManagerError(f'"{name}" is a reserved name. Choose another one.')
    return name


def server_path(name: str) -> Path:
    """Return a resolved server directory and reject traversal attempts."""
    if (
        not name
        or name in {".", ".."}
        or "/" in name
        or "\\" in name
        or "\x00" in name
    ):
        raise ManagerError("Invalid server name.", 400)
    base = SERVERS_DIR.resolve()
    candidate = (base / name).resolve()
    if candidate.parent != base:
        raise ManagerError("The server directory is outside the servers directory.", 400)
    return candidate


def _iter_servers() -> Iterable[Path]:
    ensure_directories()
    for child in sorted(SERVERS_DIR.iterdir(), key=lambda p: p.name.lower()):
        if not child.is_dir():
            continue
        if child.name.startswith(".") or child.name.startswith("_"):
            continue
        if child.name in SKIP_NAMES:
            continue
        yield child


def _count_files(root: Path) -> int:
    count = 0
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_NAMES and not d.startswith(".")]
        for filename in filenames:
            path = Path(dirpath) / filename
            if path.suffix.lower() in SKIP_SUFFIXES:
                continue
            count += 1
    return count


def _load_metadata(path: Path) -> tuple[dict[str, Any], str | None]:
    metadata_path = path / METADATA_FILE
    if not metadata_path.exists():
        return {}, None
    if not metadata_path.is_file():
        return {}, "server.json is not a regular file."
    try:
        stat = metadata_path.stat()
        if stat.st_size > MAX_METADATA_BYTES:
            return {}, "server.json is too large (limit: 64 KB)."
        raw = metadata_path.read_bytes()
    except OSError as exc:
        return {}, f"Could not read server.json: {exc}"
    if b"\x00" in raw:
        return {}, "server.json contains binary data."
    try:
        data = json.loads(raw.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        return {}, f"server.json is not valid JSON: {exc}"
    if not isinstance(data, dict):
        return {}, "server.json must contain a JSON object."
    for field in METADATA_FIELDS:
        value = data.get(field)
        if value is not None and not isinstance(value, str):
            return {}, f'server.json field "{field}" must be a string.'
    return data, None


def _metadata_values(metadata: dict[str, Any]) -> dict[str, str]:
    values: dict[str, str] = {}
    for field in METADATA_FIELDS:
        value = metadata.get(field)
        values[field] = value.strip() if isinstance(value, str) else ""
    return values


def get_server(name: str) -> ServerInfo:
    path = server_path(name)
    if not path.is_dir():
        raise ManagerError(f'Server "{name}" does not exist.', 404)
    entry = path / SERVER_FILE
    valid = entry.is_file()
    error = None if valid else "Missing main.py, the entry point for a Bokeh directory application."
    metadata, metadata_error = _load_metadata(path)
    values = _metadata_values(metadata)
    return ServerInfo(
        name=name,
        path=path,
        entry=entry if valid else None,
        valid=valid,
        error=error,
        file_count=_count_files(path),
        title=values["title"],
        description=values["description"],
        usage=values["usage"],
        metadata_error=metadata_error,
    )


def list_servers() -> list[ServerInfo]:
    servers: list[ServerInfo] = []
    for path in _iter_servers():
        entry = path / SERVER_FILE
        valid = entry.is_file()
        metadata, metadata_error = _load_metadata(path)
        values = _metadata_values(metadata)
        servers.append(
            ServerInfo(
                name=path.name,
                path=path,
                entry=entry if valid else None,
                valid=valid,
                error=None if valid else "Missing main.py, the entry point for a Bokeh directory application.",
                file_count=_count_files(path),
                title=values["title"],
                description=values["description"],
                usage=values["usage"],
                metadata_error=metadata_error,
            )
        )
    return servers


def _safe_relative_path(server: ServerInfo, relative: str) -> Path:
    if not isinstance(relative, str):
        raise ManagerError("Invalid file path.", 400)
    if "\x00" in relative:
        raise ManagerError("Invalid file path.", 400)
    relative = relative.replace("\\", "/").strip("/")
    if not relative or relative in {".", ".."}:
        raise ManagerError("Invalid file path.", 400)
    target = (server.path / relative).resolve()
    if target != server.path and server.path not in target.parents:
        raise ManagerError("File path escapes the server directory.", 403)
    return target


def build_file_tree(name: str) -> dict[str, Any]:
    """Return a sorted nested tree of the files in one server directory."""
    server = get_server(name)

    def walk(directory: Path, relative: Path) -> list[dict[str, Any]]:
        entries: list[dict[str, Any]] = []
        try:
            children = sorted(
                directory.iterdir(),
                key=lambda p: (not p.is_dir(), p.name.lower()),
            )
        except OSError as exc:
            raise ManagerError(f"Could not read directory: {exc}") from exc

        for child in children:
            if child.name in SKIP_NAMES or child.name.startswith("."):
                continue
            if child.is_symlink():
                continue
            child_relative = relative / child.name if relative.parts else Path(child.name)
            try:
                stat = child.stat()
            except OSError:
                continue
            if child.is_dir():
                entries.append(
                    {
                        "type": "directory",
                        "name": child.name,
                        "path": child_relative.as_posix(),
                        "children": walk(child, child_relative),
                    }
                )
            elif child.is_file():
                if child.suffix.lower() in SKIP_SUFFIXES:
                    continue
                entries.append(
                    {
                        "type": "file",
                        "name": child.name,
                        "path": child_relative.as_posix(),
                        "size": stat.st_size,
                        "mtime": stat.st_mtime,
                        "managed": child.name == THEME_FILE,
                        "metadata": child.name == METADATA_FILE,
                    }
                )
        return entries

    return {
        "server": server.name,
        "tree": walk(server.path, Path()),
    }


def read_text_file(name: str, relative: str) -> dict[str, Any]:
    server = get_server(name)
    path = _safe_relative_path(server, relative)
    if not path.is_file():
        raise ManagerError("File not found.", 404)
    stat = path.stat()
    if stat.st_size > MAX_EDIT_BYTES:
        raise ManagerError("File is too large. The editor supports files up to 2 MB.", 413)
    try:
        raw = path.read_bytes()
    except OSError as exc:
        raise ManagerError(f"Could not read file: {exc}") from exc
    if b"\x00" in raw:
        raise ManagerError("This is a binary file and cannot be opened in the text editor.", 415)
    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError:
        content = raw.decode("utf-8-sig", errors="replace")
    return {
        "path": path.relative_to(server.path).as_posix(),
        "content": content,
        "size": stat.st_size,
        "mtime": stat.st_mtime,
        "managed": path.name == THEME_FILE,
        "metadata": path.name == METADATA_FILE,
    }


def write_text_file(name: str, relative: str, content: str) -> dict[str, Any]:
    server = get_server(name)
    path = _safe_relative_path(server, relative)
    if not isinstance(content, str):
        raise ManagerError("File contents must be text.", 400)
    encoded = content.encode("utf-8")
    if len(encoded) > MAX_EDIT_BYTES:
        raise ManagerError("File is too large. The editor supports files up to 2 MB.", 413)
    if path.exists() and not path.is_file():
        raise ManagerError("The target is not a regular file.", 400)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = path.with_name(f".{path.name}.tmp-{os.getpid()}")
        with temp_path.open("w", encoding="utf-8", newline="") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, path)
    except OSError as exc:
        raise ManagerError(f"Could not save file: {exc}") from exc
    stat = path.stat()
    return {
        "path": path.relative_to(server.path).as_posix(),
        "size": stat.st_size,
        "mtime": stat.st_mtime,
    }


def update_metadata(name: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Update title/description/usage in server.json and return the server state."""
    if not isinstance(payload, dict):
        raise ManagerError("Metadata must be a JSON object.", 400)
    server = get_server(name)
    metadata, _metadata_error = _load_metadata(server.path)
    for field in METADATA_FIELDS:
        if field not in payload:
            continue
        value = payload[field]
        if value is None:
            value = ""
        if not isinstance(value, str):
            raise ManagerError(f'Metadata field "{field}" must be a string.', 400)
        value = value.strip()
        if value:
            metadata[field] = value
        else:
            metadata.pop(field, None)

    encoded = (json.dumps(metadata, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    if len(encoded) > MAX_METADATA_BYTES:
        raise ManagerError("server.json is too large (limit: 64 KB).", 413)
    target = server.path / METADATA_FILE
    temp_path = server.path / f".{METADATA_FILE}.tmp-{os.getpid()}"
    try:
        with temp_path.open("wb") as handle:
            handle.write(encoded)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, target)
    except OSError as exc:
        try:
            temp_path.unlink(missing_ok=True)
        except OSError:
            pass
        raise ManagerError(f"Could not save server.json: {exc}", 500) from exc
    return server_state(name)


def _listener_pid(port: int) -> int | None:
    try:
        connections = psutil.net_connections(kind="inet")
    except (psutil.Error, OSError):
        return None
    for connection in connections:
        if (
            connection.status == psutil.CONN_LISTEN
            and connection.laddr
            and connection.laddr.port == port
            and connection.pid
        ):
            return connection.pid
    return None


def _http_ready(port: int, name: str) -> bool:
    url = f"http://{HOST}:{port}/{urllib.parse.quote(name)}"
    try:
        with urllib.request.urlopen(url, timeout=1.0) as response:
            return 200 <= response.status < 400
    except Exception:
        return False


def _allocate_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind((HOST, 0))
        return int(sock.getsockname()[1])


def _tail_log(path: Path, lines: int = 80) -> str:
    try:
        with path.open("r", encoding="utf-8", errors="replace") as handle:
            return "".join(deque(handle, maxlen=lines))
    except FileNotFoundError:
        return ""
    except OSError:
        return ""


def _log_filename(name: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9_.-]+", "_", name).strip("._")
    return f"{safe or 'server'}.log"


def _server_pids(runtime: Runtime) -> set[int]:
    pids: set[int] = set()
    listener = _listener_pid(runtime.port)
    if listener:
        pids.add(listener)
    if runtime.process is not None and runtime.process.poll() is None:
        pids.add(runtime.process.pid)

    marker = os.path.normcase(str(runtime.path))
    try:
        processes = psutil.process_iter(["pid", "cmdline"])
    except psutil.Error:
        return pids
    for process in processes:
        try:
            command = process.info.get("cmdline") or []
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
        if not any("bokeh" in str(part).lower() for part in command):
            continue
        if any(os.path.normcase(str(part)) == marker for part in command):
            pids.add(process.info["pid"])
    return pids


def _terminate_pids(pids: set[int]) -> None:
    parents: list[psutil.Process] = []
    for pid in pids:
        try:
            process = psutil.Process(pid)
        except psutil.NoSuchProcess:
            continue
        try:
            parents.extend(process.children(recursive=True))
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
        parents.append(process)

    unique: dict[int, psutil.Process] = {}
    for process in parents:
        unique[process.pid] = process
    for process in unique.values():
        try:
            process.terminate()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    _, alive = psutil.wait_procs(list(unique.values()), timeout=3.0)
    for process in alive:
        try:
            process.kill()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    if alive:
        psutil.wait_procs(alive, timeout=2.0)


def _stop_runtime_locked(runtime: Runtime) -> None:
    runtime.status = "stopping"
    runtime.error = None
    _terminate_pids(_server_pids(runtime))
    runtime.status = "stopped"
    runtime.last_pid = None
    runtime.started_at = None
    if runtime.log_handle is not None:
        try:
            runtime.log_handle.close()
        except OSError:
            pass
        runtime.log_handle = None


def _validate_theme(theme: str) -> str:
    if theme not in {"light", "dark"}:
        raise ManagerError("Theme must be either light or dark.", 400)
    return theme


def start_server(name: str, theme: str = "light") -> dict[str, Any]:
    """Start one Bokeh server in its own process and wait until it responds."""
    _validate_theme(theme)
    with _runtime_lock:
        server = get_server(name)
        if not server.valid:
            raise ManagerError(server.error or "Server is not available.", 400)

        existing = _runtimes.get(name)
        if existing is not None:
            if _listener_pid(existing.port) is not None:
                return existing.to_dict()
            _stop_runtime_locked(existing)

        ensure_directories()
        try:
            copy_theme(theme, server.path / THEME_FILE)
        except OSError as exc:
            raise ManagerError(f"Could not write theme.yaml: {exc}", 500) from exc
        port = _allocate_port()
        log_path = LOGS_DIR / _log_filename(name)
        log_handle = log_path.open("a", encoding="utf-8", buffering=1)
        log_handle.write(
            f"\n===== manager start {time.strftime('%Y-%m-%d %H:%M:%S')} "
            f"({HOST}:{port}, theme={theme}) =====\n"
        )
        log_handle.flush()

        runtime = Runtime(
            name=name,
            path=server.path,
            port=port,
            theme=theme,
            log_path=log_path,
            log_handle=log_handle,
            status="starting",
            started_at=time.time(),
        )
        _runtimes[name] = runtime

        command = [
            sys.executable,
            "-m",
            "bokeh",
            "serve",
            "--port",
            str(port),
            "--address",
            HOST,
            "--log-level",
            "info",
            "--dev",
            "--allow-websocket-origin",
            f"{HOST}:{port}",
            str(server.path),
        ]
        creationflags = 0
        if os.name == "nt":
            creationflags = (
                subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW
            )
        environment = os.environ.copy()
        environment.setdefault("PYTHONUNBUFFERED", "1")
        try:
            runtime.process = subprocess.Popen(
                command,
                cwd=str(server.path),
                stdout=log_handle,
                stderr=subprocess.STDOUT,
                stdin=subprocess.DEVNULL,
                env=environment,
                creationflags=creationflags,
            )
        except OSError as exc:
            _stop_runtime_locked(runtime)
            runtime.status = "error"
            runtime.error = f"Could not start the Bokeh process: {exc}"
            raise ManagerError(runtime.error, 500) from exc

        deadline = time.monotonic() + START_TIMEOUT
        exited_at: float | None = None
        while time.monotonic() < deadline:
            listener = _listener_pid(port)
            if listener is not None:
                runtime.last_pid = listener
                runtime.last_seen_at = time.time()
                if _http_ready(port, name):
                    runtime.status = "running"
                    runtime.error = None
                    runtime.started_at = time.time()
                    return runtime.to_dict()
            if runtime.process.poll() is not None and listener is None:
                if exited_at is None:
                    exited_at = time.monotonic()
                elif time.monotonic() - exited_at > 1.0:
                    break
            time.sleep(0.15)

        log_tail = _tail_log(log_path)
        exit_code = runtime.process.poll()
        _stop_runtime_locked(runtime)
        runtime.status = "error"
        if exit_code is not None:
            runtime.error = f"Bokeh process failed to start (exit code {exit_code})."
        else:
            runtime.error = "Bokeh server startup timed out."
        message = runtime.error
        if log_tail.strip():
            message = f"{message}\n\n{log_tail[-4000:]}"
        raise ManagerError(message, 500)


def stop_server(name: str) -> dict[str, Any]:
    with _runtime_lock:
        runtime = _runtimes.get(name)
        if runtime is None:
            return {
                "name": name,
                "status": "stopped",
                "port": None,
                "url": None,
                "theme": None,
                "pid": None,
                "started_at": None,
                "uptime": None,
                "error": None,
            }
        _stop_runtime_locked(runtime)
        return runtime.to_dict()


def reload_server(name: str, theme: str = "light") -> dict[str, Any]:
    _validate_theme(theme)
    with _runtime_lock:
        runtime = _runtimes.get(name)
        if runtime is not None:
            _stop_runtime_locked(runtime)
    return start_server(name, theme)


def _refresh_runtime_locked(runtime: Runtime) -> None:
    now = time.time()
    listener = _listener_pid(runtime.port)
    if listener is not None:
        runtime.last_pid = listener
        runtime.last_seen_at = now
        if runtime.status != "running":
            runtime.status = "running"
            runtime.error = None
            if runtime.started_at is None:
                runtime.started_at = now
        return

    if runtime.status == "stopped":
        return
    if runtime.last_seen_at is not None and now - runtime.last_seen_at < HEALTH_GRACE:
        runtime.status = "starting"
        return
    if runtime.status == "starting" and runtime.started_at is not None:
        if now - runtime.started_at < START_TIMEOUT:
            return
    runtime.status = "error"
    if not runtime.error:
        runtime.error = "The Bokeh process exited. Check the logs."


def list_server_states() -> list[dict[str, Any]]:
    with _runtime_lock:
        states: list[dict[str, Any]] = []
        for info in list_servers():
            data = info.to_dict()
            runtime = _runtimes.get(info.name)
            if runtime is None:
                data.update(
                    {
                        "status": "stopped",
                        "port": None,
                        "url": None,
                        "theme": None,
                        "pid": None,
                        "started_at": None,
                        "uptime": None,
                    }
                )
            else:
                _refresh_runtime_locked(runtime)
                data.update(runtime.to_dict())
            states.append(data)
        return states


def server_state(name: str) -> dict[str, Any]:
    for state in list_server_states():
        if state["name"] == name:
            return state
    raise ManagerError(f'Server "{name}" does not exist.', 404)


def logs_for_server(name: str, lines: int = 300) -> str:
    server = get_server(name)
    lines = max(10, min(int(lines), 1000))
    return _tail_log(LOGS_DIR / _log_filename(server.name), lines)


def stop_all() -> None:
    with _runtime_lock:
        for runtime in list(_runtimes.values()):
            try:
                _stop_runtime_locked(runtime)
            except Exception:
                pass


atexit.register(stop_all)


def copy_theme(theme: str, destination: Path) -> None:
    """Copy a prepared Bokeh theme YAML into an application directory."""
    if theme not in {"light", "dark"}:
        raise ManagerError("Unknown theme.", 400)
    source = THEMES_DIR / f"{theme}.yaml"
    if not source.is_file():
        raise ManagerError(f"Missing theme file: {source.name}", 500)
    shutil.copyfile(source, destination)

