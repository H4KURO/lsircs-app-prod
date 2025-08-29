// api/src/functions/CreateTask.js

const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");
const { v4: uuidv4 } = require("uuid");

// ... (データベース接続情報は変更なし) ...
const connectionString = process.env.CosmosDbConnectionString;
const client = new CosmosClient(connectionString);
const databaseId = "lsircs-database";
const containerId = "Tasks";

app.http('CreateTask', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        // ▼▼▼ ユーザー情報をヘッダーから取得 ▼▼▼
        const header = request.headers.get('x-ms-client-principal');
        const encoded = Buffer.from(header, 'base64');
        const decoded = encoded.toString('ascii');
        const clientPrincipal = JSON.parse(decoded);

        try {
            const taskData = await request.json();
            if (!taskData.title) {
                return { status: 400, body: "Task title is required." };
            }

            const newTask = {
                id: uuidv4(),
                title: taskData.title,
                status: "Started",
                priority: taskData.priority || "Medium",
                tags: taskData.tags || [],
                category: taskData.category || null,
                // ▼▼▼ ユーザー情報を記録する項目を追加 ▼▼▼
                createdAt: new Date().toISOString(),
                createdById: clientPrincipal.userId,
                createdByName: clientPrincipal.userDetails
            };

            const database = client.database(databaseId);
            const container = database.container(containerId);
            const { resource: createdItem } = await container.items.create(newTask);

            return { status: 201, jsonBody: createdItem };

        } catch (error) {
            context.error("Error creating task:", error);
            return { status: 500, body: "Error creating task." };
        }
    }
});