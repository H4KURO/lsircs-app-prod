// api/src/functions/UpdateTask.js

const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");

// ... (データベース接続情報は変更なし) ...
const connectionString = process.env.CosmosDbConnectionString;
const client = new CosmosClient(connectionString);
const databaseId = "lsircs-database";
const containerId = "Tasks";


app.http('UpdateTask', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'UpdateTask/{id}',
    handler: async (request, context) => {
        // ▼▼▼ ユーザー情報をヘッダーから取得 ▼▼▼
        const header = request.headers.get('x-ms-client-principal');
        const encoded = Buffer.from(header, 'base64');
        const decoded = encoded.toString('ascii');
        const clientPrincipal = JSON.parse(decoded);

        try {
            const id = request.params.id;
            const updates = await request.json();
            
            const database = client.database(databaseId);
            const container = database.container(containerId);

            const { resource: existingTask } = await container.item(id, id).read();
            if (!existingTask) {
                return { status: 404, body: "Task not found." };
            }

            const updatedTask = { ...existingTask, ...updates };

            // ▼▼▼ 更新者と更新日時、ステータス履歴を記録 ▼▼▼
            updatedTask.lastUpdatedAt = new Date().toISOString();
            updatedTask.lastUpdatedById = clientPrincipal.userId;
            updatedTask.lastUpdatedByName = clientPrincipal.userDetails;

            // ステータスが変更された場合、履歴に追加
            if (updates.status && updates.status !== existingTask.status) {
                // 履歴がなければ初期化
                if (!updatedTask.statusHistory) {
                    updatedTask.statusHistory = [];
                }
                updatedTask.statusHistory.push({
                    status: updates.status,
                    changedAt: updatedTask.lastUpdatedAt,
                    changedById: clientPrincipal.userId,
                    changedByName: clientPrincipal.userDetails
                });
            }

            const { resource: replacedItem } = await container.item(id, id).replace(updatedTask);

            return { status: 200, jsonBody: replacedItem };

        } catch (error) {
            if (error.code === 404) { return { status: 404, body: "Task not found." }; }
            return { status: 500, body: "Error updating task." };
        }
    }
});