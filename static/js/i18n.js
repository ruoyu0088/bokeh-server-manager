(() => {
  "use strict";

  const STORAGE_KEY = "bsm-lang";
  const SUPPORTED = ["en", "zh-CN", "ja"];

  const messages = {
    en: {
      "sidebar.aria": "Server management sidebar",
      "sidebar.collapseTitle": "Collapse sidebar (Ctrl+B)",
      "sidebar.expandTitle": "Show sidebar (Ctrl+B)",
      "sidebar.servers": "Bokeh Servers",
      "sidebar.new": "New",
      "sidebar.newTitle": "Create a new Bokeh server",
      "sidebar.refreshTitle": "Refresh server list",
      "sidebar.empty":
        "No Bokeh servers yet.<br>Add an application under <code>servers/</code> or create one here.",
      "sidebar.connected": "Connected",
      "sidebar.offline": "Manager offline",
      "sidebar.connectionTitle": "Manager connection status",
      "sidebar.resizeTitle": "Drag to resize sidebar; double-click to reset",
      "sidebar.shortcutTitle": "Show / hide sidebar",
      "sidebar.language": "Language",
      "empty.title": "Open a Bokeh server",
      "empty.body":
        "Start a server from the sidebar and its UI will open here in a tab. You can keep several servers open at once.",
      "empty.shortcut":
        "Press <kbd>Ctrl</kbd> + <kbd>B</kbd> to show or hide the sidebar.",
      "tabs.aria": "Open Bokeh servers",

      "theme.light": "Light",
      "theme.dark": "Dark",
      "theme.label": "{theme} theme",
      "theme.toggleTitle": "Toggle light / dark theme",
      "theme.switchToLight": "Switch to light theme",
      "theme.switchToDark": "Switch to dark theme",
      "theme.changed": "{theme} theme enabled.",
      "theme.staleOne":
        "Interface theme changed. {count} running server will use it after the next reload or restart.",
      "theme.staleMany":
        "Interface theme changed. {count} running servers will use it after the next reload or restart.",
      "theme.chipTitle": "Theme used when this server was started",

      "status.running": "Running",
      "status.starting": "Starting",
      "status.stopping": "Stopping",
      "status.error": "Error",
      "status.stopped": "Stopped",
      "uptime.seconds": "{n}s",
      "uptime.minutes": "{n}m",
      "uptime.hours": "{h}h {m}m",

      "server.invalid": "This directory is not a valid Bokeh directory application.",
      "server.actions.start": "Start",
      "server.actions.reload":
        "Reload: restart the process and apply the current theme",
      "server.actions.stop": "Stop",
      "server.actions.edit": "Edit source",
      "server.actions.metadata": "Server information",
      "server.actions.metadataError":
        "Server information (server.json has an error)",
      "server.actions.logs": "View logs",
      "server.actions.external": "Open in a new window",
      "server.actions.openTab": "Open server tab",
      "server.actions.working": "Working…",
      "server.closeTab": "Close {title} tab",
      "server.iframeTitle": "{title} Bokeh application",

      "frame.connecting": "Connecting to {title}",
      "frame.connectingDetail":
        "The Bokeh UI will appear here when the server is ready.",
      "frame.processChanged":
        "The server process changed. Reloading the Bokeh UI.",
      "frame.reloading": "{title} is reloading",
      "frame.reloadingDetail":
        "Source changes were picked up by Bokeh --dev. Refreshing the UI.",
      "frame.unavailable": "{title} is unavailable",
      "frame.unavailableDetail":
        "Check the server logs, fix the problem, then reload.",
      "frame.starting": "{title} is starting",
      "frame.startingDetail":
        "The Bokeh process is preparing. The UI will appear automatically.",
      "frame.back": "{title} is back",
      "frame.backDetail": "Reloading the Bokeh UI.",

      "action.started": "Started “{title}” on port {port}.",
      "action.startFailed": "Start failed: {error}",
      "action.stopped": "Stopped “{title}”.",
      "action.stopFailed": "Stop failed: {error}",
      "action.reloading": "Reloading {title}",
      "action.reloadingDetail":
        "The process will restart with the current interface theme.",
      "action.reloaded": "Reloaded “{title}” on port {port}.",
      "action.reconnect": "Reconnecting",
      "action.reconnectDetail":
        "The process restarted. Loading the updated Bokeh UI.",
      "action.reloadFailed": "Reload failed: {error}",
      "action.popupBlocked":
        "The browser blocked the editor window. Allow pop-ups and try again.",

      "error.network": "Network request failed.",
      "error.requestFailed": "Request failed ({status}).",
      "error.refreshFailed": "Failed to refresh servers.",
      "error.cannotReach":
        "Cannot reach the manager backend. Check that the manager is still running.",

      "logs.title": "Logs · {name}",
      "logs.loading": "Loading logs…",
      "logs.empty": "No logs yet.",
      "logs.readFailed": "Failed to read logs: {error}",
      "logs.copied": "Logs copied.",
      "logs.copyFailed": "Copy failed. Select the text manually.",
      "logs.copy": "Copy",
      "logs.refresh": "Refresh",
      "logs.close": "Close",

      "new.title": "New Bokeh server",
      "new.directory": "Directory name",
      "new.directoryHint":
        "Letters, numbers, underscores, or hyphens. The app is created under <code>servers/&lt;name&gt;</code>.",
      "new.name": "Title",
      "new.namePlaceholder": "My Bokeh app",
      "new.nameHint":
        "Shown in the sidebar and tab. Defaults to the directory name.",
      "new.template": "Template",
      "new.blank": "Blank",
      "new.blankHint":
        "A minimal Bokeh page. A good starting point for custom apps.",
      "new.interactive": "Interactive",
      "new.interactiveHint":
        "A sine-wave plot with a slider and a server-side callback.",
      "new.start": "Start immediately",
      "new.creating": "Creating…",
      "new.created": "Created “{title}”.",
      "new.invalidName":
        "Use letters, numbers, underscores, or hyphens. The name must start with a letter or number.",

      "metadata.title": "Server information · {title}",
      "metadata.warningTitle": "server.json needs attention.",
      "metadata.warningBody":
        "{error} Saving this form will replace it with valid metadata.",
      "metadata.titleField": "Title",
      "metadata.titleHint":
        "Used in the sidebar and tab. Falls back to the directory name when empty.",
      "metadata.description": "Description",
      "metadata.descriptionHint":
        "A short summary shown under the server title.",
      "metadata.usage": "Usage",
      "metadata.usageHint":
        "Shown in this dialog. Plain text; line breaks are preserved.",
      "metadata.directory": "Directory:",
      "metadata.savedTo": "Saved to server.json",
      "metadata.saving": "Saving…",
      "metadata.saved": "Server information saved.",

      "editor.loading": "Loading…",
      "editor.subtitle": "Bokeh source editor",
      "editor.noFile": "No file open",
      "editor.autoBadge": "auto",
      "editor.metaBadge": "meta",
      "editor.autoTitle": "Generated by the manager at server start",
      "editor.metaTitle": "Edited by the server information dialog",
      "editor.unsavedTitle": "Unsaved changes",
      "editor.refreshTree": "Refresh file tree",
      "editor.save": "Save",
      "editor.files": "Files",
      "editor.loadingFiles": "Loading files…",
      "editor.selectFile": "Select a file",
      "editor.selectFileHint":
        "Choose a file from the tree to start editing.",
      "editor.lncol": "Ln {line}, Col {col}",
      "editor.selected": "{count} selected",
      "editor.plainText": "Plain text",
      "editor.utf8": "UTF-8",
      "editor.ctrlSave": "Ctrl+S to save",
      "editor.ready": "Ready",
      "editor.saving": "Saving…",
      "editor.unsaved": "Unsaved changes",
      "editor.saved": "Saved",
      "editor.saveFailed": "Save failed",
      "editor.filesCount": "{count} files · {name}",
      "editor.couldNotLoadFiles": "Could not load files",
      "editor.discard": "Discard unsaved changes in “{path}”?",
      "editor.openFailed": "Could not open file: {error}",
      "editor.openErrorTitle": "Could not open this file.",
      "editor.saveSuccess": "Saved {path}.",
      "editor.generatedWarning":
        "This generated theme file will be replaced by the manager on the next server start.",
      "editor.saveError": "Save failed: {error}",
      "editor.treeError": "Could not load file tree: {error}",
      "editor.serverUnavailable": "Server unavailable",
      "editor.unknownServer": "Unknown server",
      "editor.serverLoadError": "Could not load this server.\n{error}",
      "editor.noServerSelected": "No server selected",
      "editor.noServerSubtitle": "Open the editor from the manager",
      "editor.noServerError":
        "No server was selected. Open the server information or the Edit source button from the manager.",
      "editor.noServer": "No server",

      "common.cancel": "Cancel",
      "common.close": "Close",
      "common.save": "Save",
      "common.refresh": "Refresh",
      "common.copy": "Copy",
      "common.create": "Create",
      "common.loading": "Loading…",
      "language.label": "Language",
    },

    "zh-CN": {
      "sidebar.aria": "服务器管理侧栏",
      "sidebar.collapseTitle": "收起侧栏 (Ctrl+B)",
      "sidebar.expandTitle": "打开侧栏 (Ctrl+B)",
      "sidebar.servers": "Bokeh 服务器",
      "sidebar.new": "新建",
      "sidebar.newTitle": "新建 Bokeh 服务器",
      "sidebar.refreshTitle": "刷新服务器列表",
      "sidebar.empty":
        "还没有 Bokeh 服务器。<br>把应用放进 <code>servers/</code> 目录，或在这里新建。",
      "sidebar.connected": "已连接",
      "sidebar.offline": "管理器未连接",
      "sidebar.connectionTitle": "管理器连接状态",
      "sidebar.resizeTitle": "拖动调整侧栏宽度，双击恢复默认",
      "sidebar.shortcutTitle": "显示 / 隐藏侧栏",
      "sidebar.language": "语言",
      "empty.title": "打开一个 Bokeh 服务",
      "empty.body":
        "从左侧启动服务，它的界面会在这里以标签页打开。可以同时打开多个服务。",
      "empty.shortcut":
        "按 <kbd>Ctrl</kbd> + <kbd>B</kbd> 显示或隐藏左侧栏。",
      "tabs.aria": "已打开的 Bokeh 服务",

      "theme.light": "亮色",
      "theme.dark": "暗色",
      "theme.label": "{theme}主题",
      "theme.toggleTitle": "切换亮色 / 暗色主题",
      "theme.switchToLight": "切换到亮色主题",
      "theme.switchToDark": "切换到暗色主题",
      "theme.changed": "已切换为{theme}主题。",
      "theme.staleOne":
        "界面主题已切换；{count} 个运行中的服务将在下次重载或重启后应用新主题。",
      "theme.staleMany":
        "界面主题已切换；{count} 个运行中的服务将在下次重载或重启后应用新主题。",
      "theme.chipTitle": "该服务启动时使用的主题",

      "status.running": "运行中",
      "status.starting": "启动中",
      "status.stopping": "停止中",
      "status.error": "异常",
      "status.stopped": "已停止",
      "uptime.seconds": "{n} 秒",
      "uptime.minutes": "{n} 分钟",
      "uptime.hours": "{h} 小时 {m} 分",

      "server.invalid": "这个目录不是有效的 Bokeh 目录应用。",
      "server.actions.start": "启动",
      "server.actions.reload": "重新载入：重启进程并应用当前主题",
      "server.actions.stop": "停止",
      "server.actions.edit": "编辑源程序",
      "server.actions.metadata": "服务器信息",
      "server.actions.metadataError": "服务器信息（server.json 有错误）",
      "server.actions.logs": "查看日志",
      "server.actions.external": "在新窗口打开",
      "server.actions.openTab": "打开服务标签页",
      "server.actions.working": "处理中…",
      "server.closeTab": "关闭 {title} 标签页",
      "server.iframeTitle": "{title} Bokeh 应用",

      "frame.connecting": "正在连接 {title}",
      "frame.connectingDetail": "Bokeh 服务就绪后，界面会自动显示在这里。",
      "frame.processChanged": "服务进程已更新，正在重新加载 Bokeh 界面。",
      "frame.reloading": "{title} 正在重新载入",
      "frame.reloadingDetail":
        "Bokeh --dev 已检测到源码变化，正在刷新界面。",
      "frame.unavailable": "{title} 暂时不可用",
      "frame.unavailableDetail": "查看服务日志，修复问题后重新载入。",
      "frame.starting": "{title} 正在启动",
      "frame.startingDetail": "Bokeh 进程准备中，界面会自动出现。",
      "frame.back": "{title} 已恢复",
      "frame.backDetail": "正在重新加载 Bokeh 界面。",

      "action.started": "已启动“{title}”，端口 {port}。",
      "action.startFailed": "启动失败：{error}",
      "action.stopped": "已停止“{title}”。",
      "action.stopFailed": "停止失败：{error}",
      "action.reloading": "正在重新载入 {title}",
      "action.reloadingDetail": "进程将重新启动，并应用当前界面主题。",
      "action.reloaded": "已重新载入“{title}”，端口 {port}。",
      "action.reconnect": "正在重新连接",
      "action.reconnectDetail": "进程已重启，正在加载最新的 Bokeh 界面。",
      "action.reloadFailed": "重新载入失败：{error}",
      "action.popupBlocked":
        "浏览器拦截了编辑器窗口，请允许弹出窗口后重试。",

      "error.network": "网络请求失败。",
      "error.requestFailed": "请求失败（{status}）。",
      "error.refreshFailed": "刷新服务器列表失败。",
      "error.cannotReach": "无法连接管理器后端，请确认管理服务仍在运行。",

      "logs.title": "日志 · {name}",
      "logs.loading": "正在加载日志…",
      "logs.empty": "暂无日志。",
      "logs.readFailed": "读取日志失败：{error}",
      "logs.copied": "日志已复制。",
      "logs.copyFailed": "复制失败，请手动选择文本。",
      "logs.copy": "复制",
      "logs.refresh": "刷新",
      "logs.close": "关闭",

      "new.title": "新建 Bokeh 服务器",
      "new.directory": "目录名",
      "new.directoryHint":
        "可包含字母、数字、下划线或连字符。应用会创建在 <code>servers/&lt;name&gt;</code> 下。",
      "new.name": "标题",
      "new.namePlaceholder": "我的 Bokeh 应用",
      "new.nameHint": "显示在侧栏和标签页。留空时使用目录名。",
      "new.template": "模板",
      "new.blank": "空白",
      "new.blankHint": "最小 Bokeh 页面，适合作为自定义应用的起点。",
      "new.interactive": "交互式",
      "new.interactiveHint":
        "带滑块和服务端回调的正弦波图表。",
      "new.start": "立即启动",
      "new.creating": "正在创建…",
      "new.created": "已创建“{title}”。",
      "new.invalidName":
        "只能使用字母、数字、下划线或连字符，并且必须以字母或数字开头。",

      "metadata.title": "服务器信息 · {title}",
      "metadata.warningTitle": "server.json 需要处理。",
      "metadata.warningBody":
        "{error} 保存表单会用有效的元信息替换它。",
      "metadata.titleField": "标题",
      "metadata.titleHint":
        "用于侧栏和标签页。留空时使用目录名。",
      "metadata.description": "简介",
      "metadata.descriptionHint": "显示在服务器标题下方的一行简介。",
      "metadata.usage": "使用说明",
      "metadata.usageHint":
        "在此对话框中显示。纯文本，保留换行。",
      "metadata.directory": "目录：",
      "metadata.savedTo": "保存到 server.json",
      "metadata.saving": "正在保存…",
      "metadata.saved": "服务器信息已保存。",

      "editor.loading": "加载中…",
      "editor.subtitle": "Bokeh 源码编辑器",
      "editor.noFile": "未打开文件",
      "editor.autoBadge": "自动",
      "editor.metaBadge": "元",
      "editor.autoTitle": "由管理器在服务器启动时生成",
      "editor.metaTitle": "通过服务器信息对话框编辑",
      "editor.unsavedTitle": "未保存的修改",
      "editor.refreshTree": "刷新文件树",
      "editor.save": "保存",
      "editor.files": "文件",
      "editor.loadingFiles": "正在加载文件…",
      "editor.selectFile": "选择一个文件",
      "editor.selectFileHint": "从左侧文件树选择文件开始编辑。",
      "editor.lncol": "行 {line}，列 {col}",
      "editor.selected": "已选择 {count} 个字符",
      "editor.plainText": "纯文本",
      "editor.utf8": "UTF-8",
      "editor.ctrlSave": "Ctrl+S 保存",
      "editor.ready": "就绪",
      "editor.saving": "正在保存…",
      "editor.unsaved": "未保存",
      "editor.saved": "已保存",
      "editor.saveFailed": "保存失败",
      "editor.filesCount": "{count} 个文件 · {name}",
      "editor.couldNotLoadFiles": "无法加载文件",
      "editor.discard": "放弃“{path}”中未保存的修改？",
      "editor.openFailed": "无法打开文件：{error}",
      "editor.openErrorTitle": "无法打开此文件。",
      "editor.saveSuccess": "已保存 {path}。",
      "editor.generatedWarning":
        "这是自动生成的主题文件，下次启动服务器时会被管理器替换。",
      "editor.saveError": "保存失败：{error}",
      "editor.treeError": "无法加载文件树：{error}",
      "editor.serverUnavailable": "服务器不可用",
      "editor.unknownServer": "未知服务器",
      "editor.serverLoadError": "无法加载此服务器。\n{error}",
      "editor.noServerSelected": "未选择服务器",
      "editor.noServerSubtitle": "请从管理器打开编辑器",
      "editor.noServerError":
        "未选择服务器。请从管理器中的“服务器信息”或“编辑源程序”按钮打开。",
      "editor.noServer": "无服务器",

      "common.cancel": "取消",
      "common.close": "关闭",
      "common.save": "保存",
      "common.refresh": "刷新",
      "common.copy": "复制",
      "common.create": "创建",
      "common.loading": "加载中…",
      "language.label": "语言",
    },

    ja: {
      "sidebar.aria": "サーバー管理サイドバー",
      "sidebar.collapseTitle": "サイドバーを閉じる (Ctrl+B)",
      "sidebar.expandTitle": "サイドバーを表示 (Ctrl+B)",
      "sidebar.servers": "Bokeh サーバー",
      "sidebar.new": "新規",
      "sidebar.newTitle": "新しい Bokeh サーバーを作成",
      "sidebar.refreshTitle": "サーバー一覧を更新",
      "sidebar.empty":
        "Bokeh サーバーがまだありません。<br><code>servers/</code> にアプリを追加するか、ここで新規作成してください。",
      "sidebar.connected": "接続済み",
      "sidebar.offline": "マネージャー未接続",
      "sidebar.connectionTitle": "マネージャーの接続状態",
      "sidebar.resizeTitle": "ドラッグでサイドバーの幅を変更、ダブルクリックでリセット",
      "sidebar.shortcutTitle": "サイドバーの表示 / 非表示",
      "sidebar.language": "言語",
      "empty.title": "Bokeh サーバーを開く",
      "empty.body":
        "サイドバーからサーバーを起動すると、ここにタブで UI が開きます。複数のサーバーを同時に開けます。",
      "empty.shortcut":
        "<kbd>Ctrl</kbd> + <kbd>B</kbd> でサイドバーを表示 / 非表示にできます。",
      "tabs.aria": "開いている Bokeh サーバー",

      "theme.light": "ライト",
      "theme.dark": "ダーク",
      "theme.label": "{theme}テーマ",
      "theme.toggleTitle": "ライト / ダークテーマを切り替え",
      "theme.switchToLight": "ライトテーマに切り替え",
      "theme.switchToDark": "ダークテーマに切り替え",
      "theme.changed": "{theme}テーマに切り替えました。",
      "theme.staleOne":
        "画面テーマを変更しました。実行中の {count} 個のサーバーは次回の再読み込みまたは再起動後に適用されます。",
      "theme.staleMany":
        "画面テーマを変更しました。実行中の {count} 個のサーバーは次回の再読み込みまたは再起動後に適用されます。",
      "theme.chipTitle": "このサーバーの起動時に使用したテーマ",

      "status.running": "実行中",
      "status.starting": "起動中",
      "status.stopping": "停止中",
      "status.error": "エラー",
      "status.stopped": "停止済み",
      "uptime.seconds": "{n} 秒",
      "uptime.minutes": "{n} 分",
      "uptime.hours": "{h} 時間 {m} 分",

      "server.invalid": "このディレクトリは有効な Bokeh ディレクトリアプリではありません。",
      "server.actions.start": "起動",
      "server.actions.reload": "再読み込み：プロセスを再起動し、現在のテーマを適用",
      "server.actions.stop": "停止",
      "server.actions.edit": "ソースを編集",
      "server.actions.metadata": "サーバー情報",
      "server.actions.metadataError": "サーバー情報（server.json にエラーがあります）",
      "server.actions.logs": "ログを表示",
      "server.actions.external": "新しいウィンドウで開く",
      "server.actions.openTab": "サーバータブを開く",
      "server.actions.working": "処理中…",
      "server.closeTab": "{title} のタブを閉じる",
      "server.iframeTitle": "{title} Bokeh アプリ",

      "frame.connecting": "{title} に接続中",
      "frame.connectingDetail":
        "サーバーの準備ができると、ここに Bokeh UI が表示されます。",
      "frame.processChanged":
        "サーバープロセスが変更されました。Bokeh UI を再読み込みしています。",
      "frame.reloading": "{title} を再読み込み中",
      "frame.reloadingDetail":
        "Bokeh --dev がソースの変更を検出しました。UI を更新しています。",
      "frame.unavailable": "{title} は利用できません",
      "frame.unavailableDetail":
        "サーバーログを確認し、問題を修正してから再読み込みしてください。",
      "frame.starting": "{title} を起動中",
      "frame.startingDetail":
        "Bokeh プロセスを準備しています。UI は自動的に表示されます。",
      "frame.back": "{title} が復帰しました",
      "frame.backDetail": "Bokeh UI を再読み込みしています。",

      "action.started": "「{title}」を起動しました（ポート {port}）。",
      "action.startFailed": "起動に失敗しました：{error}",
      "action.stopped": "「{title}」を停止しました。",
      "action.stopFailed": "停止に失敗しました：{error}",
      "action.reloading": "{title} を再読み込み中",
      "action.reloadingDetail":
        "現在の画面テーマでプロセスを再起動します。",
      "action.reloaded": "「{title}」を再読み込みしました（ポート {port}）。",
      "action.reconnect": "再接続中",
      "action.reconnectDetail":
        "プロセスが再起動しました。最新の Bokeh UI を読み込んでいます。",
      "action.reloadFailed": "再読み込みに失敗しました：{error}",
      "action.popupBlocked":
        "ブラウザがエディターウィンドウをブロックしました。ポップアップを許可して再試行してください。",

      "error.network": "ネットワークリクエストに失敗しました。",
      "error.requestFailed": "リクエストに失敗しました（{status}）。",
      "error.refreshFailed": "サーバー一覧の更新に失敗しました。",
      "error.cannotReach":
        "マネージャーバックエンドに接続できません。マネージャーが実行中か確認してください。",

      "logs.title": "ログ · {name}",
      "logs.loading": "ログを読み込み中…",
      "logs.empty": "ログはまだありません。",
      "logs.readFailed": "ログの読み込みに失敗しました：{error}",
      "logs.copied": "ログをコピーしました。",
      "logs.copyFailed": "コピーに失敗しました。テキストを手動で選択してください。",
      "logs.copy": "コピー",
      "logs.refresh": "更新",
      "logs.close": "閉じる",

      "new.title": "新しい Bokeh サーバー",
      "new.directory": "ディレクトリ名",
      "new.directoryHint":
        "英数字、アンダースコア、ハイフンを使用できます。アプリは <code>servers/&lt;name&gt;</code> に作成されます。",
      "new.name": "タイトル",
      "new.namePlaceholder": "マイ Bokeh アプリ",
      "new.nameHint":
        "サイドバーとタブに表示されます。空の場合はディレクトリ名を使用します。",
      "new.template": "テンプレート",
      "new.blank": "空白",
      "new.blankHint":
        "最小限の Bokeh ページです。カスタムアプリの出発点に適しています。",
      "new.interactive": "インタラクティブ",
      "new.interactiveHint":
        "スライダーとサーバー側コールバックを備えた正弦波プロットです。",
      "new.start": "すぐに起動",
      "new.creating": "作成中…",
      "new.created": "「{title}」を作成しました。",
      "new.invalidName":
        "英数字、アンダースコア、ハイフンを使用し、英数字で始めてください。",

      "metadata.title": "サーバー情報 · {title}",
      "metadata.warningTitle": "server.json の確認が必要です。",
      "metadata.warningBody":
        "{error} このフォームを保存すると有効なメタデータで置き換えます。",
      "metadata.titleField": "タイトル",
      "metadata.titleHint":
        "サイドバーとタブで使用します。空の場合はディレクトリ名を使用します。",
      "metadata.description": "説明",
      "metadata.descriptionHint":
        "サーバータイトルの下に表示される短い説明です。",
      "metadata.usage": "使い方",
      "metadata.usageHint":
        "このダイアログに表示されます。プレーンテキストで、改行は保持されます。",
      "metadata.directory": "ディレクトリ：",
      "metadata.savedTo": "server.json に保存",
      "metadata.saving": "保存中…",
      "metadata.saved": "サーバー情報を保存しました。",

      "editor.loading": "読み込み中…",
      "editor.subtitle": "Bokeh ソースエディター",
      "editor.noFile": "ファイルが開かれていません",
      "editor.autoBadge": "自動",
      "editor.metaBadge": "メタ",
      "editor.autoTitle": "サーバー起動時にマネージャーが生成",
      "editor.metaTitle": "サーバー情報ダイアログで編集",
      "editor.unsavedTitle": "未保存の変更",
      "editor.refreshTree": "ファイルツリーを更新",
      "editor.save": "保存",
      "editor.files": "ファイル",
      "editor.loadingFiles": "ファイルを読み込み中…",
      "editor.selectFile": "ファイルを選択",
      "editor.selectFileHint":
        "ファイルツリーからファイルを選択して編集を開始してください。",
      "editor.lncol": "{line} 行、{col} 列",
      "editor.selected": "{count} 文字選択中",
      "editor.plainText": "プレーンテキスト",
      "editor.utf8": "UTF-8",
      "editor.ctrlSave": "Ctrl+S で保存",
      "editor.ready": "準備完了",
      "editor.saving": "保存中…",
      "editor.unsaved": "未保存",
      "editor.saved": "保存済み",
      "editor.saveFailed": "保存に失敗",
      "editor.filesCount": "{count} ファイル · {name}",
      "editor.couldNotLoadFiles": "ファイルを読み込めません",
      "editor.discard": "「{path}」の未保存の変更を破棄しますか？",
      "editor.openFailed": "ファイルを開けません：{error}",
      "editor.openErrorTitle": "このファイルを開けません。",
      "editor.saveSuccess": "{path} を保存しました。",
      "editor.generatedWarning":
        "この生成テーマファイルは、次回のサーバー起動時にマネージャーによって置き換えられます。",
      "editor.saveError": "保存に失敗しました：{error}",
      "editor.treeError": "ファイルツリーを読み込めません：{error}",
      "editor.serverUnavailable": "サーバーを利用できません",
      "editor.unknownServer": "不明なサーバー",
      "editor.serverLoadError": "このサーバーを読み込めません。\n{error}",
      "editor.noServerSelected": "サーバーが選択されていません",
      "editor.noServerSubtitle": "マネージャーからエディターを開いてください",
      "editor.noServerError":
        "サーバーが選択されていません。マネージャーの「サーバー情報」または「ソースを編集」から開いてください。",
      "editor.noServer": "サーバーなし",

      "common.cancel": "キャンセル",
      "common.close": "閉じる",
      "common.save": "保存",
      "common.refresh": "更新",
      "common.copy": "コピー",
      "common.create": "作成",
      "common.loading": "読み込み中…",
      "language.label": "言語",
    },
  };

  function normalizeLanguage(value) {
    const raw = String(value || "").toLowerCase();
    if (raw === "zh" || raw.startsWith("zh-")) return "zh-CN";
    if (raw === "ja" || raw.startsWith("ja-")) return "ja";
    if (raw === "en" || raw.startsWith("en-")) return "en";
    return "en";
  }

  function detectLanguage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return normalizeLanguage(saved);
    } catch {
      // Ignore storage errors and use the browser language.
    }
    const languages = navigator.languages?.length
      ? navigator.languages
      : [navigator.language || "en"];
    for (const language of languages) {
      const normalized = normalizeLanguage(language);
      if (SUPPORTED.includes(normalized)) return normalized;
    }
    return "en";
  }

  let current = detectLanguage();
  document.documentElement.lang = current;

  function t(key, vars = {}) {
    const value =
      messages[current]?.[key] ?? messages.en[key] ?? key;
    return String(value).replace(/\{(\w+)\}/g, (_, name) =>
      vars[name] === undefined || vars[name] === null ? "" : String(vars[name]),
    );
  }

  function setLanguage(language) {
    current = normalizeLanguage(language);
    document.documentElement.lang = current;
    try {
      localStorage.setItem(STORAGE_KEY, current);
    } catch {
      // Ignore storage errors; the current page still updates.
    }
    return current;
  }

  function applyTranslations(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });
    root.querySelectorAll("[data-i18n-html]").forEach((node) => {
      node.innerHTML = t(node.dataset.i18nHtml);
    });
    root.querySelectorAll("[data-i18n-title]").forEach((node) => {
      node.title = t(node.dataset.i18nTitle);
    });
    root.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
      node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
      node.placeholder = t(node.dataset.i18nPlaceholder);
    });
  }

  window.BSM_I18N = {
    t,
    setLanguage,
    getLanguage: () => current,
    applyTranslations,
    normalizeLanguage,
  };
})();
