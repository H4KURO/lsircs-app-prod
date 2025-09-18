// api/src/functions/UpdateInvoice.js

const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");

const connectionString = process.env.CosmosDbConnectionString;
const client = new CosmosClient(connectionString);
const databaseId = "lsircs-database";
const containerId = "Invoices";

app.http('UpdateInvoice', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'UpdateInvoice/{id}',
    handler: async (request, context) => {
        try {
            const id = request.params.id;
            const updates = await request.json();
            
            const database = client.database(databaseId);
            const container = database.container(containerId);

            // ▼▼▼ ここからが修正点 ▼▼▼
            // IDで請求書を検索して、customerIdを取得する
            const querySpec = {
                query: "SELECT * FROM c WHERE c.id = @id",
                parameters: [{ name: "@id", value: id }]
            };
            const { resources: items } = await container.items.query(querySpec).fetchAll();

            if (items.length === 0) {
                return { status: 404, body: "Invoice not found." };
            }
            const existingInvoice = items[0];
            // ▲▲▲ ここまでが修正点 ▲▲▲

            const updatedInvoice = { ...existingInvoice, ...updates };
            const { resource: replacedItem } = await container.item(id, existingInvoice.customerId).replace(updatedInvoice);

            return { status: 200, jsonBody: replacedItem };

        } catch (error) {
            return { status: 500, body: `Error updating invoice: ${error.message}` };
        }
    }
});