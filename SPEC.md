# lsir-cs アプリケーション仕様書

> **メンテナンス注意**: このファイルはアプリ変更のたびに更新すること（CLAUDE.md 参照）。  
> 最終更新: 2026-08-14（Phase B/C/D/E: 文書生成機能追加 — 送金案内Excel/メール、ロゴ埋め込み、PDFテンプレート差し込み印刷、保険・インスペクション見積もりメール一括生成）

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
13. [ロードマップ](#13-ロードマップ)

---

## 1. 概要

**アプリ名**: lsir-cs  
**用途**: LIST Sotheby's International Realty 向け業務管理ツール  
**主な機能**:
- タスク管理（担当者・カテゴリ・サブタスク・添付ファイル）
- バイヤーリスト管理（Google Sheets 連携・プロジェクト別複数スプレッドシート対応）
- プロジェクト管理（Cosmos DB によるプロジェクト台帳）
- スプレッドシート閲覧（Google Sheets / Box 埋め込み）
- 顧客管理（CRM）
- ホワイトリストによるアクセス制御
- Slack 通知・Slack コマンドからのタスク作成
- メール本文からのタスク自動生成（AI解析）

---

## 2. 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | React 19 + Vite, Material-UI v7, React Big Calendar, Tiptap v3（リッチテキスト）, i18next, Axios |
| バックエンド | Azure Functions (Node.js 20) |
| データベース | Azure Cosmos DB (NoSQL) |
| ファイルストレージ | Azure Blob Storage |
| ワークフロー自動化 | n8n（webhook・AI連携・Slack通知・定期バッチ等）|
| AI 解析 | n8n 経由 Claude API（メール・PDF解析、タスク自動生成）|
| 通知 | Slack Web API（直接呼び出し）/ n8n 経由（複雑なフロー）|
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

### 5.0 グローバルレイアウト（`App.jsx`）

**アイコンレール（左端 56px 固定）**:
- 背景色: `#001731`（コーポレートカラー PANTONE 289 より暗い）
- ロゴマーク → メインナビアイコン（ダッシュボード・タスク・プロジェクト・バイヤー・CRM・スプレッドシート）
- 下部: 言語切替（JA / EN）・グローバル検索（⌘K）・ホワイトリスト管理（管理者のみ）・設定・プロフィール・ログアウト
- アクティブ項目: 白半透明背景 + 左端3px白アクセントバー
- Tooltip で各アイテムのラベルを表示

**テーマ**:
- プライマリカラー: `#002349`（PANTONE 289 / RGB 0,35,73）
- コントラスト: `#ffffff`

**メインコンテンツエリア**:
- `maxWidth: 1600px`、中央寄せ、`px: { xs: 2, md: 4 }`, `pt: 3`, `pb: 6`

有効なビュー（`ALLOWED_VIEWS`）:

| ビュー | パス指定 | コンポーネント | 説明 |
|---|---|---|---|
| ダッシュボード | `dashboard` | `DashboardView` | 統計カード・カレンダー・タスクリスト |
| タスク | `tasks` | `TaskView` | メインタスク管理 |
| バイヤーリスト | `buyers` | `BuyersListView` | Google Sheets 連携バイヤー管理（プロジェクト切替対応） |
| 顧客管理 (CRM) | `crm` | `CRMView` | 顧客情報の一元管理 |
| プロジェクト管理 | `projects` | `ProjectsView` | プロジェクト台帳の管理 |
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

#### ナビゲーション構成

画面上部にタブ切替バーを配置。右端のフィルターアイコン（≡）でフィルターパネルを展開・折りたたみ。

#### プライマリビュー（タブで切替）

| タブ名 | `layout` 値 | 説明 |
|---|---|---|
| カンバン | `status` | Trello スタイル横並び列。ステータスごとに固定幅260px・独立スクロール。コンパクトカード表示（タイトル・期限・担当者チップ・サブタスク進捗バー） |
| リスト | `list` | 左列: ステータスグループ化リスト、右パネル: 選択タスクの詳細（スティッキー）。クリックで詳細パネルに表示 |
| ギャラリー | `gallery` | カード形式グリッド表示。画像添付ファイルがある場合はカバー画像を表示。ステータスカラーバンド・重要度・担当者・期限・サブタスク進捗を一覧できる |
| カレンダー | `calendar` | React Big Calendar によるデッドライン表示（高さ 680px 固定）。クリックで編集モーダル |
| タイムライン | `timeline` | ガントチャート形式（`TaskTimelineView`）。開始日～期限をバーで表示 |

#### セカンダリビュー（フィルターパネルのビュー選択から）

| レイアウト名 | `layout` 値 | 説明 |
|---|---|---|
| カテゴリ × タグ | `category` | タグでさらにグループ化、カテゴリ並び替え可 |
| 担当者 | `assignee` | 担当者ごとの列、未担当列のON/OFF可 |

#### ソート順

| キー | 説明 |
|---|---|
| `statusDeadline` | ステータス順 → 期限昇順（デフォルト） |
| `deadlineAsc` | 期限昇順 |
| `deadlineDesc` | 期限降順 |
| `titleAsc` | タイトル昇順 |
| `createdAtDesc` | 作成日降順 |

#### フィルターパネル（折りたたみ式）

- **AND/ORフィルター条件**: 複数条件をAND/ORで組み合わせるフィルター行（フィールド・演算子・値を行単位で追加/削除）
  - フィールド: ステータス・重要度・期限・担当者・タグ・カテゴリ
  - 演算子: フィールドに応じて切り替え（は/でない、含む/含まない、前/後、未設定/設定済み）
  - 条件は左から右にチェーンして適用
- **グループ化**: カンバン・リストビュー時に列/セクション内をカテゴリまたは重要度でサブグループ化
- カテゴリフィルター（複数選択）
- 担当者フィルター（複数選択、担当者ビュー時）
- 並び順選択
- カテゴリ内並び順・タググループ化（カテゴリビュー時）
- カテゴリの表示順変更（矢印ボタン）
- 保存済みビューの適用・削除

#### ビュー設定の永続化

- 有効な `layout` 値（サーバー側 `ALLOWED_LAYOUTS`）: `category`, `status`, `list`, `gallery`, `calendar`, `assignee`, `timeline`
- 600ms デバウンスで `UpdateTaskViewPreferences` API に自動保存（ユーザーごと）

#### その他機能

- **キーワード検索**: ヘッダーの検索ボックスに入力するとリアルタイムで絞り込み。対象フィールド: タイトル・説明・カテゴリ・タグ・担当者。全レイアウトに反映。
- **メールインポート**: メール件名・本文からタスクを AI 生成（`EmailImportModal` → `ParseEmailToTask` API）
- **URLディープリンク**: `?view=tasks&taskId={id}` でタスク直接アクセス
- **カスタムビュー保存**: ブックマークアイコンで現在のフィルター設定を名前付き保存

---

### 5.3 バイヤーリスト (`BuyersListView`)

Google Sheets データを3タブで表示・編集。プロジェクト台帳と連携し、プロジェクト別にバイヤーリストを切り替えられる。

**プロジェクト選択**:
- 画面上部にプロジェクトのドロップダウンセレクター表示
- `GetProjects` API でアクティブプロジェクト一覧を取得、最初のプロジェクトをデフォルト選択
- 「Buyers List」タブのみプロジェクト選択が有効（`GetBuyers?projectId=xxx`）
- Xld / Commission タブはプロジェクト選択の影響を受けない（既存動作を維持）

| タブ | API (fetch) | API (update) | 説明 |
|---|---|---|---|
| Buyers List（アクティブ） | `GetBuyers?projectId=xxx` | `UpdateBuyer` | アクティブなバイヤー（プロジェクト別） |
| Xld（解約・取消） | `GetXldBuyers` | `UpdateXldBuyer` | 解約・取消済みバイヤー |
| Commission & Referral | `GetCommissions` | `UpdateCommission` | 手数料・紹介情報 |

**機能**:
- 3段階ヘッダー（セル結合を配列で表現）
- 行クリックで編集ダイアログ
- テキスト検索（全列対象）
- 同期ステータス表示（`GetBuyerSyncStatus`）
- Google Sheets 連携チップ表示

---

### 5.4 顧客管理 (`CRMView`)

ZOHO・Appfolio・WP等の分散した顧客情報を一元管理するCRM機能。

**顧客フィールド**:

| フィールド | 説明 |
|---|---|
| name | 氏名（必須） |
| email | メールアドレス |
| phone | 電話番号 |
| company | 会社名 |
| country | 国 |
| region | 地域 |
| status | ステータス（Lead / 商談中 / 契約済み / フォローアップ / 見送り） |
| source | 情報ソース（ZOHO / Appfolio / WP / Qドライブ / 手動入力） |
| assignedTo | 担当者（displayName） |
| propertyInterest | 希望物件 |
| preferredBedrooms | 希望間取り |
| budget | 予算 |
| lastContactedAt | 最終接触日（YYYY-MM-DD） |
| nextFollowUpAt | 次回フォロー日（YYYY-MM-DD） |
| notes | 備考 |

**機能**:
- 顧客一覧（テキスト検索・ステータスフィルター）
- 顧客作成・編集・削除
- タスクとの紐づけ（`TaskDetailModal` に顧客選択欄）
- 顧客詳細モーダルの「タスクを開く」ボタンはSPA遷移（`onNavigateToTask` コールバック経由）でタスク詳細モーダルを直接開く
- 顧客情報更新時にDXチームへSlack通知（`SLACK_DX_CHANNEL_ID`）

**Slack DX通知**: 顧客情報変更時（変更がある場合のみ）に `SLACK_DX_CHANNEL_ID` チャンネルへ送信。ZOHOへの手動反映依頼として活用。

---

### 5.5 プロジェクト管理 (`ProjectsView`)

バイヤーリスト管理に使う Google Sheets プロジェクトの台帳。チームメンバー全員が操作可能（管理者専用ではない）。

**プロジェクトデータモデル**:

| フィールド | 説明 |
|---|---|
| `id` | Cosmos DB ドキュメントID（自動生成UUID） |
| `name` | プロジェクト名（必須） |
| `developer` | 開発業者名（任意） |
| `spreadsheetId` | Google スプレッドシートID（必須） |
| `sheetName` | バイヤーリストのシート（タブ）名（必須） |
| `headerRows` | ヘッダー行数（デフォルト: 3） |
| `status` | `'active'` \| `'inactive'`（デフォルト: `'active'`） |
| `createdAt` / `updatedAt` | ISO8601 |

**UI構成**:
- プロジェクト一覧テーブル（プロジェクト名・開発業者・スプレッドシートID・シート名・ヘッダー行数・ステータス）
- ステータスチップ: active → 緑「有効」、inactive → グレー「無効」
- 追加・編集・削除ダイアログ
- スプレッドシートIDは一覧上で先頭20文字のみ表示（完全IDはダイアログで確認）

**注意**: `BuyersListView` / `BuyerSearchDialog` はアクティブ（`status !== 'inactive'`）プロジェクトのみ表示する。

---

### 5.6 スプレッドシート (`SpreadsheetView`)

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

### 5.7 設定 (`SettingsView`)

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

### 5.8 プロフィール (`ProfileView`)

| 項目 | 操作 |
|---|---|
| ログインID（メールアドレス） | 表示のみ（変更不可） |
| 担当者として表示される名前（displayName） | 変更可・保存 |

---

### 5.9 ホワイトリスト管理 (`WhitelistView`)（管理者のみ）

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
  description: string,     // HTML（Tiptap リッチテキストエディター出力）
  status: 'Started' | 'Inprogress' | 'Done',
  priority: 'High' | 'Medium' | 'Low',
  importance: 0 | 1 | 2,  // 0=低, 1=中, 2=高
  category: string | null,
  assignees: string[],     // displayName の配列
  assignee: string | null, // assignees[0]（後方互換）
  tags: string[],
  startDate: string | null,  // 開始日 ISO8601（タイムライン表示で使用）
  deadline: string | null,   // 期限 ISO8601 日付文字列
  blockedBy: string[],       // 依存タスクIDの配列（このタスクをブロックするタスク群）
  subtasks: Subtask[],
  attachments: Attachment[],
  comments: Comment[],       // タスクコメント配列
  recurringConfig: {         // 繰り返しタスク設定（任意）
    enabled: boolean,
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly',
  } | null,
  url: string | null,          // 関連URL（Additional Info）
  phoneNumber: string | null,  // 電話番号（Additional Info）
  numericValue: number | null, // 数値・金額・面積等（Additional Info）
  createdAt: string,
  lastUpdatedAt: string,
  lastUpdatedById: string,
  lastUpdatedByName: string,
}
```

#### Comment データモデル

```javascript
{
  id: string,               // UUID
  authorDisplayName: string, // displayName
  authorUserId: string,
  text: string,             // コメント本文（@mention 含む）
  replyTo: string | null,   // 返信先コメントID（スレッド用。省略時は null）
  createdAt: string,        // ISO8601
}
```

コメント投稿時に `@DisplayName` 形式のメンションが含まれている場合、Slack チャンネルへ通知を送信（`SLACK_BOT_TOKEN`・`SLACK_CHANNEL_ID` 設定時のみ）。

スレッド返信: `replyTo` フィールドで親コメントIDを参照するフラット構造。UI上では親コメントの下にインデントして表示。返信ボタンで入力欄に返信対象が表示され、送信後 `replyTo` に親コメントIDを付加して保存。

### 6.2 ステータスフロー

カテゴリによって使用するステータスセットが異なる。

**通常カテゴリ（PM 以外）**:
```
Started（着手前）→ Inprogress（進行中）→ Done（完了）
```

**カテゴリ「PM」の場合**:
```
WaitingEstimate（見積もり待ち）→ WaitingOwnerApproval（オーナー承諾待ち）→ WaitingCompletionReport（完了報告待ち）→ DoneWithoutReport（完了・報告なし）→ Done（完了）
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
tags: string[],      // サブタスク固有のタグ
  completed: boolean,
  order: number,
  buyerLink: {         // バイヤーリストへのリンク（任意）
    projectId: string | null,   // プロジェクトID（Cosmos DB）
    projectName: string | null, // プロジェクト名
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
| 説明 | Tiptap リッチテキストエディター（見出し・太字・斜体・取り消し線・コード・リスト・引用・リンク等。HTML として保存） |
| ステータス | セレクト（3択） |
| 優先度 | セレクト（High/Medium/Low） |
| 重要度 | セレクト（高/中/低） |
| カテゴリ | オートコンプリート |
| 担当者 | 複数選択オートコンプリート |
| タグ | 複数選択（自由入力可） |
| 期限 | 日付ピッカー |
| 繰り返し設定 | ON/OFF トグル＋頻度セレクト（daily/weekly/biweekly/monthly） |
| サブタスク | テーブル形式（追加・削除・並替）。各サブタスクにメモ・タグ編集あり |
| 添付ファイル | `AttachmentManager` コンポーネント |
| コメント | コメント一覧＋入力欄（@mention補完付き）＋削除 |

---

## 6.5 Phase 1 完了機能

### 6.5.1 リッチテキスト説明欄（Tiptap v3）

- `description` フィールドを HTML として保存・表示（Tiptap v3 エディター出力）
- タスク詳細モーダル内に `RichTextEditor` コンポーネントを配置（`app/src/RichTextEditor.jsx`）
- ツールバー: 見出し（H2）・太字・斜体・取り消し線・コード・箇条書き・番号リスト・引用・水平線・リンク挿入/解除
- アクティブなフォーマットはツールバーボタンが青背景でハイライト
- 拡張機能: `StarterKit`・`Link`・`Placeholder`
- タスク切り替え時は `editor.commands.setContent()` で内容を外部 value と同期

### 6.5.2 グローバル検索（`GlobalSearch.jsx`）

- ショートカット: `⌘K`（Mac）/ `Ctrl+K`（Windows）でオープン
- タスクと顧客（Customers）をクライアントサイドで横断検索
- 検索対象: タスクのタイトル・説明・カテゴリ・タグ / 顧客の氏名・メール・会社名

### 6.5.3 タスクコメント

- タスクドキュメントの `comments` 配列に追記・削除
- API: `POST /api/AddTaskComment`、`DELETE /api/DeleteTaskComment`
- コメント欄は `TaskDetailModal` 内に表示

### 6.5.4 繰り返しタスク

- タスクに `recurringConfig: { enabled, frequency }` フィールドを付与
- ステータスが `Done` に変わった際に次の繰り返しタスクを自動生成
  - `frequency` に応じて `deadline` を算出（daily: +1日 / weekly: +7日 / biweekly: +14日 / monthly: +1ヶ月）
  - 新タスクのステータスは `Started` にリセット

### 6.5.5 @mention 補完（コメント入力欄）

- コメント入力中に `@` を入力すると AllowedUsers からのユーザー候補を表示
- `GetAllUsers` API が `AllowedUsers` コレクションとの照合結果のみ返すよう変更（`isAllowed !== false` のユーザーのみ）

---

## 7. APIエンドポイント一覧

### タスク

| メソッド | エンドポイント | 説明 |
|---|---|---|
| GET | `/api/GetTasks` | 全タスク取得 |
| POST | `/api/CreateTask` | タスク作成 |
| PUT | `/api/UpdateTask/{id}` | タスク更新 |
| DELETE | `/api/DeleteTask/{id}` | タスク削除 |
| POST | `/api/AddTaskComment` | タスクにコメント追加 |
| DELETE | `/api/DeleteTaskComment` | タスクのコメント削除 |
| POST | `/api/DeadlineReminder` | 期限リマインダー送信（n8n呼び出し用、`x-n8n-secret-key` 認証） |

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

### カスタムビュー保存

| メソッド | エンドポイント | 説明 |
|---|---|---|
| GET | `/api/GetSavedViews` | 保存済みビュー一覧取得 |
| POST | `/api/SaveView` | ビュー保存（名前付き） |
| DELETE | `/api/DeleteSavedView/{id}` | 保存済みビュー削除 |

### タスクテンプレート

| メソッド | エンドポイント | 説明 |
|---|---|---|
| GET | `/api/GetTaskTemplates` | テンプレート一覧取得 |
| POST | `/api/CreateTaskTemplate` | テンプレート作成 |
| PUT | `/api/UpdateTaskTemplate/{id}` | テンプレート更新 |
| DELETE | `/api/DeleteTaskTemplate/{id}` | テンプレート削除 |

### バイヤーリスト

| メソッド | エンドポイント | 説明 |
|---|---|---|
| GET | `/api/GetBuyers` | アクティブバイヤー取得（`?projectId=xxx` でプロジェクト別スプレッドシートから取得） |
| POST | `/api/UpdateBuyer` | バイヤー更新 |
| POST | `/api/UpdateBuyerCell` | セル単体更新（`column` または `columnName` を受け付ける） |
| POST | `/api/CreateBuyer` | バイヤー追加 |
| GET | `/api/GetBuyerSyncStatus` | 同期ステータス確認 |
| GET | `/api/GetBuyerListColumns` | Buyers List ヘッダー列一覧取得（`[{ letter, name }]`） |
| GET | `/api/GenerateBuyersExcel` | Excel エクスポート |
| GET | `/api/GetXldBuyers` | 解約・取消バイヤー取得 |
| POST | `/api/UpdateXldBuyer` | 解約バイヤー更新 |
| GET | `/api/GetCommissions` | コミッション情報取得 |
| POST | `/api/UpdateCommission` | コミッション更新 |

### CRM（顧客管理）

| メソッド | エンドポイント | 説明 |
|---|---|---|
| GET | `/api/GetCustomers` | 顧客一覧取得 |
| POST | `/api/CreateCustomer` | 顧客作成 |
| POST | `/api/UpdateCustomer` | 顧客更新（DX Slack通知付き） |
| POST | `/api/DeleteCustomer` | 顧客削除 |

### プロジェクト管理

| メソッド | エンドポイント | 説明 |
|---|---|---|
| GET | `/api/GetProjects` | プロジェクト一覧取得（name昇順） |
| POST | `/api/CreateProject` | プロジェクト作成（name・spreadsheetId・sheetName 必須） |
| POST | `/api/UpdateProject` | プロジェクト更新（id必須。更新可能フィールド: name・developer・spreadsheetId・sheetName・headerRows・status） |
| POST | `/api/DeleteProject` | プロジェクト削除 |

### ホワイトリスト（管理者のみ）

| メソッド | エンドポイント | 説明 |
|---|---|---|
| GET | `/api/GetWhitelistUsers` | ユーザー一覧 |
| POST/PUT/DELETE | `/api/UpdateWhitelistUser` | ユーザー追加・更新・削除 |

### 文書生成（DocumentGenerationView）

バイヤーリストの情報を差し込んで送金案内書類を一括生成する機能。

| メソッド | エンドポイント | 説明 |
|---|---|---|
| POST | `/api/GenerateRemittanceExcel` | 手付金送金案内 Excel 一括生成（バイヤー別シート）。List Sotheby's ロゴ付き。`{ projectId, depositRound }` |
| POST | `/api/GenerateRemittanceEmail` | 手付金送金案内メール（.eml）一括生成 → ZIP ダウンロード。`{ projectId, depositRound }` |
| POST | `/api/GenerateRemittancePdf` | PDFテンプレートへのAcroFormフィールド差し込み印刷 → ZIP。`{ projectId, depositRound, templateId }` |
| POST | `/api/UploadPdfTemplate` | PDFテンプレートをBlobStorageへアップロード。AcroFormフィールド名を返す。`{ projectId, templateName, pdfBase64, templateId? }` |
| POST | `/api/UpdatePdfTemplateMapping` | PDFフィールドとBL列のマッピングを保存。`{ projectId, templateId, fieldMapping }` |
| POST | `/api/DeletePdfTemplate` | PDFテンプレートを削除（Blob + Cosmos）。`{ projectId, templateId }` |
| POST | `/api/GenerateServiceEmail` | 保険・インスペクション見積もりメール（.eml）一括生成 → ZIP。料金テーブルでマッチング。`{ projectId, providerId }` |

**documentSettings 構造（Projects コレクション）:**
```javascript
documentSettings: {
  columnMapping: {
    ownerNameEn, titleName, escrowNo, unitNo, purchasePrice,
    deposit1Date, deposit2Date, deposit3Date,
    buyerEmail, agentEmail,
    bedrooms, sqft, usage, floor, stack,  // 保険・インスペクション用
  },
  propertyName, propertyAddress, escrowRemarkSuffix,
  recipientName, recipientAddress, recipientPhone,
  bankName, bankBranch, bankBranchAddress, accountType,
  accountNo, abaNo, swiftCode, bankRegisteredAddress, currency,
  pdfTemplates: [{        // PDFテンプレート（複数可）
    id, name, blobName, fieldNames: string[],
    fieldMapping: { pdfFieldName: columnLetterOrBuiltinKey },
  }],
  serviceProviders: [{    // 保険・インスペクション業者（複数可）
    id, name,
    type: 'insurance' | 'inspection',
    emailSubject,         // {{変数}} テンプレート
    emailBody,
    rateTable: [{
      bedrooms, usage, sqftMin, sqftMax, floorMin, floorMax, stack,
      fee, feeLabel, notes,
    }],
  }],
}
```

**料金テーブルマッチング:** 空欄 = any。上から順に評価し最初に一致した行を使用。不一致バイヤーは `X-No-Match-Buyers` レスポンスヘッダーに列挙。

**PDFビルトインキー（fieldMapping で使用可）:** `__ownerNameEn`, `__depositAmount`, `__depositDate`, `__depositRound`, `__purchasePrice`, `__propertyName`, `__propertyAddress`, `__recipientName`, `__bankName`, `__accountNo`, `__abaNo`, `__swiftCode`, `__currency` など。

### ユーティリティ・外部連携

| メソッド | エンドポイント | 説明 |
|---|---|---|
| GET | `/api/HealthCheck` | 死活監視 |
| POST | `/api/SlackCommand` | Slack スラッシュコマンド受信 |
| POST | `/api/ParseEmailToTask` | メール本文から AI タスク生成 |

---

## 8. データモデル

### 8.1 タスクビュー設定

```javascript
{
  layout: 'category' | 'status' | 'list' | 'gallery' | 'calendar' | 'assignee' | 'timeline',
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
| Tasks | `/id` | タスクデータ（comments・recurringConfig フィールド含む） |
| Categories | `/id` | カテゴリ定義 |
| AutomationRules | `/id` | 自動化ルール |
| Users（UserProfiles） | `/id` | ユーザープロファイル（savedViews フィールド含む） |
| AllowedUsers | `/id` | アクセスホワイトリスト |
| TaskViewPreferences | `/userId` | ユーザー別ビュー設定 |
| Customers | `/id` | CRM顧客データ（env: `COSMOS_CUSTOMERS_CONTAINER`） |
| Projects | `/id` | プロジェクト台帳（env: `COSMOS_PROJECTS_CONTAINER`） |
| TaskTemplates | `/id` | タスクテンプレート（Phase 2） |

---

## 10. 外部連携

### 10.1 Slack 連携

- **Slack スラッシュコマンド**: `/api/SlackCommand` で受信
- **タスク作成**: コマンドからタスクを Cosmos DB に追加
- **ステータス変更通知**: タスク更新時に Slack チャンネルへ通知
- **コメントメンション通知**: コメントで `@担当者名` を記載すると、対象者の Slack アカウントへダイレクトメンション通知（`slackMemberId` 連携時）
- **期限リマインダー**: `/api/DeadlineReminder` (POST) — n8n から定期呼び出し。指定日数以内に期限を迎えるタスクの担当者へ Slack メンション付き通知。`x-n8n-secret-key` ヘッダー認証必須。`daysAhead` パラメータで通知対象日数を指定（デフォルト3日）
- **Slack メンバーID連携**: プロファイル画面でユーザー自身が Slack メンバーID（例: `U0AB12CDE`）を手入力して連携。Users コレクションの `slackMemberId` フィールドに保存

**必要な環境変数**:
- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
- `SLACK_CHANNEL_ID`
- `APP_BASE_URL`（タスクリンク生成用）

### 10.2 AI タスク生成（メールインポート）

- `ParseEmailToTask` API がメール件名・本文を受け取り AI 解析
- フロントエンド: タスク画面のメールアイコンボタン → `EmailImportModal`
- 解析結果をタスク詳細モーダルに自動入力

### 10.3 Google Sheets 連携

- バイヤーリスト / Xld / Commission データを Google Sheets で管理
- `sheetsClient.js` がサービスアカウント JSON で認証
- `GetSheetData` / `AppendSheetRow` / `UpdateSheetRow` / `DeleteSheetRow` で操作

**マルチスプレッドシート対応**:
- `sheetsClient.js` の `getSheetValuesById(spreadsheetId, range)` 関数により任意のスプレッドシートIDを指定可能
- `GetBuyers?projectId=xxx` 時は Projects コンテナの `spreadsheetId` を使用してプロジェクト専用スプレッドシートへアクセス
- projectId 未指定時はデフォルトスプレッドシート（環境変数 `GOOGLE_SHEETS_SPREADSHEET_ID`）を使用（後方互換）
- 各プロジェクトのスプレッドシートにはサービスアカウント `naluhana-sheets@lsircs-app.iam.gserviceaccount.com` の閲覧権限が必要

**必要な環境変数**:
- `GOOGLE_SHEETS_CREDENTIALS`（サービスアカウント JSON — `client_email` と `private_key` を含む）
- `GOOGLE_SHEETS_SPREADSHEET_ID`（デフォルトスプレッドシートID）
- `GOOGLE_SA_CLIENT_EMAIL`（参考用のみ — 実際の認証は `GOOGLE_SHEETS_CREDENTIALS` の `client_email` を使用）

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
| `COSMOS_CUSTOMERS_CONTAINER` | 顧客（CRM）コレクション名 |
| `COSMOS_PROJECTS_CONTAINER` | プロジェクト台帳コレクション名（Azure Portal の Advanced Edit JSON で設定） |
| `SLACK_BOT_TOKEN` | Slack Bot トークン |
| `SLACK_SIGNING_SECRET` | Slack 署名検証 |
| `SLACK_CHANNEL_ID` | 通知先チャンネル ID |
| `SLACK_DX_CHANNEL_ID` | CRM顧客更新通知先チャンネル ID |
| `GOOGLE_SHEETS_CREDENTIALS` | Google サービスアカウント JSON（`client_email` と `private_key` を含む） |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | デフォルトスプレッドシートID（`1-gTbb5a1oA9ecY159KQMWA5gGr0gDvoa_UO8tlv4whs`） |
| `GOOGLE_SA_CLIENT_EMAIL` | サービスアカウントのメール（参考用 — 認証には未使用） |
| `N8N_WEBHOOK_URL` | n8n 経由 Claude API URL |
| `BOX_IMPORT_STORAGE_CONNECTION` | Box ストレージ接続 |

---

## 13. ロードマップ

### PHASE 2 - ビュー & ワークフロー強化

| 機能 | ステータス | 概要 |
|---|---|---|
| カスタムビュー保存 | 実装済 | フィルター状態（layout/sortMode/selectedCategories/selectedAssignees/kanbanGroupBy/secondaryGroupBy 等）を名前付きで保存し、ワンクリックで切り替え。savedViews はユーザープロファイル（Users コレクション）に保存。API: GetSavedViews / SaveView / DeleteSavedView/{id} |
| タスクテンプレート | 実装中 | よく使うタスク構成（サブタスク・カテゴリ・タグ）をテンプレートとして保存し、新規タスク作成時に適用。新規 Cosmos コレクション `TaskTemplates`。API: GetTaskTemplates / CreateTaskTemplate / UpdateTaskTemplate/{id} / DeleteTaskTemplate/{id} |
| タイムライン表示 | 完了 | ガントチャート形式でタスクをカテゴリ別に表示。期限・開始日に基づくバー表示。今日ライン・期限超過ハイライト・クリックで編集。ビュー選択から「タイムライン（ガント）」を選択。`TaskTimelineView.jsx` |
| タスク依存関係 | 完了 | タスク詳細モーダルで「依存関係」セクションを追加。`blockedBy: string[]` フィールドでブロッカータスクを指定。タスクカードに「ブロック中 (N)」バッジを表示。 |
| ダッシュボード拡張 | 完了 | 期限超過タスク数ウィジェット・チーム完了率プログレスバー・担当者別タスク分布ウィジェット。`DashboardView.jsx` + `StatCard.jsx` |
