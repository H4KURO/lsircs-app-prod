const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");

// local.settings.jsonから接続文字列を読み込む
const connectionString = process.env.CosmosDbConnectionString;
const client = new CosmosClient(connectionString);

// データベースとコンテナーの名前
const databaseId = "lsircs-database";
const containerId = "Tasks";

app.http('GetTasks', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        // 接続文字列が設定されていない場合はエラーを返す
        if (!connectionString) {
            return { status: 500, body: "Database connection string is not configured." };
        }

        try {
            const database = client.database(databaseId);
            const container = database.container(containerId);

            // ★★★ ここが最後の修正点です ★★★
            // コンテナーからすべてのアイテム（タスク）を取得
            const { resources: items } = await container.items.readAll().fetchAll();
            
            return {
                status: 200,
                jsonBody: items
            };
        } catch (error) {
            context.error("Error fetching tasks from the database:", error);
            return {
                status: 500,
                body: "Error fetching tasks from the database."
            };
        }
    }
});