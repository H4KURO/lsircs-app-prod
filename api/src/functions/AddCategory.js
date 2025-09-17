const { CosmosClient } = require("@azure/cosmos");
const { v4: uuidv4 } = require('uuid'); // IDを生成するためにuuidライブラリを使用

const connectionString = process.env.CosmosDBConnectionString;
const client = new CosmosClient(connectionString);
const databaseId = "lsircs-database";
const containerId = "Categories";

module.exports = async function (context, req) {
    context.log('AddCategory APIが呼び出されました。');

    const { name, color } = req.body; // ★確認ポイント2

    if (!name || !color) {
        context.res = {
            status: 400, // Bad Request
            body: { message: "カテゴリー名と色は必須です。" }
        };
        return;
    }

    try {
        const newCategory = {
            id: uuidv4(), // 新しい一意のIDを生成
            name: name,
            color: color
        };

        const database = client.database(databaseId);
        const container = database.container(containerId);
        const { resource: createdItem } = await container.items.create(newCategory);

        context.res = {
            status: 201, // Created
            body: createdItem
        };

    } catch (error) {
        context.log.error('カテゴリー追加中にエラーが発生しました:', error);
        context.res = {
            status: 500,
            body: { message: "サーバーエラーにより、カテゴリーの追加に失敗しました。" }
        };
    }
};
```
**構成ファイル (`staticwebapp.config.json`内の該当部分):**
```json
{
  "route": "/api/AddCategory",
  "methods": ["POST"],
  "allowedRoles": ["administrator"] // ★管理者のみが追加できるように設定 (必要に応じて変更)
}
