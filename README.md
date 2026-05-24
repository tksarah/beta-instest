# InstantTest Beta

InstantTest Beta は、教師がクラスを作成し、テストを配布し、生徒がブラウザで受験できる軽量な SaaS 向けアプリケーションです。Node.js と SQLite を中心に構成されており、ローカル実行から Docker Compose を使ったベータ運用まで同じコードベースで扱えます。

このリポジトリは、補助ドキュメントやサンプル資産を整理し、実行に必要なコードと最低限の運用補助だけを残した状態です。README 単体で起動方法、構成、環境変数、運用上の前提が分かるように再構成しています。

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

## クイックスタート

### ローカル実行

前提:

- Node.js 16 以上
- npm

手順:

```bash
cd server
npm install
copy .env.example .env
node index.js
```

PowerShell で環境変数を直接渡す例:

```powershell
cd server
npm install
$env:ADMIN_PASSWORD="replace_with_strong_admin_password"
$env:SESSION_SECRET="replace_with_random_session_secret"
node index.js
```

起動後のアクセス先:

- ルート: http://localhost:3000
- 教師画面: http://localhost:3000/app.html
- ログイン画面: http://localhost:3000/login.html

ローカル実行では SQLite ファイルは通常 server/data.sqlite に作成されます。

### Docker Compose で起動

ルート直下の .env を用意してから起動します。

```bash
docker compose up -d
```

補助スクリプトを使う場合:

```bash
./run.sh up
```

Compose 構成の要点:

- app サービスが Node.js アプリを起動する
- caddy サービスは proxy プロファイル利用時のみ起動する
- 永続データは data ディレクトリへ保存する
- アップロード画像は uploads ディレクトリへ保存する

Docker 実行時は SQLITE_DB_PATH=/data/data.sqlite が設定されるため、DB は data/data.sqlite に保存されます。

## 環境変数

### 必須

| 変数名 | 用途 |
| --- | --- |
| PORT | HTTP ポート。通常は 3000 |
| ADMIN_PASSWORD | 管理用パスワード |
| SESSION_SECRET | セッション署名に使う秘密値 |

### AI 連携

| 変数名 | 用途 |
| --- | --- |
| GEMINI_API_KEY | Gemini API 利用時に必要 |
| GEMINI_MODEL | 利用モデル名。既定値は gemini-2.5-flash-lite |

### Google OAuth

| 変数名 | 用途 |
| --- | --- |
| GOOGLE_CLIENT_ID | Google OAuth クライアント ID |
| GOOGLE_CLIENT_SECRET | Google OAuth クライアントシークレット |
| GOOGLE_REDIRECT_URI | Google OAuth コールバック URL |

### ベータ運用・公開設定

| 変数名 | 用途 |
| --- | --- |
| DOMAIN | 公開ドメイン名 |
| APP_BASE_URL | ベース URL |
| BETA_FEEDBACK_URL | フィードバック導線 |
| FREE_BETA_CLASS_LIMIT | 無料ベータのクラス数上限 |
| FREE_BETA_TEST_LIMIT | 無料ベータのテスト数上限 |
| FREE_BETA_STUDENT_LIMIT | 無料ベータの生徒数上限 |
| FREE_BETA_AI_GENERATION_LIMIT | 月間 AI 生成回数上限 |

値のひな形はルートの .env.example にまとまっています。

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
`- backup.sh              # バックアップ補助
```

## 認証とデータ保存

- 教師ログインは teacher_session Cookie で管理されます
- 生徒の受験状態も署名付き Cookie で管理されます
- 管理 API は x-admin-password ヘッダと ADMIN_PASSWORD で保護されます
- 設問画像は uploads 配下に保存されます
- ローカル DB は server/data.sqlite、Compose 運用では data/data.sqlite を使用します

## テストと保守スクリプト

本格的なテストランナーは未導入ですが、確認用スクリプトが server 配下にあります。

例:

```bash
cd server
node test_api.js
node test_student_flow.js
node test_beta_saas_api.js
```

保守系スクリプト:

- server/scripts/backfill_sessions.js
- server/scripts/clear_attempts.js
- server/scripts/dump_exams.js
- server/scripts/fix_sessions.js
- server/scripts/insert_sample_reports.js
- server/scripts/simulate_test_flow.js

運用データに対して直接実行する前に、ローカルまたはステージング環境で内容を確認してください。

## デプロイの考え方

- 単体開発や検証は server を直接起動する
- ベータ公開は docker-compose.yml を基準に app を常駐化する
- HTTPS 終端が必要な場合は Caddy を proxy プロファイル付きで起動する
- 永続ボリュームとして data、uploads、backups を利用する

最小のローカルプロキシ設定は caddy/Caddyfile で localhost から app:3000 へ転送する構成です。公開前にはドメイン、TLS、Cookie Secure 条件、OAuth リダイレクト先を環境に合わせて調整してください。

## ベータ運用上の注意

- これは SaaS ベータ段階のアプリであり、本番 SaaS としては追加の監査と保護が必要です
- レート制限、監査ログ、通知、監視、障害対応手順は別途整備してください
- SQLite は軽量ですが、高頻度同時書き込みが増える運用には不向きです
- Google OAuth と Gemini API を有効化する場合、公開 URL と秘密情報の管理を必ず見直してください

## 補足

- 旧ドキュメント群は削除し、この README に必要事項を統合しています
- 生成物やサンプルテーマはリポジトリから除外し、SaaS 本体に必要な構成へ寄せています
