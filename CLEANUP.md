# Cleanup Required

このファイルは、Box内から削除すべき不要なファイルをリストアップしています。
これらのファイルは開発環境で自動生成されるもの、または重複ファイルです。

## 🗑️ 削除すべきファイル

### 1. 重複ファイル
これらのファイルは別の場所に正しいバージョンが存在します。

- [ ] `/TaskView.jsx` → 正: `/app/src/TaskView.jsx`
- [ ] `/test.http` → テスト用ファイル、本番環境不要

### 2. Azuriteローカル開発ファイル
これらはローカル開発時に自動生成されるファイルで、Boxに保存する必要はありません。

- [ ] `/__azurite_db_blob__.json`
- [ ] `/__azurite_db_blob_extent__.json`
- [ ] `/__azurite_db_queue__.json`
- [ ] `/__azurite_db_queue_extent__.json`

### 3. Azuriteストレージディレクトリ
これらのディレクトリはAzuriteエミュレータが使用する一時ストレージです。

- [ ] `/__blobstorage__/` （ディレクトリ全体）
- [ ] `/__queuestorage__/` （ディレクトリ全体）

## ⚠️ 削除してはいけないファイル

以下のファイル/ディレクトリは削除しないでください：

- ✅ `/.git/` → Box-GitHub統合で使用中
- ✅ `/api/local.settings.json` → ローカル開発で必要（ただしGit管理からは除外）
- ✅ `/node_modules/` → 依存関係（.gitignoreで除外済み）

## 📋 削除方法

### 手動削除（推奨）
1. Boxウェブインターフェースにログイン
2. 上記のファイル/フォルダを選択
3. 右クリック → 削除

### Git経由での削除
ローカルのGitリポジトリで作業する場合：

```bash
# 重複ファイルの削除
git rm TaskView.jsx
git rm test.http

# Azuriteファイルの削除
git rm __azurite_db_*.json
git rm -r __blobstorage__
git rm -r __queuestorage__

# コミット
git commit -m "chore: remove unnecessary files"
git push
```

## ✅ クリーンアップ後の確認

削除後、以下を確認してください：

1. `.gitignore`が正しく設定されている
2. アプリケーションが正常に動作する
3. 必要なファイルが削除されていない

## 📌 注意事項

- 削除前に必ずバックアップを取ってください
- 不明なファイルは削除前に開発チームに確認してください
- Gitリポジトリと同期する場合は、両方で削除してください
