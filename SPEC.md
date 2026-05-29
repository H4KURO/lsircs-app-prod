# lsir-cs アプリケーション仕様書

> **メンテナンス注意**: このファイルはアプリ変更のたびに更新すること（CLAUDE.md 参照）。  
> 最終更新: 2026-05-29（キーワード検索機能追加）

---

## 目次

1. [概要](#1-概要)
2. [技術スタック](#2-技術スタック)
3. [プロジェクト構成](#3-プロジェクト構成)
4. [認証・アクセス制御](#4-認証アクセス制御)
5. [画面一覧](#5-画面一覧)
6. [タスク管理システム](#6-タスク管理システム)
7. [APIエンドポイント一覧](#7-apiエンドポイント一覧)
8. [データモデル](#8-データモデル)
9. [Cosmos DB コレクション](#9-cosmos-db-コレクション)
10. [外部連携](#10-外部連携)
11. [多言語対応](#11-多言語対応)
12. [デプロイ](#12-デプロイ)

---

## 1. 概要

**アプリ名**: lsir-cs  
**用途**: LIST Sotheby's International Realty 向け業務管理ツール  
**主な機能**:
- タスク管理（担当者・カテゴリ・サブタスク・添付ファイル）
- バイヤーリスト管理（Google Sheets 連携）
- Mahana Prospects（ハワイ物件見込み顧客管理）
- スプレッドシート閲覧（Google Sheets / Box 埋め込み）
- ホワイトリストによるアクセス制御
- Slack 通知・Slack コマンドからのタスク作成
- メール本文からのタスク自動生成（AI解析）
- PDF テキスト抽出

---

## 2. 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | React 19 + Vite, Material-UI v7, React Big Calendar, i18next, Axios |
| バックエンド | Azure Functions (Node.js 20) |
| データベース | Azure Cosmos DB (NoSQL) |
| ファイルストレージ | Azure Blob Storage |
| AI 解析 | n8n webhook 経由 Claude API（PDF抽出）|
| 通知 | Slack Web API |
| Google 連携 | Google Sheets API (OAuth 2.0) |
| デプロイ | Azure Static Web Apps + GitHub Actions |

---

## 3. プロジェクト構成

```
lsircs-app-prod/
├── api/                        # Azure Functions（バックエンド）
│   ├── *.js                    # 各 API エンドポイント
│   ├── index.js                # 全 .js ファイルを自動ロード
│   ├── cosmosClient.js         # Cosmos DB 接続ヘルパー
│   ├── assigneeUtils.js        # 担当者フィールド正規化
│   ├── attachmentUtils.js      # 添付ファイル処理
│   ├── subtaskUtils.js         # サブタスク正規化
│   ├── userProfileStore.js     # ユーザープロファイル CRUD
│   ├── googleSheetsClient.js   # Google Sheets API クライアント
│   ├── slackClient.js          # Slack API クライアント
│   └── taskViewPreferences.js  # タスクビュー設定ヘルパー
├── app/                        # React フロントエンド
│   └── src/
│       ├── App.jsx             # メインルーター・レイアウト
│       ├── *View.jsx           # 各画面コンポーネント
│       ├── *Modal.jsx          # モーダルコンポーネント
│       ├── taskUtils.js        # タスク正規化・ステータス定義
│       ├── theme.js            # MUI テーマ設定
│       └── locales/            # 翻訳ファイル（ja / en）
├── staticwebapp.config.json    # Azure SWA ルーティング設定
└── CLAUDE.md                   # Claude Code 向けプロジェクトルール
```

---

## 4. 認証・アクセス制御

### 4.1 認証フロー

1. `/.auth/me` エンドポイントから `clientPrincipal` を取得
2. 未ログインの場合はログインプロンプトを表示
3. ログイン後 `CheckUserAccess` API でホワイトリスト確認
4. アクセス不可の場合は `AccessDeniedView` を表示

### 4.2 ログインプロバイダー

- **Google** (`/.auth/login/google`)
- **Microsoft AAD** (`/.auth/login/aad`)

### 4.3 ホワイトリスト制御

| 状況 | 動作 |
|---|---|
| AllowedUsers コレクションが空 | 最初のログインユーザーが自動的に管理者になる |
| 管理者 | ホワイトリストのユーザー追加・削除・管理者権限付与が可能 |
| 一般ユーザー | ホワイトリストに登録済みの場合のみアクセス可 |
| 未登録ユーザー | AccessDeniedView を表示 |

### 4.4 ユーザーオブジェクト（`clientPrincipal`）

| フィールド | 説明 |
|---|---|
| `userId` | 認証プロバイダーが付与する一意ID |
| `userDetails` | メールアドレス（Google / AAD） |
| `identityProvider` | `google` or `aad` |
| `userRoles` | `anonymous`, `authenticated` など |

### 4.5 ユーザープロファイル（Cosmos DB 保存）

| フィールド | 説明 |
|---|---|
| `id` / `userId` | `clientPrincipal.userId` |
| `userDetails` | メールアドレス |
| `displayName` | タスクの担当者欄に表示される名前（変更可） |
| `createdAt` / `updatedAt` | ISO8601 |

> **注意**: タスクの `assignees` には `displayName` が格納される。  
> ダッシュボードの「自分が担当のタスク」は `GetUserProfile` で取得した `displayName` でフィルタリングする。

---

## 5. 画面一覧

有効なビュー（`ALLOWED_VIEWS`）:

| ビュー | パス指定 | コンポーネント | 説明 |
|---|---|---|---|
| ダッシュボード | `dashboard` | `DashboardView` | 統計カード・カレンダー・タスクリスト |
| タスク | `tasks` | `TaskView` | メインタスク管理 |
| バイヤーリスト | `buyers` | `BuyersListView` | Google Sheets 連携バイヤー管理 |
| Mahana Prospects | `mahana` | `MahanaProspectsView` | ハワイ物件見込み顧客管理 |
| スプレッドシート | `spreadsheet` | `SpreadsheetView` | Google Sheets / Box 埋め込み閲覧 |
| 設定 | `settings` | `SettingsView` | カテゴリ・自動化ルール管理 |
| プロフィール | `profile` | `ProfileView` | 表示名変更 |
| ホワイトリスト | `whitelist` | `WhitelistView` | アクセス管理（管理者のみ） |

---

### 5.1 ダッシュボード (`DashboardView`)

**統計カード（3列）**:
- 全タスク数
- 完了タスク数（ステータス `Done`）
- 進行中タスク数（ステータス `Inprogress`）

**カレンダー**:
- React Big Calendar によるカレンダー表示
- タスクのデッドラインをカテゴリ色で表示
- クリックでタスク詳細モーダルを開く
- カテゴリフィルターチップ（「すべて」＋各カテゴリ）でカレンダー表示を絞り込み可能
- フィルター選択状態は `dashboardSettings.calendarSelectedCategories` に保存（localStorage 永続化）

**サイドパネル（表示/非表示をダッシュボード設定で切替）**:

| パネル | 内容 | 設定キー |
|---|---|---|
| 優先度の高いタスク | `priority === 'High'` のタスク一覧 | `showHighPriority` |
| 自分が担当のタスク | ログインユーザーの `displayName` が `assignees` に含まれるタスク | `showMyTasks` |
| 期限が近いタスク | 今日から7日以内に `deadline` があるタスク | `showUpcoming` |

**ダッシュボード設定**: `localStorage('dashboardSettings')` に保存

**FAB（右下）**: 新規タスク作成モーダルを開く

---

### 5.2 タスク画面 (`TaskView`)

#### レイアウト

| レイアウト名 | 分類軸 | 説明 |
|---|---|---|
| カテゴリ × タグ | カテゴリ → タグ | タグでさらにグループ化、カテゴリ並び替え可 |
| 進捗（ステータス） | ステータス | Started / Inprogress / Done の3列 |
| 担当者 | 担当者名 | 担当者ごとの列、未担当列のON/OFF可 |

#### ソート順

| キー | 説明 |
|---|---|
| `statusDeadline` | ステータス順 → 期限昇順（デフォルト） |
| `deadlineAsc` | 期限昇順 |
| `deadlineDesc` | 期限降順 |
| `titleAsc` | タイトル昇順 |
| `createdAtDesc` | 作成日降順 |

#### フィルター

- カテゴリフィルター（複数選択）
- 担当者フィルター（複数選択）

#### その他機能

- **キーワード検索**: ヘッダーの検索ボックスに入力するとリアルタイムで絞り込み。対象フィールド: タイトル・説明・カテゴリ・タグ・担当者。全レイアウトに反映。
- **メールインポート**: メール件名・本文からタスクを AI 生成（`EmailImportModal` → `ParseEmailToTask` API）
- **ビュー設定の自動保存**: 600ms デバウンスで `UpdateTaskViewPreferences` API に保存
- **URLディープリンク**: `?view=tasks&taskId={id}` でタスク直接アクセス

---

### 5.3 バイヤーリスト (`BuyersListView`)

Google Sheets データを3タブで表示・編集。

| タブ | API (fetch) | API (update) | 説明 |
|---|---|---|---|
| Buyers List（アクティブ） | `GetBuyers` | `UpdateBuyer` | アクティブなバイヤー |
| Xld（解約・取消） | `GetXldBuyers` | `UpdateXldBuyer` | 解約・取消済みバイヤー |
| Commission & Referral | `GetCommissions` | `UpdateCommission` | 手数料・紹介情報 |

**機能**:
- 3段階ヘッダー（セル結合を配列で表現）
- 行クリックで編集ダイアログ
- テキスト検索（全列対象）
- 同期ステータス表示（`GetBuyerSyncStatus`）
- Google Sheets 連携チップ表示

---

### 5.4 Mahana Prospects (`MahanaProspectsView`)

ハワイ物件「Mahana at Kaanapali」の見込み顧客管理。

**カラム一覧（全23列: A〜W）**:

| キー | ラベル | 型 |
|---|---|---|
| no | No. | number |
| registrationDate | 登録日 | date |
| source | ソース | text |
| status | ステータス | select |
| name | 氏名 | text |
| email | Email | email |
| phone | 電話番号 | phone |
| country | 国 | text |
| state | 地域 | text |
| buildingPref | 希望物件 | text |
| bedrooms | 希望間取り | text |
| stacks | 希望スタック | text |
| floorRange | 希望フロア帯 | text |
| tourType | ツアー種別 | select |
| appointmentDate | アポイント日 | date |
| firstAppt | 初回 | checkbox |
| howHeard | 情報源 | text |
| brokerName | ブローカー名 | text |
| brokerEmail | ブローカーEmail | email |
| brokerPhone | ブローカー電話 | phone |
| brokerCompany | ブローカー会社 | text |
| salesExec | 担当セールス | text |
| notes | 備考 | textarea |

**ステータス選択肢**: Lead / Tour済 / Preference提出 / 検討中 / 契約 / 見送り / 移行済

**PDF インポート**: PDF ファイルをアップロードして顧客情報を AI 抽出・登録（`PdfExtract` API）

---

### 5.5 スプレッドシート (`SpreadsheetView`)

Google Sheets / Box ドキュメントを iframe で埋め込み閲覧・編集。

**デフォルトシート**:

| 名前 | 種類 | 説明 |
|---|---|---|
| Buyers List（Box） | Box 埋め込み | バイヤーリスト Excel |
| Lease Renewal | Google Sheets | 賃貸更新管理 |

**機能**:
- タブ切り替えで複数シートを管理
- カスタムシートの追加・編集・削除
- URL 自動変換
  - Google Sheets `/d/{id}/edit` → `/d/e/{pubId}/pubhtml`
  - Box `/s/{id}` → `/embed/s/{id}`
- 新しいタブで開くボタン
- `localStorage('spreadsheet_sheets_v2')` にシート一覧を保存

---

### 5.6 設定 (`SettingsView`)

#### カテゴリ管理

- カテゴリ名（テキスト）
- カテゴリ色（16進カラーコード、デフォルト `#1976d2`）
- 追加・編集・削除

#### 自動化ルール（サブタスクテンプレート）

タグが追加されたときに自動でサブタスクを挿入するルール。

| フィールド | 説明 |
|---|---|
| tag | トリガーとなるタグ名（例: `PM案件`） |
| enabled | ON/OFF |
| subtasks | テンプレートサブタスクの配列 |

**PM案件 デフォルトテンプレート（4フェーズ）**:
1. ハワイからのメール内容を確認・把握
2. 日本語に翻訳してオーナーへ報告
3. オーナーの意向・回答を確認
4. オーナーの意向を英語でハワイへ連絡

---

### 5.7 プロフィール (`ProfileView`)

| 項目 | 操作 |
|---|---|
| ログインID（メールアドレス） | 表示のみ（変更不可） |
| 担当者として表示される名前（displayName） | 変更可・保存 |

---

### 5.8 ホワイトリスト管理 (`WhitelistView`)（管理者のみ）

- ユーザー一覧表示
- ユーザー追加（メールアドレス必須、名前任意）
- 管理者権限の付与/剥奪（トグルスイッチ）
- ユーザー削除

---

## 6. タスク管理システム

### 6.1 タスクデータモデル

```javascript
{
  id: string,              // Cosmos DB ドキュメントID
  title: string,
  description: string,
  status: 'Started' | 'Inprogress' | 'Done',
  priority: 'High' | 'Medium' | 'Low',
  importance: 0 | 1 | 2,  // 0=低, 1=中, 2=高
  category: string | null,
  assignees: string[],     // displayName の配列
  assignee: string | null, // assignees[0]（後方互換）
  tags: string[],
  deadline: string | null, // ISO8601 日付文字列
  subtasks: Subtask[],
  attachments: Attachment[],
  createdAt: string,
  updatedAt: string,
}
```

### 6.2 ステータスフロー

カテゴリによって使用するステータスセットが異なる。

**通常カテゴリ（PM 以外）**:
```
Started（着手前）→ Inprogress（進行中）→ Done（完了）
```

**カテゴリ「PM」の場合**:
```
WaitingEstimate（見積もり待ち）→ WaitingOwnerApproval（オーナー承諾待ち）→ WaitingCompletionReport（完了報告待ち）→ Done（完了）
```

- 一方向のみ（`getNextTaskStatus(status, category)` で次のステータスを取得）
- カテゴリを PM ↔ 非PM に変更した際はステータスを初期値にリセット
- `Done`（完了）は両フローで共通

### 6.3 サブタスクデータモデル

```javascript
{
  id: string,          // UUID
  title: string,
  memo: string,
  completed: boolean,
  order: number,
  buyerLink: {         // バイヤーリストへのリンク（任意）
    sheetName: string,
    rowIndex: number,
    displayName: string,
  } | null,
}
```

### 6.4 タスク詳細モーダル（`TaskDetailModal`）

編集可能フィールド:

| フィールド | 入力形式 |
|---|---|
| タイトル | テキスト（必須） |
| 説明 | 複数行テキスト |
| ステータス | セレクト（3択） |
| 優先度 | セレクト（High/Medium/Low） |
| 重要度 | セレクト（高/中/低） |
| カテゴリ | オートコンプリート |
| 担当者 | 複数選択オートコンプリート |
| タグ | 複数選択（自由入力可） |
| 期限 | 日付ピッカー |
| サブタスク | テーブル形式（追加・削除・並替） |
| 添付ファイル | `AttachmentManager` コンポーネント |

---

## 7. APIエンドポイント一覧

### タスク

| メソッド | エンドポイント | 説明 |
|---|---|---|
| GET | `/api/GetTasks` | 全タスク取得 |
| POST | `/api/CreateTask` | タスク作成 |
| PUT | `/api/UpdateTask/{id}` | タスク更新 |
| DELETE | `/api/DeleteTask/{id}` | タスク削除 |

### ユーザー・プロファイル

| メソッド | エンドポイント | 説明 |
|---|---|---|
| GET | `/api/GetAllUsers` | 全ユーザー一覧（displayName） |
| GET | `/api/GetUserProfile` | 現在ユーザーのプロファイル取得 |
| PUT | `/api/UpdateUserProfile` | プロファイル更新（displayName） |
| GET | `/api/CheckUserAccess` | ホワイトリスト確認 |

### カテゴリ

| メソッド | エンドポイント | 説明 |
|---|---|---|
| GET | `/api/GetCategories` | カテゴリ一覧 |
| POST | `/api/AddCategory` | カテゴリ追加 |
| PUT | `/api/UpdateCategory/{id}` | カテゴリ更新 |

### 自動化ルール

| メソッド | エンドポイント | 説明 |
|---|---|---|
| GET | `/api/GetAutomationRules` | ルール一覧 |
| POST | `/api/CreateAutomationRule` | ルール作成 |
| PUT | `/api/UpdateAutomationRule/{id}` | ルール更新 |
| DELETE | `/api/DeleteAutomationRule/{id}` | ルール削除 |

### タスクビュー設定

| メソッド | エンドポイント | 説明 |
|---|---|---|
| GET | `/api/GetTaskViewPreferences` | ビュー設定取得 |
| PUT | `/api/UpdateTaskViewPreferences` | ビュー設定保存 |

### バイヤーリスト

| メソッド | エンドポイント | 説明 |
|---|---|---|
| GET | `/api/GetBuyers` | アクティブバイヤー取得 |
| POST | `/api/UpdateBuyer` | バイヤー更新 |
| POST | `/api/UpdateBuyerCell` | セル単体更新 |
| POST | `/api/CreateBuyer` | バイヤー追加 |
| GET | `/api/GetBuyerSyncStatus` | 同期ステータス確認 |
| GET | `/api/GenerateBuyersExcel` | Excel エクスポート |
| GET | `/api/GetXldBuyers` | 解約・取消バイヤー取得 |
| POST | `/api/UpdateXldBuyer` | 解約バイヤー更新 |
| GET | `/api/GetCommissions` | コミッション情報取得 |
| POST | `/api/UpdateCommission` | コミッション更新 |

### Mahana Prospects

| メソッド | エンドポイント | 説明 |
|---|---|---|
| GET | `/api/GetMahanaProspects` | 見込み顧客一覧 |
| POST | `/api/CreateMahanaProspect` | 見込み顧客追加 |
| POST | `/api/UpdateMahanaProspect` | 見込み顧客更新 |

### ホワイトリスト（管理者のみ）

| メソッド | エンドポイント | 説明 |
|---|---|---|
| GET | `/api/GetWhitelistUsers` | ユーザー一覧 |
| POST/PUT/DELETE | `/api/UpdateWhitelistUser` | ユーザー追加・更新・削除 |

### ユーティリティ・外部連携

| メソッド | エンドポイント | 説明 |
|---|---|---|
| GET | `/api/HealthCheck` | 死活監視 |
| POST | `/api/SlackCommand` | Slack スラッシュコマンド受信 |
| POST | `/api/ParseEmailToTask` | メール本文から AI タスク生成 |
| POST | `/api/PdfExtract` | PDF テキスト抽出（Claude API 経由） |

---

## 8. データモデル

### 8.1 タスクビュー設定

```javascript
{
  layout: 'category' | 'status' | 'assignee',
  sortMode: 'statusDeadline' | 'deadlineAsc' | 'deadlineDesc' | 'titleAsc' | 'createdAtDesc',
  selectedCategories: string[],
  selectedAssignees: string[],
  includeUnassignedColumn: boolean,
  categoryGroupByTag: boolean,
  categoryTaskOrder: 'progress' | 'createdAtDesc' | 'deadlineAsc',
  updatedAt: string,
}
```

### 8.2 カテゴリ

```javascript
{
  id: string,
  name: string,
  color: string, // 例: '#1976d2'
}
```

### 8.3 自動化ルール

```javascript
{
  id: string,
  tag: string,       // トリガータグ
  enabled: boolean,
  subtasks: Subtask[],
  createdAt: string,
  createdBy: string,
}
```

### 8.4 ホワイトリストユーザー

```javascript
{
  id: string,
  email: string,
  name: string,
  isAdmin: boolean,
  isAllowed: boolean,
  createdAt: string,
  createdBy: string,
  updatedAt: string,
}
```

---

## 9. Cosmos DB コレクション

| コレクション名 | パーティションキー | 用途 |
|---|---|---|
| Tasks | `/id` | タスクデータ |
| Categories | `/id` | カテゴリ定義 |
| AutomationRules | `/id` | 自動化ルール |
| Users（UserProfiles） | `/id` | ユーザープロファイル |
| AllowedUsers | `/id` | アクセスホワイトリスト |
| TaskViewPreferences | `/userId` | ユーザー別ビュー設定 |
| MahanaProspects | `/id` | Mahana 見込み顧客 |

---

## 10. 外部連携

### 10.1 Slack 連携

- **Slack スラッシュコマンド**: `/api/SlackCommand` で受信
- **タスク作成**: コマンドからタスクを Cosmos DB に追加
- **ステータス変更通知**: タスク更新時に Slack チャンネルへ通知

**必要な環境変数**:
- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
- `SLACK_CHANNEL_ID`

### 10.2 AI タスク生成（メールインポート）

- `ParseEmailToTask` API がメール件名・本文を受け取り AI 解析
- フロントエンド: タスク画面のメールアイコンボタン → `EmailImportModal`
- 解析結果をタスク詳細モーダルに自動入力

### 10.3 PDF 抽出（Mahana Prospects）

- `PdfExtract` API が PDF ファイルを受け取り
- pdf-parse でテキスト抽出 → n8n webhook 経由で Claude API に送信
- 構造化データを返却し Mahana Prospects フォームに自動入力

**n8n 経由の理由**: Azure SWA（East Asia リージョン）から Anthropic API への直接接続が Cloudflare により 403 ブロックされるため

### 10.4 Google Sheets 連携

- バイヤーリスト / Xld / Commission データを Google Sheets で管理
- `googleSheetsClient.js` が OAuth 2.0 で認証
- `GetSheetData` / `AppendSheetRow` / `UpdateSheetRow` / `DeleteSheetRow` で操作

**必要な環境変数**:
- `GOOGLE_SA_JSON_B64`（サービスアカウント JSON の Base64）

---

## 11. 多言語対応

**対応言語**: 日本語（デフォルト）/ 英語

- ヘッダーのセレクタで切替
- `localStorage('appLanguage')` に保存
- `app/src/locales/ja.json` / `en.json` で翻訳管理

---

## 12. デプロイ

### 12.1 構成

```
App location  : /app
API location  : /api
Output location: dist
API runtime   : node:20
```

### 12.2 フロー

```
git push origin main
  → GitHub Actions 起動
  → Azure Static Web Apps に自動ビルド・デプロイ
```

進捗確認: `https://github.com/H4KURO/lsircs-app-prod/actions`

### 12.3 主要な環境変数（Azure Portal で設定）

| 変数名 | 用途 |
|---|---|
| `CosmosDbConnectionString` | Cosmos DB 接続文字列 |
| `COSMOS_TASKS_CONTAINER` | タスクコレクション名 |
| `COSMOS_USERS_CONTAINER` | ユーザーコレクション名 |
| `SLACK_BOT_TOKEN` | Slack Bot トークン |
| `SLACK_SIGNING_SECRET` | Slack 署名検証 |
| `SLACK_CHANNEL_ID` | 通知先チャンネル ID |
| `GOOGLE_SA_JSON_B64` | Google サービスアカウント（Base64） |
| `N8N_WEBHOOK_URL` | n8n 経由 Claude API URL |
| `BOX_IMPORT_STORAGE_CONNECTION` | Box ストレージ接続 |
