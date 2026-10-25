[English](README.md) | **简体中文** | [日本語](README.ja.md)

# Bokeh 服务器管理器

![Bokeh 服务器管理器](docs/screenshot.png)

一个用于集中运行和管理多个 Bokeh Server 应用的本地 Web 界面。

每个应用都在独立的 Bokeh 进程中运行。管理器在每次启动时自动分配空闲端口，将运行中的应用嵌入 iframe 标签页，并在独立窗口中提供源码编辑器。

## 功能

- 多语言界面：英文、简体中文、日文。
- 可配置管理器端口和绑定地址，按需开启局域网访问。
- 可折叠、可调宽度的左侧栏，使用 `Ctrl+B`（或 `Cmd+B`）开关。
- 每个 Bokeh Server 独立进程，自动分配端口。
- 多个运行中的服务以标签页展示，每个标签页都是一个 iframe。
- 支持启动、重新载入、停止、编辑源码、编辑元信息、查看日志、在新窗口打开。
- 可以从空白模板或交互式模板新建 Bokeh Server。
- 管理器、编辑器和 Bokeh 页面均支持亮色 / 暗色主题。
- 源码编辑器包含文件树、语法高亮和 `Ctrl+S` 保存。
- Bokeh `--dev` 热重载；Bokeh 进程重启后管理器会刷新 iframe。
- 每个服务器可配置标题、简介和使用说明等元信息。
- 内置两个可直接运行的示例。

## 语言

使用左侧栏底部的语言选择器在英文、简体中文和日文之间切换。

- 默认语言跟随浏览器语言（`zh*` 使用简体中文，`ja*` 使用日文，其他使用英文）。
- 选择会保存在浏览器中，刷新页面后仍然有效。
- 管理器和已打开的编辑器窗口会立即更新；当前文件和未保存内容不会丢失。
- iframe 中的 Bokeh 应用内容不做翻译。
- `server.json` 元信息按原文显示，不做翻译。

## 环境要求

- Windows，项目环境位于 `C:\pixi_env\.pixi\envs\default\python.exe`
- Python 3.14
- `requirements.txt` 中的依赖：
  - `bokeh>=3.9,<4`
  - `flask>=3.1,<4`
  - `psutil>=7,<8`
  - `PyYAML>=6,<7`

该环境中的 Bokeh 进程需要 `MKL_THREADING_LAYER=TBB`。`start.bat` 会自动设置。

## 快速开始

双击 `start.bat` 使用默认配置：`127.0.0.1:8010`。

管理器会自动打开浏览器。

修改端口或绑定地址：

```bat
start.bat --port 8080
start.bat --port 8010 --host 127.0.0.1
start.bat --port 8010 --host 0.0.0.0
```

- `--port` 默认 `8010`。
- `--host` 默认 `127.0.0.1`。
- 使用 `--host 0.0.0.0` 可让局域网内其他电脑访问。
- `start.bat --help` 查看可用参数。

手动启动：

```bat
set MKL_THREADING_LAYER=TBB
set BSM_HOST=127.0.0.1
set BSM_PORT=8010
C:\pixi_env\.pixi\envs\default\python.exe -u app.py
```

绑定 `0.0.0.0` 后，在另一台电脑上打开 `http://<这台电脑的IP>:8010`。管理器会自动使用浏览器访问时的主机名/IP 构造 Bokeh iframe 地址，Bokeh 子进程也会绑定所有网络接口。

Windows 防火墙可能需要允许 Python 访问专用网络，并允许管理器端口和自动分配的 Bokeh 端口。

## 服务器目录约定

每个应用都放在独立子目录中：

```text
servers/
  my_app/
    main.py          # 必需，Bokeh 目录应用入口
    server.json      # 可选：标题 / 简介 / 使用说明
    other files...   # 数据、模块、静态资源等
```

管理器会自动发现 `servers/` 下的目录。没有 `main.py` 的目录也会显示，但无法启动。

以下文件由管理器在服务器启动时生成，并被 Git 忽略：

- `theme.yaml`：当前亮色 / 暗色模式对应的 Bokeh 模型主题。
- `templates/index.html`：与 Bokeh 主题匹配的页面背景。

它们会在每次启动时重写，因此不要编辑这些生成文件；应修改管理器主题或应用代码。

## 元信息

每个服务器可以有一个 `server.json`：

```json
{
  "title": "我的应用",
  "description": "显示在侧栏中的一行简介。",
  "usage": "使用说明，保留换行。"
}
```

- `title`：用于侧栏和标签页标题；为空时使用目录名。
- `description`：显示在服务器标题下方。
- `usage`：显示在 **服务器信息** 对话框中。
- 元信息不做翻译，按原文显示。
- 不认识的 JSON 字段会被保留。
- 点击服务器卡片上的信息按钮即可编辑，无需手动修改 JSON。
- `server.json` 格式错误会在界面中提示，但不影响服务器启动。

## 主题行为

- 管理器和编辑器会立即切换亮色 / 暗色主题。
- Bokeh Server 保持启动时的主题，运行中的服务不会原地切换主题。
- 启动或重新载入服务器时，会把当前管理器主题写入 `theme.yaml` 和页面模板。
- 要让运行中的服务应用新主题，请点击 **重新载入**。
- 服务器卡片会显示当前运行进程使用的主题。

## 热重载

服务器使用以下命令启动：

```text
python -m bokeh serve --dev ...
```

Bokeh 会监听应用目录。保存源码文件后：

1. Bokeh 重启服务器进程。
2. 管理器在下一次状态轮询中检测到新的进程 ID。
3. 刷新已打开的 iframe，让 BokehJS 重新连接。

这样可以避免仅重连 WebSocket 时出现的 BokehJS 模型引用错误。

## 源码编辑器

点击服务器卡片上的铅笔按钮，在独立窗口中打开编辑器。

- 左侧：该服务器目录的完整文件树。
- 右侧：CodeMirror 编辑器，支持 Python、HTML、CSS、JavaScript、JSON、YAML 和 Markdown。
- `Ctrl+S` 保存当前文件。
- 未保存的修改会标记，切换文件或关闭窗口前会提示。
- `theme.yaml` 和 `templates/index.html` 标记为 `AUTO`；`server.json` 标记为 `META`。
- 编辑器跟随管理器的亮色 / 暗色主题和语言。

## 新建服务器

点击侧栏中的 **新建**。

- 目录名可以包含字母、数字、下划线和连字符。
- 选择 **空白** 创建最小 Bokeh 页面，或选择 **交互式** 创建带滑块和服务端回调的正弦波图表。
- 标题默认为目录名，之后可以在 **服务器信息** 对话框中修改。
- 除非勾选 **立即启动**，新服务器默认处于停止状态。

## 示例

项目内置两个示例：

- **Sine Wave Lab**（`servers/sine_wave`）：可调波形、频率、振幅、速度和相位的动画正弦波。
- **Scatter Explorer**（`servers/scatter_dashboard`）：带分类筛选、点大小、回归线和联动 Y 轴直方图的合成散点图。

从侧栏启动它们，可以验证主题切换、语言切换和 `--dev` 热重载的完整流程。

## API

管理器提供一个小型本地 JSON API：

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
PUT    /api/servers/<name>/file
PUT    /api/servers/<name>/metadata
```

启动、停止、重新载入和元信息请求使用 JSON body。文件路径被限制在对应服务器目录内。发送 `X-BSM-Lang: en | zh-CN | ja` 可以本地化管理器错误消息。

## 注意事项

- 默认绑定 `127.0.0.1`；`--host 0.0.0.0` 会把管理器暴露到局域网。
- 管理器没有认证，并且可以编辑本地文件和运行代码。只应在可信网络中开放。
- 管理器是本地开发工具，不是生产部署服务器。
- 局域网访问还需要自动分配的 Bokeh 端口可达。
- `start.bat` 中写死了 Python 路径 `C:\pixi_env\.pixi\envs\default\python.exe`。如果环境不同，请修改 `PYTHON`。
- 自动生成的服务器主题文件被 Git 忽略，会在需要时重新创建。
