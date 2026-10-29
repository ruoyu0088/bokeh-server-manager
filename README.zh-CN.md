[English](README.md) | **简体中文** | [日本語](README.ja.md)

# Bokeh 服务器管理器

![Bokeh 服务器管理器](docs/screenshot.png)

一个用于集中运行和管理多个 Bokeh 与 Panel Server 应用的本地 Web 界面。

每个应用都在独立的 Bokeh 或 Panel 进程中运行。管理器在每次启动时自动分配空闲端口，将运行中的应用嵌入 iframe 标签页，并在独立窗口中提供源码编辑器。

## 功能

- 多语言界面：英文、简体中文、日文。
- 可选的单密码 Web 登录和只读游客模式。
- 可配置管理器端口和绑定地址，按需开启局域网访问。
- 可折叠、可调宽度的左侧栏，使用 `Ctrl+B`（或 `Cmd+B`）开关。
- 每个 Bokeh 或 Panel Server 独立进程，自动分配端口。
- 多个运行中的服务以标签页展示，每个标签页都是一个 iframe。
- 可隐藏标签页让当前应用占满主区域；通过右上角浮动菜单切换标签页，`Ctrl+M` 切换该模式。
- 支持启动、重新载入、停止、编辑源码、编辑元信息、查看日志、在新窗口打开。
- 可以从空白模板或交互式模板新建 Bokeh 或 Panel Server。
- 管理器、编辑器以及 Bokeh / Panel 页面均支持亮色 / 暗色主题。
- 源码编辑器包含文件树、语法高亮、新建/删除文件和 `Ctrl+S` 保存。
- Bokeh 和 Panel `--dev` 热重载；Bokeh 进程重启后管理器会刷新 iframe，Panel 则原地刷新页面。
- 写请求 CSRF 防护、登录失败限速、重设密码后旧会话失效。
- 项目信息窗口：在独立窗口中将 Markdown 文档渲染为安全的 HTML。
- 每个服务器可配置标题、简介和 Markdown 文档等元信息。
- 内置三个可直接运行的示例，其中包括一个 Panel 应用。

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
  - `panel>=1.9,<2`
  - `flask>=3.1,<4`
  - `psutil>=7,<8`
  - `PyYAML>=6,<7`
  - `watchfiles>=1.3,<2`，用于可靠的 Panel `--dev` 热重载
  - `Markdown>=3.7,<4`，用于项目文档
  - `bleach>=6,<7`，用于清理渲染后的 Markdown

该环境中的 Bokeh 和 Panel 进程需要 `MKL_THREADING_LAYER=TBB`。`start.bat` 会自动设置。

## 快速开始

双击 `start.bat` 使用现有本地模式：`127.0.0.1:8010`，不启用登录。

Web 登录模式需要先设置单密码：

```bat
start.bat --web --set-password
```

然后启动 Web 模式：

```bat
start.bat --web
start.bat --web --port 8010 --host 127.0.0.1
start.bat --web --port 8010 --host 0.0.0.0
```

- `--web` 启用登录页和只读游客模式。
- `--set-password` 必须和 `--web` 一起使用；密码输入两次且不回显，结束后保留窗口。
- `--port` 默认 `8010`。
- `--host` 默认 `127.0.0.1`；只有显式传入 `0.0.0.0` 才开放局域网。
- `start.bat --help` 查看可用参数。

不带 `--web` 时，现有本地管理器仍然不登录，并且默认只绑定回环地址。

手动启动：

```bat
set MKL_THREADING_LAYER=TBB
set BSM_HOST=127.0.0.1
set BSM_PORT=8010
C:\pixi_env\.pixi\envs\default\python.exe -u app.py
```

绑定 `0.0.0.0` 后，在另一台电脑上打开 `http://<这台电脑的IP>:8010`。管理器会自动使用浏览器访问时的主机名/IP 构造 iframe 地址，子进程也会绑定所有网络接口。

Windows 防火墙可能需要允许 Python 访问专用网络，并允许管理器端口和自动分配的 Bokeh/Panel 端口。

## Web 登录

Web 模式只有一个密码，没有用户名、注册、角色、OAuth 或网页改密功能。

### 设置密码

```bat
start.bat --web --set-password
```

- 密码输入两次，输入过程不回显。
- 空密码拒绝；不检查最小长度或复杂度。
- 密码以加盐 scrypt 哈希保存在 `.runtime/web_auth.json`，该文件被 Git 忽略。
- 密码本身不会写入日志、URL、页面或前端存储。
- 文件还保存随机会话密钥和认证版本号；重设密码会使旧会话失效。
- 没有凭据文件时，Web 模式拒绝启动并提示：
  ```text
  Run: start.bat --web --set-password
  ```

### 登录与游客模式

- 所有管理器页面和 API 都必须登录，包括从 `127.0.0.1` / `localhost` 访问。
- 登录页只需要密码。
- 点击“不输入密码，直接进入”进入只读游客模式。
- 登录后的跳转目标只能是站内路径。
- 左侧栏提供“输入密码”按钮，可从游客升级为编辑模式；同时提供“退出登录”。

游客权限：

- 查看源码和文件树。
- 查看日志、元信息、服务器状态和运行中的 Bokeh/Panel 应用。
- 启动、停止和重新载入服务器。
- 不能保存或编辑源码文件。
- 不能新建或删除文件。
- 不能新建服务器。
- 不能编辑元信息。

### 会话与防护

- 会话 Cookie 使用 `HttpOnly` 和 `SameSite=Lax`。首版使用 HTTP，因此不设置 `Secure`。
- 所有修改状态的请求都需要 CSRF token，包括登录、游客登录、退出、启动、停止、重新载入、文件写入和元信息修改。
- 同一 IP 在 5 分钟内最多失败 5 次，之后暂时返回 `429`。
- 登录失败只显示通用错误，不区分具体原因。
- 重设密码会更换认证版本号和会话密钥，使旧会话失效（重启后同样失效）。
- 未登录 API 返回 `401`；游客尝试写入源码或元信息返回 `403`。

### 安全限制

- 管理器只使用 HTTP，局域网流量未加密。绑定 `0.0.0.0` 时，登录页和启动日志都会警告。
- 登录只保护管理器 UI/API。Bokeh/Panel 子进程使用独立端口，不受该登录保护；知道端口的人可以直接访问应用。请只在可信网络中使用。
- 这是单机、单密码工具，不是多用户系统或中心服务器。

### 手动启动 Web 模式

```bat
set MKL_THREADING_LAYER=TBB
set BSM_HOST=127.0.0.1
set BSM_PORT=8010
C:\pixi_env\.pixi\envs\default\python.exe -u app.py --web
```

凭据文件必须已经存在。通过 `start.bat` 启动时，只有显式 `--host 0.0.0.0` 才会开放局域网；继承的 `BSM_HOST` 环境变量在 Web 模式下会被忽略。

## 服务器目录约定

每个应用都放在独立子目录中：

```text
servers/
  my_app/
    main.py          # 必需，Bokeh 或 Panel 应用入口
    server.json      # 可选：标题 / 简介 / 使用说明 / framework
    other files...   # 数据、模块、静态资源等
```

管理器会自动发现 `servers/` 下的目录。没有 `main.py` 的目录也会显示，但无法启动。

对于 Bokeh，`main.py` 是使用 `curdoc()` 的目录应用；对于 Panel，`main.py` 是以 `.servable()` 结尾的单文件 Panel 脚本。框架在创建服务器时选择，并保存在 `server.json` 中。

Bokeh 服务器启动时，管理器会生成以下文件（并被 Git 忽略）：

- `theme.yaml`：当前亮色 / 暗色模式对应的 Bokeh 模型主题。
- `templates/index.html`：与 Bokeh 主题匹配的页面背景。

Panel 服务器使用 Panel 自己的模板，主题通过 URL 查询参数传入。管理器不会为 Panel 生成 Bokeh 主题文件。

生成的 Bokeh 文件会在每次启动时重写，因此不要编辑它们；应修改管理器主题或应用代码。

## Panel 应用

Panel 作为一等服务器类型支持。在 **新建** 对话框中选择 **Panel**，或在 `server.json` 中设置：

```json
{
  "framework": "panel"
}
```

Panel 应用是单文件 `main.py` 脚本。建议使用标准模板，这样管理器主题会自动生效：

```python
import panel as pn

pn.extension()

template = pn.template.FastListTemplate(
    title="我的 Panel 应用",
    main=[pn.pane.Markdown("## 来自 Panel 的问候")],
)
template.servable()
```

管理器使用以下命令启动 Panel：

```text
python -m panel serve --dev ... servers/<name>/main.py
```

- 应用地址为 `/main`。
- Panel 会原地重载源码变化，不需要按进程 ID 刷新 iframe。
- 当前管理器主题通过 `?theme=default`（亮色）或 `?theme=dark`（暗色）传入。Panel 标准模板会跟随该参数。
- 没有使用标准模板的裸 Panel 脚本可能不会应用页面主题。
- 暂不支持 Panel 多页应用和 Notebook；每个服务器使用一个 `main.py`。

## 元信息

每个服务器可以有一个 `server.json`：

```json
{
  "title": "我的应用",
  "description": "显示在侧栏中的一行简介。",
  "usage": "## 使用说明\n\n- 使用 Markdown 编写项目文档。",
  "framework": "panel"
}
```

- `title`：用于侧栏和标签页标题；为空时使用目录名。
- `description`：显示在服务器标题下方。
- `usage`：项目文档，使用 Markdown 编写，在 **项目信息** 窗口中渲染。
- `framework`：`"bokeh"` 或 `"panel"`；省略时默认为 `"bokeh"`。
- 元信息不做翻译，按原文显示。
- 不认识的 JSON 字段会被保留。
- 点击服务器卡片上的编辑信息按钮即可编辑标题、简介和项目文档，无需手动修改 JSON。框架在对话框中只读显示，并在创建服务器时选择。
- `server.json` 格式错误会在界面中提示，但不影响服务器启动。

## 项目信息窗口

点击服务器卡片上的书本图标，可在独立浏览器窗口中查看项目信息。这样可以在继续使用 Bokeh/Panel 应用的同时阅读文档。

- **项目文档** 由 `usage` 字段按 Markdown 渲染。
- 支持标题、列表、表格、代码块、链接和引用。
- 渲染后的 HTML 会经过白名单清理，文档中的脚本和事件处理属性会被移除。
- 页面跟随管理器的亮色 / 暗色主题和界面语言；Markdown 内容本身不做翻译。
- 可通过页面右上角的关闭按钮关闭窗口。
- 该页面和管理器使用相同的 Web 登录保护；游客也可以阅读。
- 页面地址为 `/info?server=<name>`。

`server.json` 中的 Markdown 示例：

```json
{
  "usage": "## 控件\n\n- **频率**：改变波形速度。\n- **振幅**：改变波形高度。\n\n> 提示：修改主题后请重新载入服务器。"
}
```

## 主题行为

- 管理器和编辑器会立即切换亮色 / 暗色主题。
- Bokeh 或 Panel Server 保持启动时的主题，运行中的服务不会原地切换主题。
- 对于 Bokeh，启动或重新载入时会把当前管理器主题写入 `theme.yaml` 和页面模板。
- 对于 Panel，主题通过 iframe URL 的 `?theme=default` 或 `?theme=dark` 传入；标准 Panel 模板会应用它。
- 要让运行中的服务应用新主题，请点击 **重新载入**。
- 服务器卡片会显示当前运行进程使用的主题。

## 隐藏标签页模式

点击标签栏最右侧的按钮可以隐藏标签栏，让当前应用 iframe 占满主显示区。

- 应用右上角会保留一个小型半透明标签按钮，点击后弹出所有已打开标签页的菜单。
- 点击菜单中的标签页即可切换，不需要退出该模式。
- 菜单中的 **退出隐藏模式** 会恢复标签栏。
- `Ctrl+M`（或 `Cmd+M`）可在隐藏 / 显示之间切换。
- 该模式会保存在 `localStorage` 中。
- 浮动按钮和菜单由管理器页面叠加显示，不在 iframe 内部，因此切换标签页不会重新加载应用。
- 由于 iframe 占满区域，浮动按钮必然覆盖右上角很小的一点；菜单只在打开时临时覆盖。
- `Ctrl+M` 由管理器页面处理。如果键盘焦点在 Bokeh/Panel iframe 内，按键会发送给应用，管理器收不到；请先点击管理器界面或浮动按钮。

## 热重载

Bokeh 服务器使用以下命令启动：

```text
python -m bokeh serve --dev ...
```

Bokeh 会监听应用目录。保存源码文件后：

1. Bokeh 重启服务器进程。
2. 管理器在下一次状态轮询中检测到新的进程 ID。
3. 刷新已打开的 iframe，让 BokehJS 重新连接。

这样可以避免仅重连 WebSocket 时出现的 BokehJS 模型引用错误。

Panel 服务器使用以下命令启动：

```text
python -m panel serve --dev ...
```

Panel 的 `--dev` 模式会重新加载应用并原地更新已打开的页面。进程 ID 可能保持不变，因此管理器不会强制额外刷新 iframe。建议安装 `watchfiles`，`requirements.txt` 中已包含。

## 源码编辑器

点击服务器卡片上的铅笔按钮，在独立窗口中打开编辑器。

- 左侧：该服务器目录的完整文件树。
- 右侧：CodeMirror 编辑器，支持 Python、HTML、CSS、JavaScript、JSON、YAML 和 Markdown。
- 使用 **+** 按钮新建文件，支持 `lib/helpers.py` 这样的嵌套路径，子目录会自动创建。
- 使用垃圾桶按钮删除当前打开的文件，删除前会要求确认。
- `Ctrl+S` 保存当前文件。
- 未保存的修改会标记，切换文件或关闭窗口前会提示。
- `theme.yaml` 和 `templates/index.html` 标记为 `AUTO`；`server.json` 标记为 `META`。
- 编辑器跟随管理器的亮色 / 暗色主题和语言。

## 新建服务器

点击侧栏中的 **新建**。

- 目录名可以包含字母、数字、下划线和连字符。
- 选择 **Bokeh** 或 **Panel** 作为框架。
- 选择 **空白** 创建最小页面，或选择 **交互式** 创建带控件、图表和服务端回调的应用。
- 生成的代码会跟随所选框架：Bokeh 目录应用，或使用 `FastListTemplate` 的单文件 Panel 脚本。
- 标题默认为目录名，之后可以在 **服务器信息** 对话框中修改。
- 除非勾选 **立即启动**，新服务器默认处于停止状态。

## 示例

项目内置三个示例：

- **Sine Wave Lab**（`servers/sine_wave`）：可调波形、频率、振幅、速度和相位的动画 Bokeh 正弦波。
- **Scatter Explorer**（`servers/scatter_dashboard`）：带分类筛选、点大小、回归线和联动 Y 轴直方图的 Bokeh 散点图。
- **Panel Demo**（`servers/panel_demo`）：使用 `FastListTemplate`、侧栏控件和实时 Bokeh 图表的 Panel 应用。

从侧栏启动它们，可以验证主题切换、语言切换和 `--dev` 热重载的完整流程。

## API

管理器提供一个小型本地 JSON API：

```text
GET    /login
POST   /login
POST   /login/guest
POST   /logout
GET    /api/auth/status
POST   /api/auth/login
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

启动、停止、重新载入和元信息请求使用 JSON body。`POST /api/servers` 接受 `"framework": "bokeh" | "panel"`。文件路径被限制在对应服务器目录内。发送 `X-BSM-Lang: en | zh-CN | ja` 可以本地化管理器错误消息。

在 `--web` 模式下，除登录接口外的管理器 API 都需要会话。写请求需要 `X-CSRF-Token`；游客可以启动/停止/重新载入，但文件、新建服务器和元信息写入会返回 `403`。没有会话时返回 `401`，页面请求会跳转到 `/login`。

## 注意事项

- 默认本地模式绑定 `127.0.0.1`，不登录；`--web` 启用单密码登录。
- Web 模式下只有显式 `--host 0.0.0.0` 才开放局域网；登录页和启动日志会提示 HTTP 流量未加密。
- 登录只保护管理器 UI/API；Bokeh/Panel 子端口仍可直接访问，请只在可信网络中使用局域网模式。
- 管理器是本地开发工具，不是生产部署服务器，也没有多用户角色或中心认证。
- 局域网访问还需要自动分配的 Bokeh/Panel 端口可达。
- `start.bat` 中写死了 Python 路径 `C:\pixi_env\.pixi\envs\default\python.exe`。如果环境不同，请修改 `PYTHON`。
- Web 凭据文件是 `.runtime/web_auth.json`，被 Git 忽略；它只包含加盐 scrypt 哈希、会话密钥和认证版本号，不包含密码明文。
- 自动生成的 Bokeh 主题文件被 Git 忽略，会在需要时重新创建。
- Panel 目前只支持单文件 `main.py`，不支持 Notebook 或多页目录应用。
