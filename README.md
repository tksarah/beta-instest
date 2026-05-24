# InstantTest Beta

InstantTest Beta は、教師がクラスを作成し、テストを配布し、生徒がブラウザで受験できる軽量な SaaS 向けアプリケーションです。Node.js と SQLite を中心に構成されており、ローカル実行と Docker Compose 運用の両方を同じコードベースで扱えます。

## できること

- 教師アカウントでログインし、クラスを作成する
- テストと設問を作成し、クラスへ配布する
- 生徒がクラスコード経由で参加し、ブラウザから受験する
- 正誤、集計、公開設定、アーカイブ、テストセット管理を行う
- Gemini API を使って問題生成を補助する
- 画像付きの設問コンテンツをアップロードして扱う
- Google OAuth を使った教師ログインを有効化する

## 技術スタック

- バックエンド: Node.js, Express
- データベース: SQLite
- フロントエンド: 静的 HTML, CSS, JavaScript
- AI 連携: Google Gemini API
- 認証: HttpOnly Cookie ベースの教師セッション
- 配備: Docker Compose, Caddy

## 起動方法

### Docker Compose で起動する方法

本番相当の起動は Docker Compose を使う方法を推奨します。ルート直下の [.env.example](.env.example) を元に [.env](.env) を用意してから起動してください。

```bash
docker compose up -d
```

補助スクリプトを使う場合は [run.sh](run.sh) からも起動できます。

```bash
./run.sh up
```

Compose 構成の要点:

- `app` サービスが Node.js アプリを起動する
- `caddy` サービスは `proxy` プロファイル利用時のみ起動する
- 永続データは `data` ディレクトリへ保存する
- アップロード画像は `uploads` ディレクトリへ保存する

Compose 実行時は `SQLITE_DB_PATH=/data/data.sqlite` が渡されるため、DB は `data/data.sqlite` に保存されます。

起動後のアクセス先:

- ルート: http://localhost:3000
- 教師画面: http://localhost:3000/app.html
- ログイン画面: http://localhost:3000/login.html

### ローカル開発で起動する方法

Node から直接起動する場合は、`server/.env.example` を元に `server/.env` を作成してから起動します。

```bash
cd server
npm install
cp .env.example .env
npm start
```

PowerShell で環境変数を直接渡す例:

```powershell
cd server
npm install
$env:ADMIN_PASSWORD="replace_with_strong_admin_password"
$env:SESSION_SECRET="replace_with_random_session_secret"
npm start
```

ローカル実行では SQLite ファイルは既定で `server/data.sqlite` に作成されます。`SQLITE_DB_PATH` を指定すると保存先を変更できます。

## 環境変数

このリポジトリでは、ルート直下の [.env.example](.env.example) は Docker Compose 用、[server/.env.example](server/.env.example) はローカル直起動用のひな形として使います。

### 必須

| 変数名 | 用途 |
| --- | --- |
| `PORT` | HTTP ポート。既定は `3000` |
| `ADMIN_PASSWORD` | 管理 API と管理画面の保護に使うパスワード |
| `SESSION_SECRET` | 教師セッション署名に使う秘密値 |

### 任意だが推奨

| 変数名 | 用途 |
| --- | --- |
| `STUDENT_SESSION_SECRET` | 生徒セッション署名用の秘密値。未設定時は `SESSION_SECRET` または `ADMIN_PASSWORD` にフォールバックする |
| `APP_BASE_URL` | 公開 URL。Cookie の Secure 判定や OAuth リダイレクトの基準に使う |
| `DOMAIN` | 公開ドメイン名。運用時の記入メモとして使う |
| `GEMINI_MODEL` | 利用する Gemini モデル名。既定は `gemini-2.5-flash-lite` |
| `BETA_FEEDBACK_URL` | フィードバック導線の URL |
| `FREE_BETA_CLASS_LIMIT` | free_beta プランのクラス数上限 |
| `FREE_BETA_TEST_LIMIT` | free_beta プランのテスト数上限 |
| `FREE_BETA_STUDENT_LIMIT` | free_beta プランの生徒数上限 |
| `FREE_BETA_AI_GENERATION_LIMIT` | free_beta プランの月間 AI 生成回数上限 |

### Gemini 連携

| 変数名 | 用途 |
| --- | --- |
| `GEMINI_API_KEY` | Gemini API 利用時に必要 |

### Google OAuth

| 変数名 | 用途 |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google OAuth クライアント ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth クライアントシークレット |
| `GOOGLE_REDIRECT_URI` | Google OAuth コールバック URL |

### データ保存

| 変数名 | 用途 |
| --- | --- |
| `SQLITE_DB_PATH` | SQLite ファイルの保存先。Docker Compose では `/data/data.sqlite`、ローカルでは未設定でも動作する |

free_beta の実運用上限は、初回起動後に管理画面の「プランごとの利用上限」から更新できます。

## ディレクトリ構成

```text
.
|- server/
|  |- index.js            # Express アプリ本体
|  |- db.js               # SQLite 初期化とマイグレーション相当の処理
|  |- geminiAi.js         # Gemini 連携
|  |- mockAi.js           # ローカル検証用のモック
|  |- public/             # 配信する画面一式
|  |- scripts/            # 保守・補助スクリプト
|  |- test_*.js           # API / フロー確認スクリプト
|  `- Dockerfile          # app イメージ定義
|- caddy/
|  `- Caddyfile           # リバースプロキシ設定
|- backups/               # バックアップ保存先
|- data/                  # Compose 運用時の SQLite 永続化先
|- uploads/               # 設問画像などのアップロード保存先
|- docker-compose.yml     # app + caddy の構成
|- run.sh                 # compose 起動補助
`- .env.example           # Compose 用の環境変数ひな形
```

## 認証とデータ保存

- 教師ログインは teacher_session Cookie で管理されます
- 生徒の受験状態も署名付き Cookie で管理されます
- 管理 API は `x-admin-password` ヘッダと `ADMIN_PASSWORD` で保護されます
- 設問画像は `uploads` 配下に保存されます
- ローカル DB は `server/data.sqlite`、Compose 運用では `data/data.sqlite` を使用します

## テストと保守スクリプト

本格的なテストランナーは未導入ですが、確認用スクリプトが `server` 配下にあります。

例:

```bash
cd server
node test_api.js
node test_student_flow.js
node test_beta_saas_api.js
```

保守系スクリプト:

- `server/scripts/backfill_sessions.js`
- `server/scripts/clear_attempts.js`
- `server/scripts/dump_exams.js`
- `server/scripts/fix_sessions.js`
- `server/scripts/insert_sample_reports.js`
- `server/scripts/simulate_test_flow.js`

運用データに対して直接実行する前に、ローカルまたはステージング環境で内容を確認してください。

## デプロイの考え方

- 単体開発や検証は `server` を直接起動する
- ベータ公開は `docker-compose.yml` を基準に `app` を常駐化する
- HTTPS 終端が必要な場合は `caddy` を `proxy` プロファイル付きで起動する
- 永続ボリュームとして `data`、`uploads`、`backups` を利用する

最小のローカルプロキシ設定は `caddy/Caddyfile` で localhost から `app:3000` へ転送する構成です。公開前にはドメイン、TLS、Cookie Secure 条件、OAuth リダイレクト先を環境に合わせて調整してください。

## ベータ運用上の注意

- これは SaaS ベータ段階のアプリであり、本番 SaaS としては追加の監査と保護が必要です
- レート制限、監査ログ、通知、監視、障害対応手順は別途整備してください
- SQLite は軽量ですが、高頻度同時書き込みが増える運用には不向きです
- Google OAuth と Gemini API を有効化する場合、公開 URL と秘密情報の管理を必ず見直してください
