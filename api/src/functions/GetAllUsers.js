// api/src/functions/GetAllUsers.js

const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");

const connectionString = process.env.CosmosDbConnectionString;
const client = new CosmosClient(connectionString);
const database = client.database("lsircs-database");
const container = database.container("Users");

app.http('GetAllUsers', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const { resources: items } = await container.items.readAll().fetchAll();
            const userList = items.map(user => ({
                userId: user.userId,
                displayName: user.displayName
            }));
            return { jsonBody: userList };
        } catch (error) {
            context.log.error('Error fetching all users:', error);
            return { status: 500, body: 'Could not fetch users.' };
        }
    }
});