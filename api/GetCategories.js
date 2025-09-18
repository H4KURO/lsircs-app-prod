const { CosmosClient } = require("@azure/cosmos");

const connectionString = process.env.CosmosDBConnectionString;
const client = new CosmosClient(connectionString);
const databaseId = "lsircs-database";
const containerId = "Categories"; // ★確認ポイント1

module.exports = async function (context, req) {
    context.log('GetCategories APIが呼び出されました。');

    try {
        const database = client.database(databaseId);
        const container = database.container(containerId);

        // クエリを実行して全てのドキュメントを取得
        const { resources: items } = await container.items
            .query("SELECT * from c")
            .fetchAll();

        context.res = {
            status: 200, /* OK */
            body: items
        };

    } catch (error) {
        context.log.error('カテゴリー取得中にエラーが発生しました:', error);
        context.res = {
            status: 500, // Internal Server Error
            body: { message: "サーバーエラーにより、カテゴリーの取得に失敗しました。" }
        };
    }
};
```

**構成ファイル (`staticwebapp.config.json`内の該当部分):**
```json
{
  "route": "/api/GetCategories",
  "allowedRoles": ["authenticated"]
}
