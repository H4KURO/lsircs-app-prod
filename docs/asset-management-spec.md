# 資産管理CRM 仕様書（フェーズ1/2/3）

> **この文書について**: 資産管理CRM機能の詳細仕様。将来的なマニュアル作成のベース資料として、
> **常に最新かつ正しい状態を先頭に記載**し、過去の変更点は末尾の「変更履歴」にまとめる。
> アプリ全体の仕様書は [`/SPEC.md`](../SPEC.md)（5.10・7・8.5-8.11・9節）にも同内容を反映済み。差異が出た場合は本ファイルとSPEC.mdの両方を更新すること。

---

## 最新状態サマリー

| 項目 | 内容 |
|---|---|
| ステータス | フェーズ1・2・3実装済み・テスト環境で検証中 |
| 公開範囲 | 管理者ユーザーのみ（`accessStatus.isAdmin`） |
| 画面 | `AssetManagementView`（7タブ構成） |
| 送金・決済 | 行わない（記録・集計のみ） |
| ブランチ | `claude/crm-asset-management-system-0bs8i0`（main未マージ） |
| 新規依存 | `@mui/x-charts`（グラフ描画）・`@mui/x-data-grid`（グリッド式収支入力）、いずれもフェーズ2で追加。フェーズ3は追加ライブラリなし（ポーリング方式） |
| 契約書類 | Box等の共有フォルダURLを`AssetContracts.documentsFolderUrl`に保存・表示（フェーズ4の一部を前倒し。フォルダ作成・共有はBox側で手動対応） |

---

## 1. 画面構成

ナビゲーションアイコン「資産管理（テスト）」（管理者のみ表示）→ `AssetManagementView.jsx` が7タブを管理。

| タブ | コンポーネント | 概要 |
|---|---|---|
| 物件 | `AssetPropertiesTab.jsx` | 物件台帳。種別・住所・オーナー・戸数・築年・稼働ステータス |
| オーナー | `AssetOwnersTab.jsx` | オーナー台帳。連絡先・振込先銀行情報 |
| 契約 | `AssetContractsTab.jsx` | 賃貸契約。物件・入居者・賃料・管理費・敷金・契約期間・ステータス・書類フォルダURL（Box等） |
| 賃料入出金 | `AssetRentTransactionsTab.jsx` | 月次の入金予定額・入金実績・オーナー送金予定額の記録 |
| 支出（フェーズ2） | `AssetExpensesTab.jsx` | 物件ごとの支出記録。科目（修繕費/管理委託手数料/保険料/固定資産税/その他）・金額・支払日・支払先 |
| 収支ダッシュボード（フェーズ2） | `AssetFinancialDashboardTab.jsx` | 物件を選択し、直近12ヶ月の月次収入・支出・収支をグラフ＋一覧表で可視化。加えてWealth Park風のグリッド式収支入力（年単位、賃料収入・支出セルとも編集可）を提供 |
| チャット（フェーズ3） | `AssetChatTab.jsx` | 社内スタッフ間チャット。スレッド作成（任意で物件と紐づけ）＋メッセージ送受信、5秒ポーリング |

各タブは一覧テーブル＋追加・編集ダイアログ＋削除ボタンのCRUD UI（既存の`ProjectsView`と同じパターン）。参照データ（オーナー・物件・契約）は`AssetManagementView`がマウント時に先読みし、タブをまたいでプルダウン選択に利用する。収支ダッシュボードは独自に`AssetRentTransactions`と`AssetExpenses`を取得して集計する。チャットは独自に`GetUserProfile`（自分の表示名取得）・`AssetChatThreads`・`AssetChatMessages`を取得する。

### エンティティの関連

```
オーナー (1) ── (N) 物件 ── (N) 契約 ── (N) 賃料入出金（月次）
                     └── (N) 支出（月次）
```

## 2. データモデル

### 2.1 オーナー（Cosmos DB: `AssetOwners`）

| フィールド | 型 | 説明 |
|---|---|---|
| id | string | ドキュメントID（UUID） |
| name | string | オーナー名（必須） |
| kana | string | フリガナ |
| contactEmail / contactPhone | string | 連絡先 |
| address | string | 住所 |
| bankName / bankBranch / bankAccountType / bankAccountNumber / bankAccountHolder | string | 振込先銀行情報 |
| notes | string | 備考 |
| createdAt / updatedAt / createdBy / updatedBy | string | 監査項目 |

### 2.2 物件（Cosmos DB: `AssetProperties`）

| フィールド | 型 | 説明 |
|---|---|---|
| id | string | ドキュメントID |
| name | string | 物件名（必須） |
| address | string | 住所 |
| propertyType | enum | `apartment`(マンション) / `house`(戸建) / `building`(ビル・一棟) / `land`(土地) / `other` |
| ownerId | string\|null | オーナーへの参照 |
| unitCount | number\|null | 戸数 |
| builtYear | number\|null | 築年 |
| status | enum | `active`(稼働中) / `inactive`(非稼働) |
| notes | string | 備考 |

### 2.3 賃貸契約（Cosmos DB: `AssetContracts`）

| フィールド | 型 | 説明 |
|---|---|---|
| id | string | ドキュメントID |
| propertyId | string | 物件への参照（必須） |
| unitNumber | string | 号室 |
| tenantName | string | 入居者名（必須） |
| tenantContact | string | 入居者連絡先 |
| rentAmount / managementFeeAmount / depositAmount | number | 賃料・管理費・敷金（円） |
| startDate / endDate | string | 契約期間（YYYY-MM-DD） |
| status | enum | `active`(契約中) / `pending`(契約準備中) / `terminated`(解約済み) |
| notes | string | 備考 |
| documentsFolderUrl | string | 契約書類・重要事項説明書等を格納したBox等の共有フォルダURL（任意） |

### 2.4 賃料入出金（Cosmos DB: `AssetRentTransactions`）

| フィールド | 型 | 説明 |
|---|---|---|
| id | string | ドキュメントID |
| contractId | string | 契約への参照（必須） |
| propertyId | string\|null | 作成時に契約から自動セット |
| yearMonth | string | 対象年月（YYYY-MM、必須） |
| expectedAmount / receivedAmount | number | 入金予定額・入金実績額 |
| receivedDate | string | 入金日 |
| ownerPayoutAmount / ownerPayoutDate | number / string | オーナー送金予定額・予定日（**記録のみ、実際の送金は行わない**） |
| status | enum | `unpaid`(未入金) / `partial`(一部入金) / `paid`(入金済み) |
| notes | string | 備考 |

### 2.5 支出（Cosmos DB: `AssetExpenses`）（フェーズ2）

| フィールド | 型 | 説明 |
|---|---|---|
| id | string | ドキュメントID |
| propertyId | string | 物件への参照（必須） |
| category | enum | `repair`(修繕費) / `management_fee`(管理委託手数料) / `insurance`(保険料) / `tax`(固定資産税) / `other`(その他) |
| yearMonth | string | 対象年月（YYYY-MM、必須） |
| amount | number | 支出額（円） |
| paidDate | string | 支払日（YYYY-MM-DD） |
| vendor | string | 支払先 |
| notes | string | 備考 |

### 2.6 チャットスレッド（Cosmos DB: `AssetChatThreads`）（フェーズ3）

| フィールド | 型 | 説明 |
|---|---|---|
| id | string | ドキュメントID |
| type | enum | `staff`固定（フェーズ4で`owner`/`customer`を追加予定） |
| title | string | スレッド名（必須） |
| relatedPropertyId | string\|null | 物件への参照（任意） |
| createdAt / updatedAt | string | 監査項目。`updatedAt`は最新メッセージ送信時に更新（一覧の並び替えに使用） |
| createdBy | string | 作成者メールアドレス |

### 2.7 チャットメッセージ（Cosmos DB: `AssetChatMessages`）（フェーズ3）

| フィールド | 型 | 説明 |
|---|---|---|
| id | string | ドキュメントID |
| threadId | string | スレッドへの参照（必須） |
| senderEmail | string | 投稿者メールアドレス（削除権限の判定に使用） |
| senderName | string | 表示名（`displayName`、無ければメールアドレス） |
| body | string | メッセージ本文（必須） |
| createdAt | string | 送信日時 |

## 3. APIエンドポイント

全て `x-ms-client-principal` ヘッダーによる認証必須（未ログイン時 401）。一覧取得はGET、作成・更新・削除はPOST。

| エンティティ | GET | POST（作成） | POST（更新） | POST（削除） |
|---|---|---|---|---|
| オーナー | `GetAssetOwners` | `CreateAssetOwner` | `UpdateAssetOwner` | `DeleteAssetOwner` |
| 物件 | `GetAssetProperties` | `CreateAssetProperty` | `UpdateAssetProperty` | `DeleteAssetProperty` |
| 契約 | `GetAssetContracts` | `CreateAssetContract` | `UpdateAssetContract` | `DeleteAssetContract` |
| 賃料入出金 | `GetAssetRentTransactions` | `CreateAssetRentTransaction` | `UpdateAssetRentTransaction` | `DeleteAssetRentTransaction` |
| 支出（フェーズ2） | `GetAssetExpenses` | `CreateAssetExpense` | `UpdateAssetExpense` | `DeleteAssetExpense` |

更新・削除は `id` 必須。作成時の必須フィールドは各データモデル表の「（必須）」記載の通り。

**チャット関連（フェーズ3）**は他エンティティと形が異なるため別掲:

| メソッド | エンドポイント | 説明 |
|---|---|---|
| GET | `GetAssetChatThreads` | スレッド一覧取得（最終更新降順） |
| POST | `CreateAssetChatThread` | スレッド作成（title必須） |
| POST | `DeleteAssetChatThread` | スレッド削除（所属メッセージも削除） |
| GET | `GetAssetChatMessages` | メッセージ一覧取得（`?threadId=xxx`必須、作成日時昇順） |
| POST | `CreateAssetChatMessage` | メッセージ送信（threadId・body必須） |
| POST | `DeleteAssetChatMessage` | メッセージ削除（投稿者本人のみ、`senderEmail`が一致しないと403） |

> **実装上の注意（フェーズ1で発生した不具合）**: 各エンティティの`Create*`系APIは、Cosmos DBのコンテナが未作成でも自動作成されるよう`cosmosClient.js`の`ensureNamedContainer`（存在しなければ作成）を使うこと。当初`getNamedContainer`（既存前提の参照のみ）を使っていたため、初回投入時にコンテナが存在せず全件500エラーになる不具合が発生した（プレビュー環境でのテストデータ投入時に発覚・修正済み）。

## 4. アクセス制御

- ナビゲーションの「資産管理（テスト）」アイコンは `accessStatus.isAdmin === true` のユーザーにのみ表示（`App.jsx` の `navItems`）
- `view=assets` への直接URLアクセスも、管理者以外は `AccessDeniedView` を表示（`App.jsx` の `renderView` 内でガード）
- バックエンドAPI自体は現時点でログイン済みユーザーなら誰でも呼び出せる（管理者チェックはフロントエンドのみ）。フェーズ2以降でAPI側の管理者チェックも検討の余地あり

## 5. 運用上の注意

- **実際の送金・決済は一切行わない**。`ownerPayoutAmount` 等はあくまで記録・集計項目
- テスト環境のため、画面上部に警告バナーを常時表示
- Azure Static Web Apps のプレビュー環境は`main`の方針としては自動生成されない設定（2026-07-30、`df8d0c1`の変更による）。ただしPR #11に限り、動作確認のためワークフローの`build_and_deploy_job`条件を一時的に復活させている（確認完了後にrevert予定。詳細はPR #11のコミット履歴参照）
- **収支ダッシュボードの配色**: 黒字/赤字を表す緑・赤ペアは、色覚多様性検証（dataviz skillの`validate_palette.js`）でCVD separationが閾値未達（ΔE 4.1）だったため、色のみに依存せずゼロ基準線からの向き＋バー直接ラベルで冗長化している。今後この画面の配色を変更する際は同様に検証すること

## 6. フェーズ2で追加した機能（収支ダッシュボード）

- 新規エンティティ `AssetExpenses`（支出記録）を追加
- 新規タブ「収支ダッシュボード」（`AssetFinancialDashboardTab.jsx`）を追加。物件を選択すると:
  1. 月次収入・支出の推移を`@mui/x-charts`のグラフ（棒グラフ、固定系列色: 収入=青`#2a78d6`、支出=オレンジ`#eb6834`）で表示
  2. 月次収支（黒字/赤字）を別グラフで表示（黒字=緑`#0ca30c`、赤字=赤`#d03b3b`、バーの向き＋直接ラベルで色以外の手がかりも提供）
  3. 同じデータを一覧表でも表示（アクセシビリティ対応、数値の正確な確認用）
- 集計は直近12ヶ月分をクライアント側で計算（`AssetRentTransactions.receivedAmount`と`AssetExpenses.amount`を`yearMonth`ごとに合算）。データ量が増えた場合は専用集計APIへの切り出しを検討

## 7. フェーズ2追加機能（グリッド式収支入力）

オーナー様からWealth Parkの収支管理画面（スプレッドシート風グリッド、行=収支項目・列=月）を参考にしたいとの要望を受けて追加。

- `@mui/x-data-grid` の `DataGrid` を使用。ライブラリの列定義(`GridColDef`)は「列単位でtrue/falseのみ」しか`editable`を指定できないため、行ごとの編集可否は**グリッド本体の`isCellEditable` prop**（`(params) => params.row.type === 'expense' || params.row.type === 'income'`）で判定している。列に`isCellEditable`を書いても無視される点に注意（実装時に踏んだ落とし穴）
- **行構成**: `賃料収入`（`AssetRentTransactions`集計、**編集可**）／支出科目5行（`AssetExpenses`、編集可）／`収支`（自動計算、編集不可）
- **列構成**: 1月〜12月（`gridYear` stateで年を切替、◀▶ボタン）＋ 年間合計
- **支出セルの保存ロジック**（`handleProcessRowUpdate`）:
  1. 対象の物件・科目・年月に一致する`AssetExpenses`レコードを`expenses`ステートから検索
  2. 0件 → `CreateAssetExpense`で新規作成
  3. 1件 → `UpdateAssetExpense`でその1件の金額を更新
  4. 2件以上 → 更新対象を一意に決められないため保存を拒否し、エラーメッセージで「支出」タブでの編集を促す
- **収入セルの保存ロジック**（`handleProcessRowUpdate`）: `AssetRentTransactions`は契約(`AssetContracts`)単位の記録であり、賃料収入セルは複数契約の合算になり得るため、支出より慎重な分岐にしている
  1. 対象の物件・年月に一致する`AssetRentTransactions`を`transactions`ステートから検索
  2. 1件 → その1件の`receivedAmount`を`UpdateAssetRentTransaction`で更新
  3. 0件 → 物件に紐づく契約（`contracts`ステート）を確認し、**契約が1件のみ**なら`CreateAssetRentTransaction`で新規作成（`expectedAmount`＝`receivedAmount`＝入力値、`status`は入力値>0なら`paid`／0なら`unpaid`）
  4. 0件かつ契約が0件 → 「先に『契約』タブで契約を登録してください」と案内し保存を拒否
  5. 0件かつ契約が2件以上、または記録が2件以上 → どの契約の入金か一意に特定できないため保存を拒否し、「賃料入出金」タブでの編集・契約指定登録を促す
- 保存成功後は`fetchData()`で収入・支出を再取得し、グリッド自身だけでなく上部のグラフ・一覧表にも即座に反映
- 収支行の負の値（赤字）はセルに`asset-grid-negative`クラスを付与し赤字色で表示（色覚多様性の観点から、値そのものもマイナス符号付きで表示されるため色だけに依存しない）

## 8. フェーズ3追加機能（社内チャット）

オーナー様の「チャット機能は将来実装前提で枠組みだけ作っておきたい／テスト環境で無料で試せるなら今から実装してほしい」という要望に対し、企画部の技術調査（Wealth Park・GMO賃貸DXともにチャットを主要コミュニケーション手段として提供）を踏まえ、**社内スタッフ間チャットに絞って実装**（オーナー・顧客向けはフェーズ4）。

- **リアルタイム性の実現方法**: Azure SignalR Service等の追加リソースは使わず、**5秒間隔のポーリング**（`AssetChatTab.jsx`の`useEffect`内`setInterval`で`GetAssetChatThreads`/`GetAssetChatMessages`を定期呼び出し）で実現。既存のCosmos DB + Azure Functions構成のまま追加費用なしで動作する
- **画面構成**: 左ペインにスレッド一覧（＋新規作成ボタン）、右ペインに選択中スレッドのメッセージ表示＋送信欄（LINE/Slack風の吹き出しUI、自分の発言は右寄せ・色反転）
- **送信者表示名**: フロントエンドが`GetUserProfile`で自分の`displayName`を取得し、メッセージ送信時に`senderName`としてリクエストに含める（未設定ならメールアドレスにフォールバック）。サーバー側は`x-ms-client-principal`から取れる`userDetails`（メールアドレス）を`senderEmail`として真正性の判定に使う
- **メッセージ削除**: `senderEmail`が一致する自分の投稿のみ削除可能（他人の発言は削除ボタン自体を表示しない＋サーバー側でも403で拒否する二重チェック）
- **スレッドと物件の紐づけ**: スレッド作成時に任意で`relatedPropertyId`を指定可能。物件に関する相談用スレッドなどを想定しているが、必須ではない（`null`可）
- **スレッド削除**: `DeleteAssetChatThread`はスレッド本体に加えて、そのスレッドに属する全メッセージも合わせて削除する

## 9. 契約書類フォルダのリンク保存（フェーズ4の一部を前倒し）

オーナー様から「顧客にBoxのフォルダをリンクし、契約書類等を格納していけるか」と質問を受け、実現レベルを2案提示:
1. **リンク保存のみ**（今回採用）: Box側でのフォルダ作成・顧客招待は手動、そのリンクをアプリに保存・表示するだけ
2. **Box API連携による自動化**: 契約作成時に自動でフォルダ作成・顧客招待。Box Developer ConsoleでのAPPアプリ登録とAzureへの認証情報設定が必要（オーナー様側の作業が発生するため、今回は見送り。将来のフェーズで別途検討）

**実装内容**:
- `AssetContracts` に `documentsFolderUrl`（文字列、任意）フィールドを追加
- 「契約」タブの一覧に「書類」列を追加。URLが設定されていればフォルダアイコンをクリックで新しいタブで開く（`target="_blank" rel="noopener noreferrer"`）。未設定の場合は「未設定」と表示
- 追加・編集ダイアログに「書類フォルダURL（Box等）」の入力欄を追加。ヘルパーテキストで運用方法（フォルダ作成・共有はBox側で行う）を明記
- 既存の`SpreadsheetView.jsx`のBox共有リンク埋め込みパターンと同様、URLの妥当性チェックは行わず単純な文字列として保存・リンク表示のみ行う

---

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-07-30 | 初版作成。フェーズ1（物件・オーナー・契約・賃料入出金）の画面・API・データモデルを記載 |
| 2026-07-30 | フェーズ2（支出記録＋収支ダッシュボード）を追加。`ensureNamedContainer`未使用によるコンテナ未作成500エラーの修正、配色のCVD検証結果を記載 |
| 2026-07-31 | フェーズ2にWealth Park風のグリッド式収支入力（`@mui/x-data-grid`）を追加。行単位の編集可否判定はグリッド本体の`isCellEditable`で行う点を実装メモとして記載 |
| 2026-07-31 | 賃料収入行もグリッドから編集可能に変更。契約・記録の件数に応じた安全な更新/新規作成/拒否ロジックを追加 |
| 2026-07-31 | フェーズ3（社内チャットの土台）を追加。`AssetChatThreads`/`AssetChatMessages`の2コレクション、5秒ポーリング方式、自分の投稿のみ削除可能な権限モデルを記載 |
| 2026-07-31 | 契約に`documentsFolderUrl`（Box等の書類フォルダURL）を追加。フェーズ4の「契約書類管理」の一部を前倒しでリンク保存のみ実装（フォルダ作成・共有はBox側で手動対応） |
