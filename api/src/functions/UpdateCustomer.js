const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");

const connectionString = process.env.CosmosDbConnectionString;
const client = new CosmosClient(connectionString);
const databaseId = "lsircs-database";
const containerId = "Customers";

app.http('UpdateCustomer', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'UpdateCustomer/{id}', // URLからIDを取得
    handler: async (request, context) => {
        try {
            const id = request.params.id;
            const updates = await request.json();

            const database = client.database(databaseId);
            const container = database.container(containerId);

            const { resource: existingCustomer } = await container.item(id, id).read();
            if (!existingCustomer) {
                return { status: 404, body: "Customer not found." };
            }

            const updatedCustomer = { ...existingCustomer, ...updates };

            const { resource: replacedItem } = await container.item(id, id).replace(updatedCustomer);

            return { status: 200, jsonBody: replacedItem };

        } catch (error) {
            if (error.code === 404) {
                return { status: 404, body: "Customer not found." };
            }
            return { status: 500, body: "Error updating customer." };
        }
    }
});