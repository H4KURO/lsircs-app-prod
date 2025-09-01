const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");
const { v4: uuidv4 } = require("uuid");

const connectionString = process.env.CosmosDbConnectionString;
const client = new CosmosClient(connectionString);
const databaseId = "lsircs-database";
const containerId = "Tasks";

// Azureに設定した秘密の合言葉を読み込む
const N8N_SECRET_KEY = process.env.N8N_SECRET_KEY;

app.http('CreateTask', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        let clientPrincipal = { userId: null, userDetails: 'Anonymous' };

        // ▼▼▼ ここからが修正部分 ▼▼▼
        // n8nからのリクエストか、ログインユーザーからのリクエストかを判断
        const n8nSecretHeader = request.headers.get('x-n8n-secret-key');

        if (n8nSecretHeader && n8nSecretHeader === N8N_SECRET_KEY) {
            // n8nからのリクエストの場合、作成者を'n8n-automation'として記録
            clientPrincipal = { userId: 'n8n-automation', userDetails: 'n8n Automation' };
        } else {
            // 通常のログインユーザーか確認
            const header = request.headers.get('x-ms-client-principal');
            if (header) {
                const encoded = Buffer.from(header, 'base64');
                const decoded = encoded.toString('ascii');
                clientPrincipal = JSON.parse(decoded);
            } else {
                // n8nでもなく、ログインユーザーでもない場合はアクセスを拒否
                return { status: 401, body: "Unauthorized access." };
            }
        }
        // ▲▲▲ ここまでが修正部分 ▲▲▲

        try {
            const taskData = await request.json();
            if (!taskData.title) { return { status: 400, body: "Task title is required." }; }

            const newTask = {
                id: uuidv4(),
                title: taskData.title,
                status: "Started",
                category: taskData.category || null,
                createdAt: new Date().toISOString(),
                createdById: clientPrincipal.userId,
                createdByName: clientPrincipal.userDetails
            };

            const database = client.database(databaseId);
            const container = database.container(containerId);
            const { resource: createdItem } = await container.items.create(newTask);

            return { status: 201, jsonBody: createdItem };
        } catch (error) {
            return { status: 500, body: "Error creating task." };
        }
    }
});