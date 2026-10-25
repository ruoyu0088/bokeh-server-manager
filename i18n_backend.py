"""Small backend translation layer for user-facing manager errors.

The Bokeh process logs are intentionally left untouched.  Only messages that
the manager itself creates are translated.
"""

from __future__ import annotations

import re

SUPPORTED_LANGUAGES = ("en", "zh-CN", "ja")

EXACT = {
    "Invalid server name.": (
        "服务器名称无效。",
        "サーバー名が無効です。",
    ),
    "Server names may contain only letters, numbers, underscores, or hyphens, and must start with a letter or number.": (
        "服务器名称只能包含字母、数字、下划线或连字符，并且必须以字母或数字开头。",
        "サーバー名には英数字、アンダースコア、ハイフンのみを使用でき、英数字で始める必要があります。",
    ),
    "The server directory is outside the servers directory.": (
        "服务器目录不在 servers 目录内。",
        "サーバーディレクトリが servers ディレクトリの外にあります。",
    ),
    "Invalid file path.": (
        "文件路径无效。",
        "ファイルパスが無効です。",
    ),
    "File path escapes the server directory.": (
        "文件路径越出了服务器目录。",
        "ファイルパスがサーバーディレクトリの外を指しています。",
    ),
    "File not found.": (
        "文件不存在。",
        "ファイルが見つかりません。",
    ),
    "File is too large. The editor supports files up to 2 MB.": (
        "文件过大，编辑器最多支持 2 MB。",
        "ファイルが大きすぎます。エディターは最大 2 MB まで対応しています。",
    ),
    "This is a binary file and cannot be opened in the text editor.": (
        "这是二进制文件，无法用文本编辑器打开。",
        "バイナリファイルのため、テキストエディターでは開けません。",
    ),
    "File contents must be text.": (
        "文件内容必须是文本。",
        "ファイルの内容はテキストである必要があります。",
    ),
    "The target is not a regular file.": (
        "目标不是普通文件。",
        "対象が通常のファイルではありません。",
    ),
    "A file or directory with this path already exists.": (
        "该路径下已存在文件或目录。",
        "このパスにはファイルまたはディレクトリがすでに存在します。",
    ),
    "Only files can be deleted.": (
        "只能删除文件。",
        "削除できるのはファイルのみです。",
    ),
    "server.json is too large (limit: 64 KB).": (
        "server.json 过大（上限 64 KB）。",
        "server.json が大きすぎます（上限 64 KB）。",
    ),
    "Metadata must be a JSON object.": (
        "元信息必须是 JSON 对象。",
        "メタデータは JSON オブジェクトである必要があります。",
    ),
    "Unknown server template.": (
        "未知的服务器模板。",
        "不明なサーバーテンプレートです。",
    ),
    "Theme must be either light or dark.": (
        "主题只能是 light 或 dark。",
        "テーマは light または dark である必要があります。",
    ),
    "Unknown theme.": (
        "未知的主题。",
        "不明なテーマです。",
    ),
    "Server is not available.": (
        "服务器不可用。",
        "サーバーを利用できません。",
    ),
    "Bokeh server startup timed out.": (
        "Bokeh 服务启动超时。",
        "Bokeh サーバーの起動がタイムアウトしました。",
    ),
    "The Bokeh process exited. Check the logs.": (
        "Bokeh 进程已退出，请查看日志。",
        "Bokeh プロセスが終了しました。ログを確認してください。",
    ),
    "Server startup timed out.": (
        "服务器启动超时。",
        "サーバーの起動がタイムアウトしました。",
    ),
    "The server process exited. Check the logs.": (
        "服务器进程已退出，请查看日志。",
        "サーバープロセスが終了しました。ログを確認してください。",
    ),
    "Missing main.py, the entry point for a Bokeh directory application.": (
        "缺少 Bokeh 目录应用入口 main.py。",
        "Bokeh ディレクトリアプリのエントリーポイント main.py がありません。",
    ),
    "Missing main.py, the application entry point.": (
        "缺少应用入口 main.py。",
        "アプリケーションのエントリーポイント main.py がありません。",
    ),
    "This directory is not a valid Bokeh directory application.": (
        "这个目录不是有效的 Bokeh 目录应用。",
        "このディレクトリは有効な Bokeh ディレクトリアプリではありません。",
    ),
    "server.json is not a regular file.": (
        "server.json 不是普通文件。",
        "server.json が通常のファイルではありません。",
    ),
    "server.json contains binary data.": (
        "server.json 包含二进制数据。",
        "server.json にバイナリデータが含まれています。",
    ),
}

PATTERNS = (
    (
        re.compile(r'^"(.+)" is a reserved name\. Choose another one\.$'),
        '“{0}”是保留名称，请换一个。',
        "「{0}」は予約名です。別の名前を指定してください。",
    ),
    (
        re.compile(r'^Server "(.+)" does not exist\.$'),
        "服务器“{0}”不存在。",
        "サーバー「{0}」は存在しません。",
    ),
    (
        re.compile(r'^Server "(.+)" already exists\.$'),
        "服务器“{0}”已存在。",
        "サーバー「{0}」はすでに存在します。",
    ),
    (
        re.compile(r'^Metadata field "(.+)" must be a string\.$'),
        "元信息字段“{0}”必须是字符串。",
        "メタデータフィールド「{0}」は文字列である必要があります。",
    ),
    (
        re.compile(r'^server\.json field "(.+)" must be a string\.$'),
        "server.json 字段“{0}”必须是字符串。",
        "server.json のフィールド「{0}」は文字列である必要があります。",
    ),
    (
        re.compile(r"^Could not read directory: (.+)$"),
        "无法读取目录：{0}",
        "ディレクトリを読み込めません：{0}",
    ),
    (
        re.compile(r"^Could not read file: (.+)$"),
        "无法读取文件：{0}",
        "ファイルを読み込めません：{0}",
    ),
    (
        re.compile(r"^Could not save file: (.+)$"),
        "无法保存文件：{0}",
        "ファイルを保存できません：{0}",
    ),
    (
        re.compile(r"^Could not create file: (.+)$"),
        "无法创建文件：{0}",
        "ファイルを作成できません：{0}",
    ),
    (
        re.compile(r"^Could not delete file: (.+)$"),
        "无法删除文件：{0}",
        "ファイルを削除できません：{0}",
    ),
    (
        re.compile(r"^Could not save server\.json: (.+)$"),
        "无法保存 server.json：{0}",
        "server.json を保存できません：{0}",
    ),
    (
        re.compile(r"^Could not write theme files: (.+)$"),
        "无法写入主题文件：{0}",
        "テーマファイルを書き込めません：{0}",
    ),
    (
        re.compile(r"^Could not start the Bokeh process: (.+)$"),
        "无法启动 Bokeh 进程：{0}",
        "Bokeh プロセスを起動できません：{0}",
    ),
    (
        re.compile(r"^Could not start the server process: (.+)$"),
        "无法启动服务器进程：{0}",
        "サーバープロセスを起動できません：{0}",
    ),
    (
        re.compile(r"^Bokeh process failed to start \(exit code (\d+)\)\.$"),
        "Bokeh 进程启动失败（退出码 {0}）。",
        "Bokeh プロセスの起動に失敗しました（終了コード {0}）。",
    ),
    (
        re.compile(r"^Server process failed to start \(exit code (\d+)\)\.$"),
        "服务器进程启动失败（退出码 {0}）。",
        "サーバープロセスの起動に失敗しました（終了コード {0}）。",
    ),
    (
        re.compile(r'^Unsupported framework: "(.+)"\. Use "bokeh" or "panel"\.$'),
        "不支持的框架：“{0}”。请使用 bokeh 或 panel。",
        "サポートされていないフレームワークです：「{0}」。bokeh または panel を使用してください。",
    ),
    (
        re.compile(r'^Unsupported framework in server\.json: "(.+)"\. Use "bokeh" or "panel"\.$'),
        "server.json 中的框架不受支持：“{0}”。请使用 bokeh 或 panel。",
        "server.json のフレームワークがサポートされていません：「{0}」。bokeh または panel を使用してください。",
    ),
    (
        re.compile(r"^Missing theme file: (.+)$"),
        "缺少主题文件：{0}",
        "テーマファイルがありません：{0}",
    ),
    (
        re.compile(r"^server\.json is not valid JSON: (.+)$"),
        "server.json 不是有效的 JSON：{0}",
        "server.json が有効な JSON ではありません：{0}",
    ),
)


def normalize_language(value: str | None) -> str:
    raw = str(value or "").strip().lower()
    if raw == "zh" or raw.startswith("zh-"):
        return "zh-CN"
    if raw == "ja" or raw.startswith("ja-"):
        return "ja"
    return "en"


def _translate_prefix(message: str, language: str) -> str:
    if language == "en":
        return message
    if message in EXACT:
        zh, ja = EXACT[message]
        return zh if language == "zh-CN" else ja
    for pattern, zh, ja in PATTERNS:
        match = pattern.match(message)
        if match:
            template = zh if language == "zh-CN" else ja
            return template.format(*match.groups())
    return message


def translate_error(message: str, language: str) -> str:
    """Translate the manager-created part while preserving appended logs."""
    language = normalize_language(language)
    if language == "en" or not message:
        return message
    prefix, separator, log = message.partition("\n\n")
    translated = _translate_prefix(prefix, language)
    return translated + (separator + log if separator else "")
