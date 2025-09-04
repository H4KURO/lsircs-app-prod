// api/src/functions/UpdateTask.js

const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");

const connectionString = process.env.CosmosDbConnectionString;
const client = new CosmosClient(connectionString);
const databaseId = "lsircs-database";
const containerId = "Tasks";

app.http('UpdateTask', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'UpdateTask/{id}',
    handler: async (request, context) => {
        let clientPrincipal;
        const header = request.headers.get('x-ms-client-principal');
        if (header) {
            const encoded = Buffer.from(header, 'base64');
            const decoded = encoded.toString('ascii');
            clientPrincipal = JSON.parse(decoded);
        } else {
             return { status: 401, body: "Unauthorized access. Please log in." };
        }

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

            updatedTask.lastUpdatedAt = new Date().toISOString();
            updatedTask.lastUpdatedById = clientPrincipal.userId;
            updatedTask.lastUpdatedByName = clientPrincipal.userDetails;

            if (updates.status && updates.status !== existingTask.status) {
                if (!updatedTask.statusHistory) { updatedTask.statusHistory = []; }
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
            context.error("Error updating task:", error);
            return { status: 500, body: "Error updating task." };
        }
    }
});