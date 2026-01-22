# セキュリティ設定完了チェックリスト

このプロジェクトのセキュリティ設定を完了するためのチェックリストです。

## ✅ 完了した作業

- [x] `.gitignore`ファイルの作成
- [x] `local.settings.json.example`テンプレートの作成
- [x] `SECURITY.md`セキュリティガイドラインの作成
- [x] `README.md`プロジェクトドキュメントの作成
- [x] `CLEANUP.md`不要ファイルリストの作成
- [x] `local.settings.json.WARNING`警告付きファイルの作成

## 🚨 即座に実行が必要な作業

### 1. 認証情報のローテーション（最優先）

以下のすべての認証情報を即座に再生成してください：

#### Azure Cosmos DB
1. [Azure Portal](https://portal.azure.com)にログイン
2. Cosmos DBアカウント「lsircs-db-h4kuro」を開く
3. 「キー」セクションに移動
4. 「プライマリ接続文字列の再生成」をクリック
5. 新しい接続文字列を安全に保管

#### Slack
1. [Slack API](https://api.slack.com/apps)にログイン
2. アプリ設定を開く
3. **Bot Token**の再生成:
   - OAuth & Permissions → 「Reinstall to Workspace」
4. **Signing Secret**の再生成:
   - Basic Information → App Credentials → 「Regenerate」

#### Azure Storage (Box Import)
1. Azure Portalにログイン
2. ストレージアカウント「boximport」を開く
3. 「アクセスキー」セクションに移動
4. 「key1の再生成」をクリック
5. 新しい接続文字列を安全に保管

### 2. ローカル環境の更新

```bash
# 1. local.settings.jsonを更新
cd api
# local.settings.jsonを編集して新しい認証情報を設定

# 2. 動作確認
func start
```

### 3. Azure Function Appの設定更新

```bash
# Azure CLIで設定を更新（または Azure Portal で手動更新）
az functionapp config appsettings set \
  --name <your-function-app-name> \
  --resource-group <your-resource-group> \
  --settings \
    "CosmosDbConnectionString=<新しい接続文字列>" \
    "SLACK_BOT_TOKEN=<新しいボットトークン>" \
    "SLACK_SIGNING_SECRET=<新しい署名シークレット>" \
    "BOX_IMPORT_STORAGE_CONNECTION=<新しいストレージ接続文字列>"
```

### 4. Git履歴のクリーンアップ

⚠️ **重要**: Git履歴から機密情報を削除してください

```bash
# BFG Repo-Cleanerを使用（推奨）
# https://rtyley.github.io/bfg-repo-cleaner/

# 1. リポジトリのミラークローンを作成
git clone --mirror git@github.com:your-org/lsir-cs.git

# 2. BFGで機密ファイルを削除
bfg --delete-files local.settings.json lsir-cs.git

# 3. 履歴を書き換え
cd lsir-cs.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 4. 強制プッシュ
git push --force
```

または手動で：

```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch api/local.settings.json" \
  --prune-empty --tag-name-filter cat -- --all

git push origin --force --all
git push origin --force --tags
```

### 5. チームへの通知

すべてのチームメンバーに以下を通知：

1. 認証情報が変更されたこと
2. 新しい`local.settings.json.example`から設定をコピーする必要があること
3. Gitリポジトリを再クローンまたは履歴を更新する必要があること

```bash
# チームメンバーが実行すべきコマンド
git fetch origin
git reset --hard origin/main
git clean -fdx
```

## 📋 確認事項

作業完了後、以下を確認してください：

- [ ] すべての認証情報を再生成した
- [ ] ローカル環境で新しい認証情報を設定した
- [ ] Azure Function Appで新しい認証情報を設定した
- [ ] Git履歴から機密情報を削除した
- [ ] チームメンバーに通知した
- [ ] アプリケーションが正常に動作することを確認した

## 🔐 Azure Key Vault移行（推奨）

今後のセキュリティ向上のため、Azure Key Vaultへの移行を推奨します：

1. Azure Key Vaultの作成
2. シークレットの追加
3. Function AppにマネージドIDを設定
4. Key Vault参照に変更

詳細は`SECURITY.md`の「Production Environment」セクションを参照してください。

## 📞 サポート

質問や問題がある場合は、開発チームに連絡してください。

---

**作成日**: 2026-01-13
**最終更新**: 2026-01-13
