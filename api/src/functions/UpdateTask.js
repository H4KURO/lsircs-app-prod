const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");

// Database connection info
const connectionString = process.env.CosmosDbConnectionString;
const client = new CosmosClient(connectionString);
const databaseId = "lsircs-database";
const containerId = "Tasks";

app.http('UpdateTask', {
    methods: ['PUT'], // Use PUT for updates
    authLevel: 'anonymous',
    route: 'UpdateTask/{id}', // Define a route parameter for the task ID
    handler: async (request, context) => {
        try {
            const id = request.params.id; // Get the ID from the URL
            const updates = await request.json(); // Get the new data from the request body

            const database = client.database(databaseId);
            const container = database.container(containerId);

            // 1. Fetch the existing task
            const { resource: existingTask } = await container.item(id, id).read();
            if (!existingTask) {
                return { status: 404, body: "Task not found." };
            }

            // 2. Merge the updates with the existing task data
            const updatedTask = { ...existingTask, ...updates };

            // 3. Replace the old task with the updated one
            const { resource: replacedItem } = await container.item(id, id).replace(updatedTask);

            return { status: 200, jsonBody: replacedItem };

        } catch (error) {
            context.error(`Error updating task:`, error);
            // Handle cases where the item might not be found
            if (error.code === 404) {
                return { status: 404, body: "Task not found." };
            }
            return { status: 500, body: "Error updating task." };
        }
    }
});