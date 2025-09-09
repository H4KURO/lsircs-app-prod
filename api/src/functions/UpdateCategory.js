const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");
const connectionString = process.env.CosmosDbConnectionString;
const client = new CosmosClient(connectionString);
const database = client.database("lsircs-database");
const container = database.container("Categories");

app.http('UpdateCategory', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'UpdateCategory/{id}',
    handler: async (request, context) => {
        const id = request.params.id;
        const updates = await request.json();

        const { resource: existing } = await container.item(id, id).read();
        const updatedItem = { ...existing, ...updates };

        const { resource: replaced } = await container.item(id, id).replace(updatedItem);
        return { jsonBody: replaced };
    }
});