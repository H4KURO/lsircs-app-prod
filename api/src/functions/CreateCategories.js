// api/src/functions/CreateCategories.js
const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");
const { v4: uuidv4 } = require("uuid");

const client = new CosmosClient(process.env.CosmosDbConnectionString);
const container = client.database("lsircs-database").container("Categories");

app.http('CreateCategories', {
    methods: ['POST'], authLevel: 'anonymous',
    handler: async (request, context) => {
        const { categories } = await request.json();
        if (!categories || !Array.isArray(categories)) {
            return { status: 400, body: "Invalid input" };
        }

        for (const categoryName of categories) {
            const newCategory = {
                id: uuidv4(),
                name: categoryName,
                color: '#cccccc' // デフォルト色
            };
            await container.items.create(newCategory);
        }
        
        return { status: 201, body: "Categories created" };
    }
});