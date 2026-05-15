# lsir-cs プロジェクト ルール

## デプロイフロー
機能追加・修正を行った際は、必ず以下をセットで実施すること：
1. コード修正
2. `git add` → `git commit` → `git push origin main`
3. push により GitHub Actions (`azure-static-web-apps-salmon-moss-07cdc8100.yml`) が自動ビルド・デプロイ

デプロイ先: Azure Static Web Apps
進捗確認: https://github.com/H4KURO/lsircs-app-prod/actions

## プロジェクト構成
- `app/` : React フロントエンド (Vite)
- `api/` : Azure Functions (Node.js 20)
- `staticwebapp.config.json` : Azure SWA ルーティング設定

## メンテナンス開始時のルール

**作業を始める前に必ず `SPEC.md` を読むこと。**

手順:
1. `SPEC.md` を読み、現在のアプリ仕様を把握する
2. 実際のコードと乖離がある箇所があれば、作業前に `SPEC.md` を修正して最新化する
3. 把握した上でメンテナンス作業を開始する

## 仕様書の更新ルール

`SPEC.md` はアプリの仕様書。**コードを変更したら必ず合わせて更新すること。**

更新が必要なケース（例）:
- 画面・機能の追加・削除・変更
- API エンドポイントの追加・削除・変更
- データモデル（フィールド・型）の変更
- タスクステータスや選択肢の追加・変更
- 外部連携（Slack・Google・AI等）の変更
- Cosmos DB コレクション構成の変更

更新手順:
1. コード修正
2. `SPEC.md` の該当セクションを更新（ファイル先頭の「最終更新」日付も更新）
3. `git add` → `git commit` → `git push`
