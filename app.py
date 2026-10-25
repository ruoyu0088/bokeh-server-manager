"""Flask entry point for the Bokeh Server Manager."""

from __future__ import annotations

import os
from pathlib import Path

from flask import Flask, Response, jsonify, render_template, request

import manager

APP_TITLE = "Bokeh Server Manager"
DEFAULT_PORT = 8010

app = Flask(__name__)
app.json.ensure_ascii = False


@app.errorhandler(manager.ManagerError)
def handle_manager_error(error: manager.ManagerError) -> tuple[Response, int]:
    return jsonify({"error": error.message}), error.status_code


@app.get("/")
def index() -> str:
    return render_template("index.html", app_title=APP_TITLE)


@app.get("/api/health")
def health() -> Response:
    return jsonify({"ok": True, "app": APP_TITLE})


@app.get("/api/servers")
def api_servers() -> Response:
    return jsonify(
        {
            "servers": manager.list_server_states(),
            "themes": ["light", "dark"],
        }
    )


@app.get("/api/servers/<name>")
def api_server(name: str) -> Response:
    return jsonify(manager.server_state(name))


@app.post("/api/servers/<name>/start")
def api_start_server(name: str) -> Response:
    payload = request.get_json(silent=True) or {}
    theme = str(payload.get("theme", "light"))
    return jsonify(manager.start_server(name, theme))


@app.post("/api/servers/<name>/stop")
def api_stop_server(name: str) -> Response:
    return jsonify(manager.stop_server(name))


@app.post("/api/servers/<name>/reload")
def api_reload_server(name: str) -> Response:
    payload = request.get_json(silent=True) or {}
    theme = str(payload.get("theme", "light"))
    return jsonify(manager.reload_server(name, theme))


@app.get("/api/servers/<name>/logs")
def api_server_logs(name: str) -> Response:
    lines = request.args.get("lines", "300")
    return jsonify({"logs": manager.logs_for_server(name, int(lines))})


@app.put("/api/servers/<name>/metadata")
def api_update_metadata(name: str) -> Response:
    payload = request.get_json(silent=True)
    if payload is None:
        payload = {}
    return jsonify(manager.update_metadata(name, payload))


@app.get("/favicon.ico")
def favicon() -> Response:
    return Response(status=204)


def main() -> None:
    manager.ensure_directories()
    port = int(os.environ.get("BSM_PORT", str(DEFAULT_PORT)))
    host = "127.0.0.1"
    url = f"http://{host}:{port}"
    print(f"{APP_TITLE} running at {url}")
    app.run(host=host, port=port, debug=False, use_reloader=False, threaded=True)


if __name__ == "__main__":
    main()
