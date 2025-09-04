// api/src/functions/CreateTask.js

const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");
const { v4: uuidv4 } = require("uuid");

const connectionString = process.env.CosmosDbConnectionString;
const client = new CosmosClient(connectionString);
const databaseId = "lsircs-database";
const containerId = "Tasks";
const N8N_SECRET_KEY = process.env.N8N_SECRET_KEY;

app.http('CreateTask', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        let clientPrincipal = { userId: null, userDetails: 'n8n-import' }; // デフォルト値を設定
        
        const n8nSecretHeader = request.headers.get('x-n8n-secret-key');
        if (n8nSecretHeader && n8nSecretHeader === N8N_SECRET_KEY) {
            clientPrincipal = { userId: 'n8n-automation', userDetails: 'n8n Automation' };
        } else {
            const header = request.headers.get('x-ms-client-principal');
            if (header) {
                const encoded = Buffer.from(header, 'base64');
                const decoded = encoded.toString('ascii');
                clientPrincipal = JSON.parse(decoded);
            } else {
                return { status: 401, body: "Unauthorized access. Please log in." };
            }
        }

        try {
            const taskData = await request.json();
            if (!taskData.title) { return { status: 400, body: "Task title is required." }; }

            const newTask = {
                id: uuidv4(),
                title: taskData.title,
                description: taskData.description || "",
                status: taskData.status || "Started",
                priority: taskData.priority || "Medium",
                tags: taskData.tags || [],
                category: taskData.category || null,
                importance: taskData.importance !== undefined ? taskData.importance : 1,
                assignee: taskData.assignee || null,
                deadline: taskData.deadline || null,
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