// api/src/functions/CreateCategory.js
const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");
const { v4: uuidv4 } = require("uuid");

const client = new CosmosClient(process.env.CosmosDbConnectionString);
const container = client.database("lsircs-database").container("Categories");

app.http('CreateCategory', {
    methods: ['POST'], authLevel: 'anonymous',
    handler: async (request, context) => {
        const { name } = await request.json();
        if (!name) { return { status: 400, body: "Category name is required." }; }

        const newCategory = { id: uuidv4(), name, color: '#cccccc' };
        const { resource: createdItem } = await container.items.create(newCategory);

        return { status: 201, jsonBody: createdItem };
    }
});