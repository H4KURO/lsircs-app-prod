// api/src/functions/DeleteInvoice.js

const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");

const connectionString = process.env.CosmosDbConnectionString;
const client = new CosmosClient(connectionString);
const databaseId = "lsircs-database";
const containerId = "Invoices";

app.http('DeleteInvoice', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'DeleteInvoice/{id}',
    handler: async (request, context) => {
        try {
            const id = request.params.id;

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

            await container.item(id, existingInvoice.customerId).delete();

            return { status: 204 };

        } catch (error) {
            return { status: 500, body: `Error deleting invoice: ${error.message}` };
        }
    }
});