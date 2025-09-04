const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");
const connectionString = process.env.CosmosDbConnectionString;
const client = new CosmosClient(connectionString);
const database = client.database("lsircs-database");
const container = database.container("Categories");

app.http('GetCategories', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const { resources: items } = await container.items.readAll().fetchAll();
        return { jsonBody: items };
    }
});