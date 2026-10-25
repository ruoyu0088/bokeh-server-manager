**English** | [简体中文](README.zh-CN.md) | [日本語](README.ja.md)

# Bokeh Server Manager

![Bokeh Server Manager](docs/screenshot.png)

A local web interface for running and managing several Bokeh and Panel server applications from one place.

Each application runs in its own Bokeh or Panel process. The manager assigns a free port on every start, embeds the running app in an iframe tab, and provides a source editor in a separate window.

## Features

- Multilingual interface: English, Simplified Chinese, and Japanese.
- Configurable manager port and bind address, with opt-in LAN access.
- Collapsible, resizable sidebar. Toggle it with `Ctrl+B` (or `Cmd+B`).
- One process per Bokeh or Panel server, with an automatically assigned port.
- Multiple running servers displayed as tabs; each tab is an iframe.
- Start, reload, stop, edit source, edit metadata, view logs, and open a server in a new window.
- Create a new Bokeh or Panel server from a blank or interactive template.
- Light / dark themes for the manager, the editor, and Bokeh/Panel pages.
- Source editor with a file tree, syntax highlighting, file creation/deletion, and `Ctrl+S` saving.
- Bokeh and Panel `--dev` live reloading. The manager refreshes the iframe when the Bokeh process restarts; Panel reloads in place.
- Per-server metadata: title, description, and usage notes.
- Three ready-to-run examples, including a Panel app.

## Languages

Use the language selector in the sidebar footer to switch the interface between English, Simplified Chinese, and Japanese.

- The default language follows the browser language (`zh*` uses Simplified Chinese, `ja*` uses Japanese, everything else uses English).
- The selection is saved in the browser and survives reloads.
- The manager and any open editor window update immediately. Open files and unsaved changes are preserved.
- Bokeh application content inside the iframe is not translated.
- `server.json` metadata is displayed as entered and is not translated.

## Requirements

- Windows with the project environment at `C:\pixi_env\.pixi\envs\default\python.exe`
- Python 3.14
- Dependencies listed in `requirements.txt`:
  - `bokeh>=3.9,<4`
  - `panel>=1.9,<2`
  - `flask>=3.1,<4`
  - `psutil>=7,<8`
  - `PyYAML>=6,<7`
  - `watchfiles>=1.3,<2` for reliable Panel `--dev` reloading

The Bokeh and Panel processes need `MKL_THREADING_LAYER=TBB` with this environment. `start.bat` sets it automatically.

## Quick start

Double-click `start.bat` for the defaults: `127.0.0.1:8010`.

The manager opens the browser automatically.

To change the port or bind address:

```bat
start.bat --port 8080
start.bat --port 8010 --host 127.0.0.1
start.bat --port 8010 --host 0.0.0.0
```

- `--port` defaults to `8010`.
- `--host` defaults to `127.0.0.1`.
- Use `--host 0.0.0.0` to allow access from other computers on the LAN.
- `start.bat --help` shows the available options.

To run it manually:

```bat
set MKL_THREADING_LAYER=TBB
set BSM_HOST=127.0.0.1
set BSM_PORT=8010
C:\pixi_env\.pixi\envs\default\python.exe -u app.py
```

When binding to `0.0.0.0`, open `http://<this-computer-ip>:8010` from another computer. The manager automatically uses the hostname or IP used by the browser for the Bokeh iframe URLs, and the child Bokeh servers bind to all interfaces as well.

Windows Firewall may need to allow Python for both the manager port and the automatically assigned Bokeh ports on private networks.

## Server directory convention

Every application lives in its own subdirectory:

```text
servers/
  my_app/
    main.py          # required application entry point (Bokeh or Panel)
    server.json      # optional title / description / usage / framework
    other files...   # data, modules, assets, etc.
```

The manager discovers directories under `servers/` automatically. A directory without `main.py` is listed but cannot be started.

For Bokeh, `main.py` is a directory application using `curdoc()`. For Panel, `main.py` is a single-file Panel script ending in `.servable()`. The framework is selected at creation time and stored in `server.json`.

For Bokeh servers, the manager generates these files on start (and ignores them in Git):

- `theme.yaml` - Bokeh model theme for the selected light/dark mode.
- `templates/index.html` - page backdrop that matches the Bokeh theme.

Panel servers use Panel's own templates and receive the theme as a URL query parameter instead. The manager does not generate Bokeh theme files for Panel.

The generated Bokeh files are rewritten on every start, so edit the manager theme or the app code instead of editing them.

## Panel apps

Panel is supported as a first-class server type. Select **Panel** in the **New** dialog, or set:

```json
{
  "framework": "panel"
}
```

A Panel app is a single `main.py` script. A standard template is recommended so the manager theme is applied:

```python
import panel as pn

pn.extension()

template = pn.template.FastListTemplate(
    title="My Panel App",
    main=[pn.pane.Markdown("## Hello from Panel")],
)
template.servable()
```

The manager starts Panel with:

```text
python -m panel serve --dev ... servers/<name>/main.py
```

- The app is served at `/main`.
- Panel reloads source changes in place; the iframe does not need a process-ID refresh.
- The current manager theme is passed as `?theme=default` (light) or `?theme=dark`. Panel's standard templates follow this parameter.
- Plain Panel scripts that do not use a standard template may not apply the page theme.
- Panel multi-page apps and notebooks are not supported yet; use one `main.py` per server.

## Metadata

Each server can have a `server.json` file:

```json
{
  "title": "My App",
  "description": "A short summary shown in the sidebar.",
  "usage": "How to use this app. Line breaks are preserved.",
  "framework": "panel"
}
```

- `title` is used in the sidebar and tab titles. It falls back to the directory name.
- `description` is shown under the server title.
- `usage` is shown in the **Server information** dialog.
- `framework` is `"bokeh"` or `"panel"`. If omitted, it defaults to `"bokeh"`.
- Metadata is not translated; it is displayed exactly as entered.
- Unknown JSON keys are preserved.
- Use the info button on a server card to edit title, description, and usage without touching JSON. The framework is shown read-only there and is selected when the server is created.
- A malformed `server.json` is reported in the UI but does not prevent the server from starting.

## Theme behavior

- The manager and editor switch between light and dark immediately.
- A Bokeh or Panel server keeps the theme it was started with. Running servers do not change theme in place.
- For Bokeh, starting or reloading writes the current manager theme into `theme.yaml` and the page template.
- For Panel, the theme is passed in the iframe URL as `?theme=default` or `?theme=dark`; standard Panel templates apply it.
- To apply a new theme to a running server, click **Reload**.
- The server card shows the theme that the running process is using.

## Live reload

Bokeh servers are started with:

```text
python -m bokeh serve --dev ...
```

Bokeh watches the application directory. After a source file is saved:

1. Bokeh restarts the server process.
2. The manager detects the new process ID on its next status poll.
3. The open iframe is refreshed so BokehJS reconnects cleanly.

This avoids stale BokehJS model references that can appear when only the websocket reconnects.

Panel servers are started with:

```text
python -m panel serve --dev ...
```

Panel's `--dev` mode reloads the application and updates the open page in place. The process ID can remain the same, so the manager does not force an extra iframe refresh. `watchfiles` is recommended and included in `requirements.txt`.

## Source editor

Click the pencil button on a server card to open the editor in a separate window.

- Left side: complete file tree for that server directory.
- Right side: CodeMirror editor with Python, HTML, CSS, JavaScript, JSON, YAML, and Markdown modes.
- Use the **+** button to create a file. Nested paths such as `lib/helpers.py` are supported; subdirectories are created automatically.
- Use the trash button to delete the currently open file. A confirmation is required.
- `Ctrl+S` saves the current file.
- Unsaved changes are marked and prompt before switching files or closing the window.
- `theme.yaml` and `templates/index.html` are marked `AUTO`; `server.json` is marked `META`.
- The editor follows the manager's light/dark theme and language.

## Creating a server

Click **New** in the sidebar.

- Directory names may contain letters, numbers, underscores, and hyphens.
- Choose **Bokeh** or **Panel** as the framework.
- Choose **Blank** for a minimal page, or **Interactive** for a widget and plot with a server-side callback.
- The generated code follows the selected framework: a Bokeh directory app or a single-file Panel script using `FastListTemplate`.
- The title defaults to the directory name and can be changed later in the **Server information** dialog.
- New servers are stopped by default unless **Start immediately** is checked.

## Examples

Three examples are included:

- **Sine Wave Lab** (`servers/sine_wave`) - animated Bokeh sine wave with waveform, frequency, amplitude, speed, and phase controls.
- **Scatter Explorer** (`servers/scatter_dashboard`) - Bokeh scatter plot with category filtering, marker sizing, a regression line, and a linked Y histogram.
- **Panel Demo** (`servers/panel_demo`) - Panel app with a `FastListTemplate`, sidebar controls, and a live Bokeh plot.

Start them from the sidebar to verify the full workflow, including theme switching, language switching, and `--dev` reloading.

## API

The manager exposes a small local JSON API:

```text
GET    /api/servers
POST   /api/servers
GET    /api/servers/<name>
POST   /api/servers/<name>/start
POST   /api/servers/<name>/stop
POST   /api/servers/<name>/reload
GET    /api/servers/<name>/logs
GET    /api/servers/<name>/tree
GET    /api/servers/<name>/file?path=...
POST   /api/servers/<name>/file
PUT    /api/servers/<name>/file
DELETE /api/servers/<name>/file?path=...
PUT    /api/servers/<name>/metadata
```

Start, stop, reload, and metadata requests take JSON bodies. `POST /api/servers` accepts `"framework": "bokeh" | "panel"`. File paths are restricted to the selected server directory. Send `X-BSM-Lang: en | zh-CN | ja` to localize manager error messages.

## Notes

- The default bind address is `127.0.0.1`. `--host 0.0.0.0` exposes the manager to the LAN.
- The manager has no authentication and can edit local files and run code. Only expose it on a trusted network.
- The manager is a local development tool, not a production deployment server.
- LAN access also requires the automatically assigned Bokeh/Panel ports to be reachable.
- `start.bat` hard-codes the Python path `C:\pixi_env\.pixi\envs\default\python.exe`. Change `PYTHON` in the file if your environment is elsewhere.
- Generated Bokeh theme files are ignored by Git. They are recreated on demand.
- Panel support currently targets single-file `main.py` scripts, not notebooks or multi-page directory apps.
