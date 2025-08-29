const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");

// Database connection info
const connectionString = process.env.CosmosDbConnectionString;
const client = new CosmosClient(connectionString);
const databaseId = "lsircs-database";
const containerId = "Tasks";

app.http('DeleteTask', {
    methods: ['DELETE'], // Use DELETE for deleting resources
    authLevel: 'anonymous',
    route: 'DeleteTask/{id}', // Get the task ID from the URL
    handler: async (request, context) => {
        try {
            const id = request.params.id; // Get the ID from the URL

            const database = client.database(databaseId);
            const container = database.container(containerId);

            // Delete the item using its ID
            await container.item(id, id).delete();

            // On success, return a "No Content" response, which is standard for deletes
            return { status: 204 };

        } catch (error) {
            context.error(`Error deleting task:`, error);
            // Handle cases where the item to delete wasn't found
            if (error.code === 404) {
                return { status: 404, body: "Task not found." };
            }
            return { status: 500, body: "Error deleting task." };
        }
    }
});