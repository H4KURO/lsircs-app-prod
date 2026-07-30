# 資産管理CRM 仕様書（フェーズ1）

> **この文書について**: 資産管理CRM機能の詳細仕様。将来的なマニュアル作成のベース資料として、
> **常に最新かつ正しい状態を先頭に記載**し、過去の変更点は末尾の「変更履歴」にまとめる。
> アプリ全体の仕様書は [`/SPEC.md`](../SPEC.md)（5.10・7・8.5-8.8・9節）にも同内容を反映済み。差異が出た場合は本ファイルとSPEC.mdの両方を更新すること。

---

## 最新状態サマリー

| 項目 | 内容 |
|---|---|
| ステータス | フェーズ1実装済み・テスト環境で検証中 |
| 公開範囲 | 管理者ユーザーのみ（`accessStatus.isAdmin`） |
| 画面 | `AssetManagementView`（4タブ構成） |
| 送金・決済 | 行わない（記録・集計のみ） |
| ブランチ | `claude/crm-asset-management-system-0bs8i0`（main未マージ） |

---

## 1. 画面構成

ナビゲーションアイコン「資産管理（テスト）」（管理者のみ表示）→ `AssetManagementView.jsx` が4タブを管理。

| タブ | コンポーネント | 概要 |
|---|---|---|
| 物件 | `AssetPropertiesTab.jsx` | 物件台帳。種別・住所・オーナー・戸数・築年・稼働ステータス |
| オーナー | `AssetOwnersTab.jsx` | オーナー台帳。連絡先・振込先銀行情報 |
| 契約 | `AssetContractsTab.jsx` | 賃貸契約。物件・入居者・賃料・管理費・敷金・契約期間・ステータス |
| 賃料入出金 | `AssetRentTransactionsTab.jsx` | 月次の入金予定額・入金実績・オーナー送金予定額の記録 |

各タブは一覧テーブル＋追加・編集ダイアログ＋削除ボタンのCRUD UI（既存の`ProjectsView`と同じパターン）。参照データ（オーナー・物件・契約）は`AssetManagementView`がマウント時に先読みし、タブをまたいでプルダウン選択に利用する。

### エンティティの関連

```
オーナー (1) ── (N) 物件 ── (N) 契約 ── (N) 賃料入出金（月次）
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

## 3. APIエンドポイント

全て `x-ms-client-principal` ヘッダーによる認証必須（未ログイン時 401）。一覧取得はGET、作成・更新・削除はPOST。

| エンティティ | GET | POST（作成） | POST（更新） | POST（削除） |
|---|---|---|---|---|
| オーナー | `GetAssetOwners` | `CreateAssetOwner` | `UpdateAssetOwner` | `DeleteAssetOwner` |
| 物件 | `GetAssetProperties` | `CreateAssetProperty` | `UpdateAssetProperty` | `DeleteAssetProperty` |
| 契約 | `GetAssetContracts` | `CreateAssetContract` | `UpdateAssetContract` | `DeleteAssetContract` |
| 賃料入出金 | `GetAssetRentTransactions` | `CreateAssetRentTransaction` | `UpdateAssetRentTransaction` | `DeleteAssetRentTransaction` |

更新・削除は `id` 必須。作成時の必須フィールドは各データモデル表の「（必須）」記載の通り。

## 4. アクセス制御

- ナビゲーションの「資産管理（テスト）」アイコンは `accessStatus.isAdmin === true` のユーザーにのみ表示（`App.jsx` の `navItems`）
- `view=assets` への直接URLアクセスも、管理者以外は `AccessDeniedView` を表示（`App.jsx` の `renderView` 内でガード）
- バックエンドAPI自体は現時点でログイン済みユーザーなら誰でも呼び出せる（管理者チェックはフロントエンドのみ）。フェーズ2以降でAPI側の管理者チェックも検討の余地あり

## 5. 運用上の注意

- **実際の送金・決済は一切行わない**。`ownerPayoutAmount` 等はあくまで記録・集計項目
- テスト環境のため、画面上部に警告バナーを常時表示
- Azure Static Web Apps のプレビュー環境は現在PRでは自動生成されない設定になっている（2026-07-30時点、`df8d0c1`の変更による）。Azure上での実機能確認は `main` マージ後のみ可能

---

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-07-30 | 初版作成。フェーズ1（物件・オーナー・契約・賃料入出金）の画面・API・データモデルを記載 |
