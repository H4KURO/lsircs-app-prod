// api/src/functions/DeleteCategory.js
const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.CosmosDbConnectionString);
const container = client.database("lsircs-database").container("Categories");

app.http('DeleteCategory', {
    methods: ['DELETE'], authLevel: 'anonymous', route: 'DeleteCategory/{id}',
    handler: async (request, context) => {
        const id = request.params.id;
        await container.item(id, id).delete();
        return { status: 204 };
    }
});