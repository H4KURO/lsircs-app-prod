const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");

const connectionString = process.env.CosmosDbConnectionString;
const client = new CosmosClient(connectionString);
const databaseId = "lsircs-database";
const containerId = "Customers";

app.http('DeleteCustomer', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'DeleteCustomer/{id}', // URLからIDを取得
    handler: async (request, context) => {
        try {
            const id = request.params.id;

            const database = client.database(databaseId);
            const container = database.container(containerId);

            await container.item(id, id).delete();

            return { status: 204 };

        } catch (error) {
            if (error.code === 404) {
                return { status: 404, body: "Customer not found." };
            }
            return { status: 500, body: "Error deleting customer." };
        }
    }
});