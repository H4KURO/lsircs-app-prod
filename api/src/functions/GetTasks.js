// api/src/functions/GetTasks.js

const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");

const connectionString = process.env.CosmosDbConnectionString;
const client = new CosmosClient(connectionString);
const databaseId = "lsircs-database";
const containerId = "Tasks";

app.http('GetTasks', {
    methods: ['GET'],
    authLevel: 'anonymous', // 認証はstaticwebapp.config.jsonで制御
    handler: async (request, context) => {
        if (!connectionString) {
            return { status: 500, body: "Database connection string is not configured." };
        }
        try {
            const database = client.database(databaseId);
            const container = database.container(containerId);
            const { resources: items } = await container.items.readAll().fetchAll();
            
            return {
                status: 200,
                jsonBody: items
            };
        } catch (error) {
            context.error("Error fetching tasks:", error);
            return {
                status: 500,
                body: "Error fetching tasks from the database."
            };
        }
    }
});