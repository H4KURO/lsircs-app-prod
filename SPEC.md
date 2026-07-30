# lsir-cs アプリケーション仕様書

> **メンテナンス注意**: このファイルはアプリ変更のたびに更新すること（CLAUDE.md 参照）。  
> 最終更新: 2026-07-30（資産管理CRM フェーズ1（テスト環境・管理者限定）を `claude/crm-asset-management-system-0bs8i0` ブランチに追加。main 未マージ）

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
| 資産管理（テスト・管理者限定） | `assets` | `AssetManagementView` | Wealth Park / GMO賃貸DX を参考にした独自の資産管理CRM。フェーズ1テスト環境 |
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

- カテゴリフィルター（複数選択）
- 担当者フィルター（複数選択、担当者ビュー時）
- 並び順選択
- カテゴリ内並び順・タググループ化（カテゴリビュー時）
- カテゴリの表示順変更（矢印ボタン）
- 保存済みビューの適用・削除

#### ビュー設定の永続化

- 有効な `layout` 値（サーバー側 `ALLOWED_LAYOUTS`）: `category`, `status`, `list`, `calendar`, `assignee`, `timeline`
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

### 5.10 資産管理 (`AssetManagementView`)（管理者のみ・フェーズ1テスト環境）

**位置づけ**: Wealth Park や GMO の賃貸DXのような「オーナーポータル・資産管理」の機能コンセプトを参考にした独自実装。既存のタスク管理システム（`TaskView`）と並行してアップデートが進んでいるため、使い勝手への影響を避ける目的で以下のように隔離している。

- ブランチ `claude/crm-asset-management-system-0bs8i0` 上でのみ開発し、実用段階になるまで `main` にはマージしない
- ナビゲーションのアイコンレールには管理者（`accessStatus.isAdmin`）のみに表示（`App.jsx` の `navItems` で条件分岐）
- 実際の送金・決済は一切行わない。賃料の入出金・オーナーへの送金予定額はあくまで**記録・集計のみ**を扱う

**画面構成**: 4タブ構成（`AssetManagementView.jsx` がタブ切替を管理し、参照データ（オーナー・物件・契約）はマウント時に先読みして各タブ間で共有）

| タブ | コンポーネント | 説明 |
|---|---|---|
| 物件 | `AssetPropertiesTab` | 物件台帳（種別・住所・オーナー・戸数） |
| オーナー | `AssetOwnersTab` | オーナー台帳（連絡先・振込先銀行情報） |
| 契約 | `AssetContractsTab` | 賃貸契約（物件・入居者・賃料・契約期間） |
| 賃料入出金 | `AssetRentTransactionsTab` | 月次の入金予定・入金実績・オーナー送金予定額の記録 |

**データの関連**: オーナー 1—N 物件、物件 1—N 契約、契約 1—N 賃料入出金（月次）。各テーブルはドロップダウンで親エンティティを選択する形でリレーションを表現（Cosmos DB はNoSQLのため外部キー制約はアプリ側でバリデーション）。

---

## 6. タスク管理システム

### 6.1 タスクデータモデル

```javascript
{
  id: string,              // Cosmos DB ドキュメントID
  title: string,
  description: string,     // Markdown テキスト
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
  createdAt: string,
  updatedAt: string,
}
```

#### Comment データモデル

```javascript
{
  id: string,          // UUID
  authorName: string,  // displayName
  authorEmail: string,
  body: string,        // コメント本文（@mention 含む）
  createdAt: string,   // ISO8601
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
| 説明 | Markdown エディタ（プレビュー/編集 トグル・ツールバー付き） |
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

### 6.5.1 Markdown 説明欄

- `description` フィールドを Markdown テキストとして保存・表示
- タスク詳細モーダル内でプレビュー/編集をトグルで切り替え
- ツールバー: FormatBold・FormatItalic・FormatListBulleted 等のアイコンボタン

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

### 資産管理（管理者のみ・フェーズ1テスト環境）

| メソッド | エンドポイント | 説明 |
|---|---|---|
| GET | `/api/GetAssetOwners` | オーナー一覧取得（name昇順） |
| POST | `/api/CreateAssetOwner` | オーナー作成（name必須） |
| POST | `/api/UpdateAssetOwner` | オーナー更新（id必須） |
| POST | `/api/DeleteAssetOwner` | オーナー削除 |
| GET | `/api/GetAssetProperties` | 物件一覧取得（name昇順） |
| POST | `/api/CreateAssetProperty` | 物件作成（name必須） |
| POST | `/api/UpdateAssetProperty` | 物件更新（id必須） |
| POST | `/api/DeleteAssetProperty` | 物件削除 |
| GET | `/api/GetAssetContracts` | 契約一覧取得（開始日降順） |
| POST | `/api/CreateAssetContract` | 契約作成（propertyId・tenantName必須） |
| POST | `/api/UpdateAssetContract` | 契約更新（id必須） |
| POST | `/api/DeleteAssetContract` | 契約削除 |
| GET | `/api/GetAssetRentTransactions` | 賃料入出金一覧取得（対象年月降順） |
| POST | `/api/CreateAssetRentTransaction` | 入出金記録作成（contractId・yearMonth必須） |
| POST | `/api/UpdateAssetRentTransaction` | 入出金記録更新（id必須） |
| POST | `/api/DeleteAssetRentTransaction` | 入出金記録削除 |

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

---

## 8. データモデル

### 8.1 タスクビュー設定

```javascript
{
  layout: 'category' | 'status' | 'assignee' | 'timeline',
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

### 8.5 資産管理: オーナー（`AssetOwners`）

```javascript
{
  id: string,
  name: string,               // オーナー名（必須）
  kana: string,
  contactEmail: string,
  contactPhone: string,
  address: string,
  bankName: string,           // 振込先銀行名
  bankBranch: string,
  bankAccountType: string,    // 普通 / 当座
  bankAccountNumber: string,
  bankAccountHolder: string,
  notes: string,
  createdAt: string,
  updatedAt: string,
  createdBy: string,
  updatedBy: string | null,
}
```

### 8.6 資産管理: 物件（`AssetProperties`）

```javascript
{
  id: string,
  name: string,                // 物件名（必須）
  address: string,
  propertyType: 'apartment' | 'house' | 'building' | 'land' | 'other',
  ownerId: string | null,      // AssetOwners への参照
  unitCount: number | null,
  builtYear: number | null,
  status: 'active' | 'inactive',
  notes: string,
  createdAt: string,
  updatedAt: string,
  createdBy: string,
  updatedBy: string | null,
}
```

### 8.7 資産管理: 賃貸契約（`AssetContracts`）

```javascript
{
  id: string,
  propertyId: string,           // AssetProperties への参照（必須）
  unitNumber: string,
  tenantName: string,           // 入居者名（必須）
  tenantContact: string,
  rentAmount: number,
  managementFeeAmount: number,
  depositAmount: number,
  startDate: string,             // YYYY-MM-DD
  endDate: string,                // YYYY-MM-DD
  status: 'active' | 'pending' | 'terminated',
  notes: string,
  createdAt: string,
  updatedAt: string,
  createdBy: string,
  updatedBy: string | null,
}
```

### 8.8 資産管理: 賃料入出金（`AssetRentTransactions`）

```javascript
{
  id: string,
  contractId: string,           // AssetContracts への参照（必須）
  propertyId: string | null,    // 作成時に契約から自動セット
  yearMonth: string,            // YYYY-MM（必須）
  expectedAmount: number,       // 入金予定額
  receivedAmount: number,       // 入金実績額
  receivedDate: string,
  ownerPayoutAmount: number,    // オーナー送金予定額（記録のみ、実送金は行わない）
  ownerPayoutDate: string,
  status: 'unpaid' | 'partial' | 'paid',
  notes: string,
  createdAt: string,
  updatedAt: string,
  createdBy: string,
  updatedBy: string | null,
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
| AssetOwners | `/id` | 資産管理: オーナー台帳（env: `COSMOS_ASSET_OWNERS_CONTAINER`、フェーズ1テスト環境） |
| AssetProperties | `/id` | 資産管理: 物件台帳（env: `COSMOS_ASSET_PROPERTIES_CONTAINER`、フェーズ1テスト環境） |
| AssetContracts | `/id` | 資産管理: 賃貸契約（env: `COSMOS_ASSET_CONTRACTS_CONTAINER`、フェーズ1テスト環境） |
| AssetRentTransactions | `/id` | 資産管理: 賃料入出金記録（env: `COSMOS_ASSET_RENT_TRANSACTIONS_CONTAINER`、フェーズ1テスト環境） |

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
| カスタムビュー保存 | 実装中 | フィルター状態（layout/sortMode/selectedCategories/selectedAssignees）を名前付きで保存し、ワンクリックで切り替え。savedViews はユーザープロファイル（Users コレクション）に保存。API: GetSavedViews / SaveView / DeleteSavedView/{id} |
| タスクテンプレート | 実装中 | よく使うタスク構成（サブタスク・カテゴリ・タグ）をテンプレートとして保存し、新規タスク作成時に適用。新規 Cosmos コレクション `TaskTemplates`。API: GetTaskTemplates / CreateTaskTemplate / UpdateTaskTemplate/{id} / DeleteTaskTemplate/{id} |
| タイムライン表示 | 完了 | ガントチャート形式でタスクをカテゴリ別に表示。期限・開始日に基づくバー表示。今日ライン・期限超過ハイライト・クリックで編集。ビュー選択から「タイムライン（ガント）」を選択。`TaskTimelineView.jsx` |
| タスク依存関係 | 完了 | タスク詳細モーダルで「依存関係」セクションを追加。`blockedBy: string[]` フィールドでブロッカータスクを指定。タスクカードに「ブロック中 (N)」バッジを表示。 |
| ダッシュボード拡張 | 完了 | 期限超過タスク数ウィジェット・チーム完了率プログレスバー・担当者別タスク分布ウィジェット。`DashboardView.jsx` + `StatCard.jsx` |

### PHASE 3 - 資産管理CRM（テスト環境・別ブランチ）

| 機能 | ステータス | 概要 |
|---|---|---|
| 資産管理 フェーズ1（物件・オーナー・契約・賃料入出金） | 実装中（テスト環境） | Wealth Park / GMO賃貸DXを参考にした独自CRM。既存タスク管理システムのアップデートと並行作業のため `claude/crm-asset-management-system-0bs8i0` ブランチで開発し、管理者限定ナビ配下でテスト。実用段階でmainへ反映予定 |
| 実際の送金・決済連携 | 未着手・スコープ外 | フェーズ1では入出金の記録・集計のみ。実際の送金実行は行わない方針 |
