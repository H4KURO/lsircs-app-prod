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
