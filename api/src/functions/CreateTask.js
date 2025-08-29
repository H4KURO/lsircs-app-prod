const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");
const { v4: uuidv4 } = require("uuid");
const axios = require('axios');

const connectionString = process.env.CosmosDbConnectionString;
const client = new CosmosClient(connectionString);
const databaseId = "lsircs-database";
const containerId = "Tasks";
const N8N_WEBHOOK_URL = process.env.N8N_TASK_CREATED_WEBHOOK;

app.http('CreateTask', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const taskData = await request.json();
            if (!taskData.title) {
                return { status: 400, body: "Task title is required." };
            }

            // ... (ファイルの先頭部分は変更なし) ...

// 保存する新しいタスクオブジェクトを作成
const newTask = {
    id: uuidv4(),
    title: taskData.title,
    status: "Started",
    priority: taskData.priority || "Medium",
    tags: taskData.tags || [],
    category: taskData.category || null, // ★★★ この行を追加 ★★★
    createdAt: new Date().toISOString()
};

// ... (ファイルの末尾部分も変更なし) ...

            const database = client.database(databaseId);
            const container = database.container(containerId);
            const { resource: createdItem } = await container.items.create(newTask);

            // ▼▼▼ ここからが修正点 ▼▼▼
            if (N8N_WEBHOOK_URL) {
                try {
                    // n8nへの通知が完了するのを 'await' で待つ
                    await axios.post(N8N_WEBHOOK_URL, createdItem);
                    context.log('Successfully called n8n webhook.');
                } catch (err) {
                    context.log('n8n webhook call failed:', err);
                }
            }
            // ▲▲▲ ここまでが修正点 ▲▲▲

            return { status: 201, jsonBody: createdItem };

        } catch (error) {
            context.error("Error creating task:", error);
            return { status: 500, body: "Error creating task." };
        }
    }
});