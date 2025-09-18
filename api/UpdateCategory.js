const { CosmosClient } = require("@azure/cosmos");

const connectionString = process.env.CosmosDBConnectionString;
const client = new CosmosClient(connectionString);
const databaseId = "lsircs-database";
const containerId = "Categories";

module.exports = async function (context, req) {
    context.log('UpdateCategory APIが呼び出されました。');

    const categoryId = req.params.id; // ★確認ポイント3
    const { name, color } = req.body;

    if (!name || !color) {
        context.res = {
            status: 400,
            body: { message: "カテゴリー名と色は必須です。" }
        };
        return;
    }

    try {
        const updatedCategory = {
            id: categoryId,
            name: name,
            color: color
        };

        const database = client.database(databaseId);
        const container = database.container(containerId);
        const { resource: replacedItem } = await container.item(categoryId, categoryId).replace(updatedCategory);

        context.res = {
            status: 200, // OK
            body: replacedItem
        };

    } catch (error) {
        // 項目が見つからない場合は404エラー
        if (error.code === 404) {
            context.res = {
                status: 404, // Not Found
                body: { message: "指定されたカテゴリーが見つかりません。" }
            };
        } else {
            context.log.error('カテゴリー更新中にエラーが発生しました:', error);
            context.res = {
                status: 500,
                body: { message: "サーバーエラーにより、カテゴリーの更新に失敗しました。" }
            };
        }
    }
};
```

**構成ファイル (`staticwebapp.config.json`内の該当部分):**
```json
{
  "route": "/api/UpdateCategory/{id}", // URLにIDを含む
  "methods": ["PUT"],
  "allowedRoles": ["administrator"]
}
