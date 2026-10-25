"""Flask entry point for the Bokeh Server Manager."""

from __future__ import annotations

import argparse
import hmac
import os
import secrets
import threading
import time
import webbrowser
from collections import deque
from datetime import timedelta
from functools import wraps
from urllib.parse import quote, urlsplit

from flask import (
    Flask,
    Response,
    g,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)

import manager
import web_auth
from i18n_backend import normalize_language, translate_error

APP_TITLE = "Bokeh Server Manager"
DEFAULT_PORT = 8010

app = Flask(__name__)
app.json.ensure_ascii = False

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
PUBLIC_ENDPOINTS = {
    "login_page",
    "login",
    "login_guest",
    "api_login",
    "static",
    "favicon",
}
LOGIN_WINDOW_SECONDS = 300
LOGIN_MAX_FAILURES = 5
SESSION_ROLES = {"editor", "viewer"}
AUTH_ERROR_TEXT = {
    "auth.invalid": "Incorrect password.",
    "auth.tooMany": "Too many failed attempts. Try again later.",
    "auth.notConfigured": "Web password is not configured.",
    "auth.csrf": "The request could not be verified. Reload the page and try again.",
}
_login_failures: dict[str, deque[float]] = {}
_login_lock = threading.Lock()


def is_web_mode() -> bool:
    return bool(app.config.get("WEB_MODE"))


def safe_next(value: str | None) -> str:
    """Return an internal redirect target, rejecting absolute URLs."""
    candidate = str(value or "").strip()
    if not candidate:
        return "/"
    parsed = urlsplit(candidate)
    if parsed.scheme or parsed.netloc:
        return "/"
    if not candidate.startswith("/") or candidate.startswith("//"):
        return "/"
    if "\\" in candidate:
        return "/"
    return candidate


def get_csrf_token() -> str:
    token = session.get("csrf")
    if not token:
        token = secrets.token_urlsafe(32)
        session["csrf"] = token
    return token


def csrf_valid() -> bool:
    expected = session.get("csrf")
    submitted = request.headers.get("X-CSRF-Token") or request.form.get("_csrf")
    if not expected or not submitted:
        return False
    return hmac.compare_digest(str(expected), str(submitted))


def csrf_failure() -> tuple[Response, int] | Response:
    if request.path.startswith("/api/"):
        return jsonify({"error": AUTH_ERROR_TEXT["auth.csrf"], "code": "auth.csrf"}), 403
    return Response(AUTH_ERROR_TEXT["auth.csrf"], status=403, mimetype="text/plain")


def request_ip() -> str:
    return request.remote_addr or "unknown"


def login_limited() -> tuple[bool, int]:
    now = time.monotonic()
    with _login_lock:
        failures = _login_failures.get(request_ip())
        if failures is None:
            return False, 0
        while failures and now - failures[0] > LOGIN_WINDOW_SECONDS:
            failures.popleft()
        if not failures:
            _login_failures.pop(request_ip(), None)
            return False, 0
        if len(failures) >= LOGIN_MAX_FAILURES:
            retry_after = max(
                1,
                int(LOGIN_WINDOW_SECONDS - (now - failures[0])) + 1,
            )
            return True, retry_after
        return False, 0


def record_login_failure() -> None:
    now = time.monotonic()
    with _login_lock:
        failures = _login_failures.setdefault(request_ip(), deque())
        while failures and now - failures[0] > LOGIN_WINDOW_SECONDS:
            failures.popleft()
        failures.append(now)


def clear_login_failures() -> None:
    with _login_lock:
        _login_failures.pop(request_ip(), None)


def current_credentials() -> dict | None:
    try:
        return web_auth.load_credentials()
    except web_auth.AuthError:
        return None


def current_role() -> str | None:
    if not is_web_mode():
        return "editor"
    credentials = current_credentials()
    if credentials is None:
        session.clear()
        return None
    session_auth_id = session.get("auth_id")
    if not session_auth_id or not hmac.compare_digest(
        str(session_auth_id), str(credentials["auth_id"])
    ):
        session.clear()
        return None
    role = session.get("role")
    if role not in SESSION_ROLES:
        session.clear()
        return None
    return role


def establish_session(role: str, credentials: dict) -> None:
    session.clear()
    session["role"] = role
    session["auth_id"] = credentials["auth_id"]
    session["csrf"] = secrets.token_urlsafe(32)
    session.permanent = True


def require_editor(view):
    """Reject read-only guest writes to files or metadata."""

    @wraps(view)
    def wrapped(*args, **kwargs):
        if is_web_mode() and getattr(g, "role", None) != "editor":
            return (
                jsonify(
                    {
                        "error": "Read-only mode: this change requires the web password.",
                        "code": "auth.readOnly",
                    }
                ),
                403,
            )
        return view(*args, **kwargs)

    return wrapped


def render_login(
    error_key: str | None = None,
    next_path: str = "/",
    status: int = 200,
):
    return (
        render_template(
            "login.html",
            app_title=APP_TITLE,
            csrf=get_csrf_token(),
            next_path=safe_next(next_path),
            error_key=error_key,
            error_text=AUTH_ERROR_TEXT.get(error_key or "", ""),
            web_mode=is_web_mode(),
            lan_warning=bool(app.config.get("LAN_WARNING")),
        ),
        status,
    )


@app.before_request
def web_auth_guard():
    if not is_web_mode():
        return None
    get_csrf_token()
    endpoint = request.endpoint or ""
    if endpoint in PUBLIC_ENDPOINTS:
        if request.method in WRITE_METHODS and not csrf_valid():
            return csrf_failure()
        return None
    role = current_role()
    if role is None:
        if request.path.startswith("/api/"):
            return (
                jsonify(
                    {
                        "error": "Authentication required.",
                        "code": "auth.required",
                    }
                ),
                401,
            )
        next_path = request.full_path.rstrip("?")
        return redirect(url_for("login", next=next_path))
    g.role = role
    if request.method in WRITE_METHODS and not csrf_valid():
        return csrf_failure()
    return None


def request_language() -> str:
    return normalize_language(request.headers.get("X-BSM-Lang"))


def localize_state(state: dict, language: str) -> dict:
    localized = dict(state)
    for key in ("error", "metadata_error"):
        value = localized.get(key)
        if value:
            localized[key] = translate_error(str(value), language)
    return localized


def request_hostname() -> str:
    host = request.host or "127.0.0.1"
    if host.startswith("["):
        hostname = host.split("]")[0] + "]"
    else:
        hostname = host.split(":", 1)[0]
    if hostname in {"0.0.0.0", "::"}:
        hostname = "127.0.0.1"
    return hostname


def rewrite_state_url(state: dict, hostname: str) -> dict:
    rewritten = dict(state)
    port = rewritten.get("port")
    if port:
        route = str(
            rewritten.get("route")
            or f"/{quote(str(rewritten['name']), safe='')}"
        )
        if not route.startswith("/"):
            route = "/" + route
        url = f"http://{hostname}:{port}{route}"
        if rewritten.get("framework") == "panel":
            theme = rewritten.get("theme")
            if theme:
                # Panel's light theme is named "default"; "light" raises KeyError.
                panel_theme = "default" if theme == "light" else "dark"
                url += f"?theme={panel_theme}"
        rewritten["url"] = url
    return rewritten


def prepare_state(state: dict, language: str) -> dict:
    return rewrite_state_url(
        localize_state(state, language),
        request_hostname(),
    )


@app.errorhandler(manager.ManagerError)
def handle_manager_error(error: manager.ManagerError) -> tuple[Response, int]:
    message = translate_error(error.message, request_language())
    return jsonify({"error": message}), error.status_code


@app.get("/login")
def login_page():
    if not is_web_mode():
        return redirect("/")
    next_path = safe_next(request.args.get("next"))
    if current_role() == "editor":
        return redirect(next_path)
    return render_login(next_path=next_path)


@app.post("/login")
def login():
    if not is_web_mode():
        return redirect("/")
    password = request.form.get("password", "")
    next_path = safe_next(request.form.get("next"))
    limited, _retry_after = login_limited()
    if limited:
        return render_login("auth.tooMany", next_path, 429)
    credentials = current_credentials()
    if credentials is None:
        return render_login("auth.notConfigured", next_path, 503)
    if not web_auth.verify_password(password, credentials):
        record_login_failure()
        return render_login("auth.invalid", next_path, 401)
    clear_login_failures()
    establish_session("editor", credentials)
    return redirect(next_path)


@app.post("/login/guest")
def login_guest():
    if not is_web_mode():
        return redirect("/")
    next_path = safe_next(request.form.get("next"))
    credentials = current_credentials()
    if credentials is None:
        return render_login("auth.notConfigured", next_path, 503)
    establish_session("viewer", credentials)
    return redirect(next_path)


@app.post("/logout")
def logout():
    session.clear()
    return redirect(url_for("login_page"))


@app.get("/api/auth/status")
def api_auth_status() -> Response:
    return jsonify(
        {
            "authenticated": True,
            "role": getattr(g, "role", "editor"),
            "web_mode": is_web_mode(),
            "csrf": get_csrf_token() if is_web_mode() else "",
        }
    )


@app.post("/api/auth/login")
def api_login() -> Response:
    if not is_web_mode():
        return jsonify({"error": "Web mode is not enabled.", "code": "auth.disabled"}), 400
    payload = request.get_json(silent=True) or {}
    password = payload.get("password", "")
    limited, retry_after = login_limited()
    if limited:
        response = jsonify(
            {
                "error": AUTH_ERROR_TEXT["auth.tooMany"],
                "code": "auth.tooMany",
            }
        )
        response.status_code = 429
        response.headers["Retry-After"] = str(retry_after)
        return response
    credentials = current_credentials()
    if credentials is None:
        return (
            jsonify(
                {
                    "error": AUTH_ERROR_TEXT["auth.notConfigured"],
                    "code": "auth.notConfigured",
                }
            ),
            503,
        )
    if not web_auth.verify_password(password, credentials):
        record_login_failure()
        return (
            jsonify(
                {
                    "error": AUTH_ERROR_TEXT["auth.invalid"],
                    "code": "auth.invalid",
                }
            ),
            401,
        )
    clear_login_failures()
    establish_session("editor", credentials)
    return jsonify(
        {
            "ok": True,
            "role": "editor",
            "csrf": session.get("csrf"),
        }
    )


@app.get("/")
def index() -> str:
    return render_template(
        "index.html",
        app_title=APP_TITLE,
        role=getattr(g, "role", "editor"),
        csrf=get_csrf_token() if is_web_mode() else "",
        web_mode=is_web_mode(),
        lan_warning=bool(app.config.get("LAN_WARNING")),
    )


@app.get("/editor")
def editor() -> str:
    return render_template(
        "editor.html",
        app_title=f"{APP_TITLE} · Editor",
        role=getattr(g, "role", "editor"),
        csrf=get_csrf_token() if is_web_mode() else "",
        web_mode=is_web_mode(),
    )


@app.get("/api/health")
def health() -> Response:
    return jsonify({"ok": True, "app": APP_TITLE})


@app.get("/api/servers")
def api_servers() -> Response:
    language = request_language()
    return jsonify(
        {
            "servers": [
                prepare_state(state, language)
                for state in manager.list_server_states()
            ],
            "themes": ["light", "dark"],
        }
    )


@app.post("/api/servers")
@require_editor
def api_create_server() -> Response:
    payload = request.get_json(silent=True) or {}
    state = manager.create_server(
        payload.get("name", ""),
        title=payload.get("title", ""),
        description=payload.get("description", ""),
        usage=payload.get("usage", ""),
        template=payload.get("template", "blank"),
        framework=payload.get("framework", "bokeh"),
    )
    return jsonify(prepare_state(state, request_language())), 201


@app.get("/api/servers/<name>")
def api_server(name: str) -> Response:
    return jsonify(prepare_state(manager.server_state(name), request_language()))


@app.post("/api/servers/<name>/start")
def api_start_server(name: str) -> Response:
    payload = request.get_json(silent=True) or {}
    theme = str(payload.get("theme", "light"))
    state = manager.start_server(name, theme)
    return jsonify(prepare_state(state, request_language()))


@app.post("/api/servers/<name>/stop")
def api_stop_server(name: str) -> Response:
    state = manager.stop_server(name)
    return jsonify(prepare_state(state, request_language()))


@app.post("/api/servers/<name>/reload")
def api_reload_server(name: str) -> Response:
    payload = request.get_json(silent=True) or {}
    theme = str(payload.get("theme", "light"))
    state = manager.reload_server(name, theme)
    return jsonify(prepare_state(state, request_language()))


@app.get("/api/servers/<name>/logs")
def api_server_logs(name: str) -> Response:
    lines = request.args.get("lines", "300")
    return jsonify({"logs": manager.logs_for_server(name, int(lines))})


@app.put("/api/servers/<name>/metadata")
@require_editor
def api_update_metadata(name: str) -> Response:
    payload = request.get_json(silent=True)
    if payload is None:
        payload = {}
    state = manager.update_metadata(name, payload)
    return jsonify(prepare_state(state, request_language()))


@app.get("/api/servers/<name>/tree")
def api_server_tree(name: str) -> Response:
    return jsonify(manager.build_file_tree(name))


@app.get("/api/servers/<name>/file")
def api_read_file(name: str) -> Response:
    relative = request.args.get("path", "")
    return jsonify(manager.read_text_file(name, relative))


@app.post("/api/servers/<name>/file")
@require_editor
def api_create_file(name: str) -> Response:
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Expected a JSON object with path and content."}), 400
    relative = payload.get("path", "")
    content = payload.get("content", "")
    return jsonify(manager.create_text_file(name, relative, content)), 201


@app.put("/api/servers/<name>/file")
@require_editor
def api_write_file(name: str) -> Response:
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Expected a JSON object with path and content."}), 400
    relative = payload.get("path", "")
    content = payload.get("content", "")
    return jsonify(manager.write_text_file(name, relative, content))


@app.delete("/api/servers/<name>/file")
@require_editor
def api_delete_file(name: str) -> Response:
    relative = request.args.get("path", "")
    return jsonify(manager.delete_text_file(name, relative))


@app.after_request
def add_api_cache_headers(response: Response) -> Response:
    if response.content_type.startswith("application/json"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/favicon.ico")
def favicon() -> Response:
    return Response(status=204)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=APP_TITLE)
    parser.add_argument(
        "--web",
        action="store_true",
        help="enable single-password web authentication",
    )
    args = parser.parse_args(argv)

    manager.ensure_directories()
    try:
        port = int(os.environ.get("BSM_PORT", str(DEFAULT_PORT)))
    except ValueError:
        print(f"Invalid BSM_PORT: {os.environ.get('BSM_PORT')!r}")
        raise SystemExit(1)
    host = os.environ.get("BSM_HOST", "127.0.0.1").strip() or "127.0.0.1"
    manager.set_bind_host(host)
    lan_warning = host not in {"127.0.0.1", "localhost", "::1"}

    if args.web:
        try:
            credentials = web_auth.load_credentials()
        except web_auth.AuthError as exc:
            print("Web mode cannot start: the password file is invalid.")
            print(f"  {exc}")
            print("Run: start.bat --web --set-password")
            raise SystemExit(1)
        if credentials is None:
            print("Web mode is not configured.")
            print("Run: start.bat --web --set-password")
            raise SystemExit(1)
        app.config.update(
            SECRET_KEY=credentials["session_secret"],
            WEB_MODE=True,
            LAN_WARNING=lan_warning,
            SESSION_COOKIE_NAME="bsm_session",
            SESSION_COOKIE_HTTPONLY=True,
            SESSION_COOKIE_SAMESITE="Lax",
            # The first web version deliberately uses plain HTTP.
            SESSION_COOKIE_SECURE=False,
            PERMANENT_SESSION_LIFETIME=timedelta(hours=12),
        )

    browser_host = "127.0.0.1" if host in {"0.0.0.0", "::"} else host
    url = f"http://{browser_host}:{port}"
    print(f"{APP_TITLE} running at {url}")
    if args.web:
        print("Web authentication is enabled.")
    if lan_warning:
        if args.web:
            print("WARNING: the web service is exposed to the LAN over plain HTTP.")
            print("         Traffic is not encrypted. Use only a trusted network.")
            print("         Login protects the manager UI/API, not child app ports.")
        else:
            print("WARNING: the manager is exposed beyond localhost.")
            print("         It has no authentication and can edit local files.")
        print(f"         LAN clients can use http://<this-computer-ip>:{port}")
    if os.environ.get("BSM_OPEN_BROWSER") == "1":
        threading.Timer(1.2, lambda: webbrowser.open(url)).start()
    app.run(host=host, port=port, debug=False, use_reloader=False, threaded=True)


if __name__ == "__main__":
    main()
