[English](README.md) | [简体中文](README.zh-CN.md) | **日本語**

# Bokeh サーバーマネージャー

![Bokeh サーバーマネージャー](docs/screenshot.png)

複数の Bokeh / Panel Server アプリケーションを一か所で実行・管理するためのローカル Web インターフェースです。

各アプリケーションは独立した Bokeh または Panel プロセスで動作します。マネージャーは起動のたびに空きポートを自動割り当てし、実行中のアプリを iframe タブに埋め込み、別ウィンドウでソースエディターを提供します。

## 機能

- 多言語 UI：英語、簡体字中国語、日本語。
- マネージャーのポートとバインドアドレスを設定可能。必要に応じて LAN アクセスを有効化。
- 折りたたみ・幅変更可能なサイドバー。`Ctrl+B`（または `Cmd+B`）で開閉。
- Bokeh または Panel サーバーごとに独立したプロセスと自動割り当てポート。
- 複数の実行中サーバーをタブで表示。各タブは iframe。
- 起動、再読み込み、停止、ソース編集、メタデータ編集、ログ表示、新しいウィンドウで開く。
- 空白またはインタラクティブなテンプレートから新しい Bokeh / Panel サーバーを作成。
- マネージャー、エディター、Bokeh / Panel ページのライト / ダークテーマ。
- ファイルツリー、シンタックスハイライト、ファイルの作成・削除、`Ctrl+S` 保存を備えたソースエディター。
- Bokeh / Panel `--dev` によるライブリロード。Bokeh プロセスの再起動後に iframe を更新し、Panel はその場でページを更新。
- サーバーごとのメタデータ：タイトル、説明、使い方。
- すぐに実行できる 3 つのサンプル（Panel アプリを含む）。

## 言語

サイドバー下部の言語セレクターで、英語・簡体字中国語・日本語を切り替えられます。

- 初期言語はブラウザー言語に従います（`zh*` は簡体字中国語、`ja*` は日本語、それ以外は英語）。
- 選択内容はブラウザーに保存され、再読み込み後も維持されます。
- マネージャーと開いているエディターは即座に更新されます。開いているファイルや未保存の変更は失われません。
- iframe 内の Bokeh アプリの内容は翻訳されません。
- `server.json` のメタデータは入力されたまま表示され、翻訳されません。

## 必要環境

- Windows、プロジェクト環境は `C:\pixi_env\.pixi\envs\default\python.exe`
- Python 3.14
- `requirements.txt` の依存関係：
  - `bokeh>=3.9,<4`
  - `panel>=1.9,<2`
  - `flask>=3.1,<4`
  - `psutil>=7,<8`
  - `PyYAML>=6,<7`
  - `watchfiles>=1.3,<2`（Panel の `--dev` リロード用）

この環境の Bokeh / Panel プロセスには `MKL_THREADING_LAYER=TBB` が必要です。`start.bat` が自動設定します。

## クイックスタート

`start.bat` をダブルクリックすると既定値（`127.0.0.1:8010`）で起動します。

ブラウザーが自動で開きます。

ポートやバインドアドレスを変更する場合：

```bat
start.bat --port 8080
start.bat --port 8010 --host 127.0.0.1
start.bat --port 8010 --host 0.0.0.0
```

- `--port` の既定値は `8010`。
- `--host` の既定値は `127.0.0.1`。
- `--host 0.0.0.0` を指定すると、LAN 内の他のコンピューターからアクセスできます。
- `start.bat --help` で利用可能なオプションを表示します。

手動で起動する場合：

```bat
set MKL_THREADING_LAYER=TBB
set BSM_HOST=127.0.0.1
set BSM_PORT=8010
C:\pixi_env\.pixi\envs\default\python.exe -u app.py
```

`0.0.0.0` にバインドした場合、別のコンピューターから `http://<このコンピューターのIP>:8010` を開きます。マネージャーはブラウザーが使用したホスト名/IP を iframe の URL に使用し、子プロセスもすべてのインターフェースにバインドします。

Windows ファイアウォールで、プライベートネットワーク上の Python、マネージャーポート、自動割り当てされる Bokeh / Panel ポートへのアクセスを許可する必要がある場合があります。

## サーバーディレクトリの規約

各アプリケーションは独立したサブディレクトリに配置します：

```text
servers/
  my_app/
    main.py          # 必須：Bokeh または Panel アプリのエントリーポイント
    server.json      # 任意：タイトル / 説明 / 使い方 / framework
    other files...   # データ、モジュール、静的ファイルなど
```

マネージャーは `servers/` 下のディレクトリを自動検出します。`main.py` がないディレクトリも一覧に表示されますが、起動できません。

Bokeh では `main.py` は `curdoc()` を使うディレクトリアプリ、Panel では `.servable()` で終わる単一ファイルの Panel スクリプトです。フレームワークはサーバー作成時に選択され、`server.json` に保存されます。

Bokeh サーバーの起動時、マネージャーは次のファイルを生成します（Git では無視されます）：

- `theme.yaml`：選択したライト / ダークテーマに対応する Bokeh モデルテーマ。
- `templates/index.html`：Bokeh テーマに合わせたページ背景。

Panel サーバーは Panel 自身のテンプレートを使い、テーマは URL クエリパラメーターで渡されます。マネージャーは Panel 用の Bokeh テーマファイルを生成しません。

生成された Bokeh ファイルは起動のたびに書き換えられるため、編集せず、マネージャーのテーマまたはアプリのコードを変更してください。

## Panel アプリ

Panel は第一級のサーバータイプとしてサポートされています。**新規** ダイアログで **Panel** を選択するか、`server.json` に設定します：

```json
{
  "framework": "panel"
}
```

Panel アプリは単一ファイルの `main.py` スクリプトです。マネージャーのテーマを反映するため、標準テンプレートの使用を推奨します：

```python
import panel as pn

pn.extension()

template = pn.template.FastListTemplate(
    title="My Panel App",
    main=[pn.pane.Markdown("## Hello from Panel")],
)
template.servable()
```

マネージャーは Panel を次のコマンドで起動します：

```text
python -m panel serve --dev ... servers/<name>/main.py
```

- アプリの URL は `/main`。
- Panel はソース変更をその場でリロードするため、プロセス ID による iframe 更新は不要です。
- 現在のマネージャーテーマは `?theme=default`（ライト）または `?theme=dark`（ダーク）として渡されます。Panel の標準テンプレートはこのパラメーターに従います。
- 標準テンプレートを使わない素の Panel スクリプトでは、ページテーマが適用されない場合があります。
- Panel のマルチページアプリと Notebook は未対応です。サーバーごとに 1 つの `main.py` を使用してください。

## メタデータ

各サーバーには `server.json` を置けます：

```json
{
  "title": "My App",
  "description": "サイドバーに表示する短い説明。",
  "usage": "使い方。改行は保持されます。",
  "framework": "panel"
}
```

- `title`：サイドバーとタブのタイトルに使用。空の場合はディレクトリ名。
- `description`：サーバータイトルの下に表示。
- `usage`：**サーバー情報** ダイアログに表示。
- `framework`：`"bokeh"` または `"panel"`。省略時は `"bokeh"`。
- メタデータは翻訳されず、入力されたまま表示されます。
- 未知の JSON キーは保持されます。
- サーバーカードの情報ボタンから、JSON を直接編集せずにタイトル・説明・使い方を変更できます。フレームワークは読み取り専用で表示され、サーバー作成時に選択します。
- `server.json` が不正な場合も UI に警告が出るだけで、サーバーの起動は妨げられません。

## テーマの動作

- マネージャーとエディターはライト / ダークを即座に切り替えます。
- Bokeh / Panel サーバーは起動時のテーマを維持します。実行中にその場でテーマは変わりません。
- Bokeh の場合、起動または再読み込み時に現在のマネージャーテーマを `theme.yaml` とページテンプレートに書き込みます。
- Panel の場合、テーマは iframe URL の `?theme=default` または `?theme=dark` として渡され、標準 Panel テンプレートが適用します。
- 実行中のサーバーに新しいテーマを適用するには **再読み込み** をクリックします。
- サーバーカードに、実行中のプロセスが使用しているテーマが表示されます。

## ライブリロード

Bokeh サーバーは次のコマンドで起動します：

```text
python -m bokeh serve --dev ...
```

Bokeh はアプリケーションディレクトリを監視します。ソースファイルを保存すると：

1. Bokeh がサーバープロセスを再起動します。
2. マネージャーが次の状態ポーリングで新しいプロセス ID を検出します。
3. 開いている iframe を更新し、BokehJS をクリーンに再接続します。

これにより、WebSocket の再接続だけで発生する BokehJS の古いモデル参照エラーを避けられます。

Panel サーバーは次のコマンドで起動します：

```text
python -m panel serve --dev ...
```

Panel の `--dev` モードはアプリをリロードし、開いているページをその場で更新します。プロセス ID は変わらない場合があるため、マネージャーは追加の iframe 更新を行いません。`watchfiles` を推奨しており、`requirements.txt` に含まれています。

## ソースエディター

サーバーカードの鉛筆ボタンをクリックすると、別ウィンドウでエディターが開きます。

- 左側：そのサーバーディレクトリの完全なファイルツリー。
- 右側：Python、HTML、CSS、JavaScript、JSON、YAML、Markdown に対応した CodeMirror エディター。
- **+** ボタンでファイルを作成できます。`lib/helpers.py` のようなネストしたパスにも対応し、サブディレクトリは自動作成されます。
- ゴミ箱ボタンで現在開いているファイルを削除できます。削除前に確認があります。
- `Ctrl+S` で現在のファイルを保存。
- 未保存の変更を表示し、ファイル切り替えやウィンドウを閉じる前に確認します。
- `theme.yaml` と `templates/index.html` は `AUTO`、`server.json` は `META` と表示されます。
- エディターはマネージャーのライト / ダークテーマと言語に従います。

## サーバーの作成

サイドバーの **新規** をクリックします。

- ディレクトリ名には英数字、アンダースコア、ハイフンを使用できます。
- フレームワークとして **Bokeh** または **Panel** を選択します。
- **空白** で最小限のページ、**インタラクティブ** でウィジェット、プロット、サーバー側コールバックを備えたアプリを作成します。
- 生成されるコードは選択したフレームワークに従います：Bokeh ディレクトリアプリ、または `FastListTemplate` を使う単一ファイルの Panel スクリプト。
- タイトルはディレクトリ名が既定値で、後から **サーバー情報** ダイアログで変更できます。
- **すぐに起動** をチェックしない限り、新しいサーバーは停止状態です。

## サンプル

3 つのサンプルが含まれています：

- **Sine Wave Lab**（`servers/sine_wave`）：波形、周波数、振幅、速度、位相を調整できるアニメーション Bokeh 正弦波。
- **Scatter Explorer**（`servers/scatter_dashboard`）：カテゴリーフィルター、マーカーサイズ、回帰線、連動する Y ヒストグラムを備えた Bokeh 散布図。
- **Panel Demo**（`servers/panel_demo`）：`FastListTemplate`、サイドバーコントロール、リアルタイム Bokeh プロットを備えた Panel アプリ。

サイドバーから起動すると、テーマ切り替え、言語切り替え、`--dev` リロードを含む一連の流れを確認できます。

## API

マネージャーは小さなローカル JSON API を提供します：

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

起動、停止、再読み込み、メタデータのリクエストは JSON body を使用します。`POST /api/servers` は `"framework": "bokeh" | "panel"` を受け付けます。ファイルパスは対象サーバーディレクトリ内に制限されます。`X-BSM-Lang: en | zh-CN | ja` を送ると、マネージャーのエラーメッセージがローカライズされます。

## 注意事項

- 既定のバインドアドレスは `127.0.0.1` です。`--host 0.0.0.0` はマネージャーを LAN に公開します。
- マネージャーには認証がなく、ローカルファイルの編集やコード実行が可能です。信頼できるネットワークでのみ公開してください。
- マネージャーはローカル開発用ツールであり、本番デプロイ用サーバーではありません。
- LAN アクセスには、自動割り当てされる Bokeh / Panel ポートにも到達できる必要があります。
- `start.bat` は Python パス `C:\pixi_env\.pixi\envs\default\python.exe` を固定で使用します。環境が異なる場合は `PYTHON` を変更してください。
- 生成された Bokeh テーマファイルは Git で無視され、必要時に再生成されます。
- Panel は現在、単一ファイルの `main.py` のみ対応しています。Notebook やマルチページディレクトリアプリは未対応です。
