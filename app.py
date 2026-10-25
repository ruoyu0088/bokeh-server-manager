"""Flask entry point for the Bokeh Server Manager."""

from __future__ import annotations

import os
import threading
import webbrowser
from urllib.parse import quote

from flask import Flask, Response, jsonify, render_template, request

import manager
from i18n_backend import normalize_language, translate_error

APP_TITLE = "Bokeh Server Manager"
DEFAULT_PORT = 8010

app = Flask(__name__)
app.json.ensure_ascii = False


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
        rewritten["url"] = (
            f"http://{hostname}:{port}/{quote(str(rewritten['name']), safe='')}"
        )
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


@app.get("/")
def index() -> str:
    return render_template("index.html", app_title=APP_TITLE)


@app.get("/editor")
def editor() -> str:
    return render_template("editor.html", app_title=f"{APP_TITLE} · Editor")


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
def api_create_server() -> Response:
    payload = request.get_json(silent=True) or {}
    state = manager.create_server(
        payload.get("name", ""),
        title=payload.get("title", ""),
        description=payload.get("description", ""),
        usage=payload.get("usage", ""),
        template=payload.get("template", "blank"),
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
def api_create_file(name: str) -> Response:
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Expected a JSON object with path and content."}), 400
    relative = payload.get("path", "")
    content = payload.get("content", "")
    return jsonify(manager.create_text_file(name, relative, content)), 201


@app.put("/api/servers/<name>/file")
def api_write_file(name: str) -> Response:
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Expected a JSON object with path and content."}), 400
    relative = payload.get("path", "")
    content = payload.get("content", "")
    return jsonify(manager.write_text_file(name, relative, content))


@app.delete("/api/servers/<name>/file")
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


def main() -> None:
    manager.ensure_directories()
    try:
        port = int(os.environ.get("BSM_PORT", str(DEFAULT_PORT)))
    except ValueError:
        print(f"Invalid BSM_PORT: {os.environ.get('BSM_PORT')!r}")
        raise SystemExit(1)
    host = os.environ.get("BSM_HOST", "127.0.0.1").strip() or "127.0.0.1"
    manager.set_bind_host(host)

    browser_host = "127.0.0.1" if host in {"0.0.0.0", "::"} else host
    url = f"http://{browser_host}:{port}"
    print(f"{APP_TITLE} running at {url}")
    if host not in {"127.0.0.1", "localhost", "::1"}:
        print("WARNING: the manager is exposed beyond localhost.")
        print("         It has no authentication and can edit local files.")
        print(f"         LAN clients can use http://<this-computer-ip>:{port}")
    if os.environ.get("BSM_OPEN_BROWSER") == "1":
        threading.Timer(1.2, lambda: webbrowser.open(url)).start()
    app.run(host=host, port=port, debug=False, use_reloader=False, threaded=True)


if __name__ == "__main__":
    main()
