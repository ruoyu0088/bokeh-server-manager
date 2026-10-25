"""Server discovery and file-system helpers for the Bokeh server manager.

The Flask layer in :mod:`app` is intentionally thin.  This module owns the
on-disk conventions:

* every application lives in ``servers/<name>/``;
* an application is a Bokeh *directory application* with a ``main.py`` entry;
* generated files (``theme.yaml``) live next to the application code.
"""

from __future__ import annotations

import os
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parent
SERVERS_DIR = ROOT / "servers"
RUNTIME_DIR = ROOT / ".runtime"
LOGS_DIR = RUNTIME_DIR / "logs"
THEMES_DIR = ROOT / "themes"

SERVER_FILE = "main.py"
THEME_FILE = "theme.yaml"

MAX_EDIT_BYTES = 2 * 1024 * 1024
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

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "valid": self.valid,
            "error": self.error,
            "entry": self.entry.name if self.entry else None,
            "file_count": self.file_count,
        }


def ensure_directories() -> None:
    for path in (SERVERS_DIR, RUNTIME_DIR, LOGS_DIR, THEMES_DIR):
        path.mkdir(parents=True, exist_ok=True)


def validate_server_name(name: str) -> str:
    if not isinstance(name, str) or not SERVER_NAME_RE.fullmatch(name):
        raise ManagerError(
            "服务器名称只能包含字母、数字、下划线或连字符，且必须以字母或数字开头。"
        )
    if name.lower() in RESERVED_NAMES:
        raise ManagerError(f"“{name}”是保留名称，请换一个。")
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
        raise ManagerError("无效的服务器名称。", 400)
    base = SERVERS_DIR.resolve()
    candidate = (base / name).resolve()
    if candidate.parent != base:
        raise ManagerError("服务器目录不在 servers 目录内。", 400)
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


def get_server(name: str) -> ServerInfo:
    path = server_path(name)
    if not path.is_dir():
        raise ManagerError(f"服务器“{name}”不存在。", 404)
    entry = path / SERVER_FILE
    valid = entry.is_file()
    error = None if valid else "缺少 Bokeh 目录应用入口 main.py。"
    return ServerInfo(
        name=name,
        path=path,
        entry=entry if valid else None,
        valid=valid,
        error=error,
        file_count=_count_files(path),
    )


def list_servers() -> list[ServerInfo]:
    servers: list[ServerInfo] = []
    for path in _iter_servers():
        entry = path / SERVER_FILE
        valid = entry.is_file()
        servers.append(
            ServerInfo(
                name=path.name,
                path=path,
                entry=entry if valid else None,
                valid=valid,
                error=None if valid else "缺少 Bokeh 目录应用入口 main.py。",
                file_count=_count_files(path),
            )
        )
    return servers


def _safe_relative_path(server: ServerInfo, relative: str) -> Path:
    if not isinstance(relative, str):
        raise ManagerError("文件路径无效。", 400)
    if "\x00" in relative:
        raise ManagerError("文件路径无效。", 400)
    relative = relative.replace("\\", "/").strip("/")
    if not relative or relative in {".", ".."}:
        raise ManagerError("文件路径无效。", 400)
    target = (server.path / relative).resolve()
    if target != server.path and server.path not in target.parents:
        raise ManagerError("文件路径越界。", 403)
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
            raise ManagerError(f"无法读取目录：{exc}") from exc

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
        raise ManagerError("文件不存在。", 404)
    stat = path.stat()
    if stat.st_size > MAX_EDIT_BYTES:
        raise ManagerError("文件过大，编辑器最多支持 2 MB。", 413)
    try:
        raw = path.read_bytes()
    except OSError as exc:
        raise ManagerError(f"无法读取文件：{exc}") from exc
    if b"\x00" in raw:
        raise ManagerError("这是二进制文件，无法用文本编辑器打开。", 415)
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
    }


def write_text_file(name: str, relative: str, content: str) -> dict[str, Any]:
    server = get_server(name)
    path = _safe_relative_path(server, relative)
    if not isinstance(content, str):
        raise ManagerError("文件内容必须是文本。", 400)
    encoded = content.encode("utf-8")
    if len(encoded) > MAX_EDIT_BYTES:
        raise ManagerError("文件过大，编辑器最多支持 2 MB。", 413)
    if path.exists() and not path.is_file():
        raise ManagerError("目标不是普通文件。", 400)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = path.with_name(f".{path.name}.tmp-{os.getpid()}")
        with temp_path.open("w", encoding="utf-8", newline="") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, path)
    except OSError as exc:
        raise ManagerError(f"无法保存文件：{exc}") from exc
    stat = path.stat()
    return {
        "path": path.relative_to(server.path).as_posix(),
        "size": stat.st_size,
        "mtime": stat.st_mtime,
    }


def copy_theme(theme: str, destination: Path) -> None:
    """Copy a prepared Bokeh theme YAML into an application directory."""
    if theme not in {"light", "dark"}:
        raise ManagerError("未知的主题。", 400)
    source = THEMES_DIR / f"{theme}.yaml"
    if not source.is_file():
        raise ManagerError(f"缺少主题文件 {source.name}。", 500)
    shutil.copyfile(source, destination)


def delete_application(name: str) -> None:
    """Reserved for a later release; currently disabled intentionally."""
    raise ManagerError("暂不支持删除服务器目录，请在文件系统中手动删除。", 400)
