const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");

// データベース接続情報
const connectionString = process.env.CosmosDbConnectionString;
const client = new CosmosClient(connectionString);
const databaseId = "lsircs-database";
const containerId = "Invoices"; // ★★★ コンテナー名をInvoicesに変更 ★★★

app.http('GetInvoices', {
    methods: ['GET'],
    authLevel: 'anonymous',
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
            context.error(`Error fetching invoices:`, error);
            return {
                status: 500,
                body: "Error fetching invoices from the database."
            };
        }
    }
});