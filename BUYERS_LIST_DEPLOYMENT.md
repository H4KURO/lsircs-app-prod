# Buyers List機能 デプロイメントガイド

## 📋 実装完了済みコンポーネント

### バックエンドAPI（7ファイル）
- ✅ `buyersListSchema.js` - データモデル定義
- ✅ `GetBuyersList.js` - 一覧取得
- ✅ `CreateBuyersListItem.js` - 新規作成
- ✅ `UpdateBuyersListItem.js` - 更新
- ✅ `DeleteBuyersListItem.js` - 削除
- ✅ `ImportBuyersListExcel.js` - Excelインポート
- ✅ `staticwebapp.config.json` - ルート設定（更新済み）

### フロントエンド（3ファイル）
- ✅ `BuyersListView.jsx` - メイン画面
- ✅ `locales/en/common.json` - 英語翻訳（更新済み）
- ✅ `locales/ja/common.json` - 日本語翻訳（更新済み）

### ドキュメント
- ✅ `APP_INTEGRATION_GUIDE.md` - 統合手順書

---

## 🚀 デプロイ手順

### ステップ1: Cosmos DBの準備

#### Azure Portalでの作業
1. Azure Portalにログイン
2. Cosmos DBアカウント「lsircs-db-h4kuro」を開く
3. 「Data Explorer」を選択
4. 「New Container」をクリック
5. 以下の設定で作成：
   - **Database ID**: `lsircs-database`（既存のデータベースを選択）
   - **Container ID**: `BuyersList`
   - **Partition Key**: `/id`
   - **Throughput**: 400 RU/s（または既存設定に合わせる）

---

### ステップ2: App.jsxの統合

`APP_INTEGRATION_GUIDE.md`を参照して、以下を実施：

1. **インポート文の追加**
   ```jsx
   import BuyersListView from './BuyersListView';
   import ListAltIcon from '@mui/icons-material/ListAlt';
   ```

2. **メニュー項目の追加**
   ```jsx
   const menuItems = [
     // ... 既存のメニュー項目
     { 
       id: 'buyersList', 
       label: t('nav.buyersList'), 
       icon: <ListAltIcon />, 
       view: 'buyersList' 
     },
   ];
   ```

3. **ビューのレンダリング追加**
   ```jsx
   case 'buyersList':
     return <BuyersListView />;
   ```

---

### ステップ3: ローカルテスト

```bash
# バックエンド起動
cd api
npm install  # 初回のみ
func start

# フロントエンド起動（別ターミナル）
cd app
npm install  # 初回のみ
npm run dev
```

#### テスト項目
- [ ] メニューに「Buyers List」が表示される
- [ ] クリックすると画面が開く
- [ ] 「新規追加」で空のフォームが開く
- [ ] データを入力して保存できる
- [ ] 一覧に表示される
- [ ] 編集・削除ができる

---

### ステップ4: 初期データのインポート

1. Box内の既存Excelファイルをダウンロード：
   - パス: `/Box/PCS Monthly report/2. Ward Village/8. TPWV/★Buyers List/TPWV_Buyers_List.xlsx`

2. ウェブアプリからインポート：
   - Buyers List画面を開く
   - 「Excelからインポート」ボタンをクリック
   - ダウンロードしたExcelファイルを選択
   - インポート完了を確認

3. データ確認：
   - 16件のデータが表示されることを確認
   - ユニット番号順にソートされていることを確認

---

### ステップ5: Azure へのデプロイ

#### 方法A: GitHub Actions（自動）
既存の GitHub Actions ワークフローが自動的にデプロイします。

```bash
git add .
git commit -m "feat: Add Buyers List management feature"
git push origin main
```

#### 方法B: 手動デプロイ
```bash
# Azure CLI でデプロイ
az staticwebapp deploy \
  --name lsircs-app \
  --resource-group lsircs-rg \
  --app-location ./app \
  --api-location ./api \
  --output-location dist
```

---

### ステップ6: 本番環境での確認

1. **デプロイ完了を確認**
   - Azure Portalで Static Web Appの状態を確認
   - デプロイメント履歴で成功を確認

2. **機能テスト**
   - [ ] メニューから Buyers List を開く
   - [ ] データが表示される（初回は空）
   - [ ] Excelインポートが正常動作する
   - [ ] CRUD操作が全て正常動作する

3. **パフォーマンステスト**
   - [ ] 一覧表示が1秒以内
   - [ ] 保存・更新が2秒以内
   - [ ] Excelインポートが10秒以内（16件の場合）

---

## 🔧 トラブルシューティング

### 問題: メニューに表示されない
**原因**: App.jsxの統合が不完全  
**解決策**: `APP_INTEGRATION_GUIDE.md`を再確認

### 問題: APIエラー（500）
**原因**: Cosmos DBコンテナが存在しない  
**解決策**: ステップ1を再実行

### 問題: データが表示されない
**原因**: 
1. Cosmos DBが空
2. 接続文字列の設定ミス

**解決策**:
1. Excelインポートを実行
2. `local.settings.json`の`CosmosDbConnectionString`を確認

### 問題: Excelインポートが失敗
**原因**: ファイル形式が正しくない  
**解決策**: 
- 元のExcelファイルを使用
- シート名が「Buyers list」であることを確認
- ヘッダー行が3行目から始まることを確認

---

## 📊 次のステップ（フェーズ2）

フェーズ1完了後、以下の機能を段階的に追加予定：

### フェーズ2: Box自動同期（2-3週間後）
- 定期的なBox→データベース同期
- データベース→Box自動更新
- 変更検出・マージ機能

### 追加予定フィールド（優先順位順）
1. Escrow番号
2. 住所
3. 床面積・部屋タイプ
4. 支払いスケジュール（手付金、残金）
5. オプション情報（アップグレード）
6. 駐車場・ストレージ情報
7. 各種書類の提出状況

---

## 📝 メンテナンス

### 定期作業
- **週次**: Excelファイルとの同期確認
- **月次**: データベースのバックアップ確認
- **四半期**: パフォーマンスレビュー

### データバックアップ
Cosmos DBは自動バックアップされますが、重要な変更前には：
```bash
# データエクスポート（オプション）
az cosmosdb sql container export \
  --account-name lsircs-db-h4kuro \
  --database-name lsircs-database \
  --name BuyersList \
  --output backup.json
```

---

## 🎯 成功基準

フェーズ1の成功基準：
- ✅ 16件の既存データが正常にインポートされる
- ✅ 新規追加・編集・削除が正常動作する
- ✅ ユーザーインターフェースが直感的で使いやすい
- ✅ 応答時間が2秒以内
- ✅ エラーハンドリングが適切
- ✅ 多言語対応が動作する

---

## 📧 サポート

質問や問題が発生した場合：
1. このドキュメントのトラブルシューティングを確認
2. ログを確認（Azure Portal → Function App → Logs）
3. 開発チームに連絡

---

**作成日**: 2026-01-22  
**バージョン**: 1.0 (Phase 1)  
**次回更新予定**: Phase 2開始時
