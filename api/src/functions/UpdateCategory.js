// api/src/functions/UpdateCategory.js
const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.CosmosDbConnectionString);
const container = client.database("lsircs-database").container("Categories");

app.http('UpdateCategory', {
    methods: ['PUT'], authLevel: 'anonymous', route: 'UpdateCategory/{id}',
    handler: async (request, context) => {
        const id = request.params.id;
        const updates = await request.json(); // name or color

        const { resource: existing } = await container.item(id, id).read();
        if (!existing) { return { status: 404, body: "Category not found." }; }

        const updatedItem = { ...existing, ...updates };

        const { resource: replaced } = await container.item(id, id).replace(updatedItem);
        return { jsonBody: replaced };
    }
});