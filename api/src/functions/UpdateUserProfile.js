// api/src/functions/UpdateUserProfile.js
const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");
const client = new CosmosClient(process.env.CosmosDbConnectionString);
const container = client.database("lsircs-database").container("Users");

app.http('UpdateUserProfile', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const header = request.headers.get('x-ms-client-principal');
        if (!header) { return { status: 401, body: "Not logged in" }; }
        const clientPrincipal = JSON.parse(Buffer.from(header, 'base64').toString('ascii'));

        const updates = await request.json();
        const { resource: existing } = await container.item(clientPrincipal.userId, clientPrincipal.userId).read();

        const updatedProfile = { ...existing, ...updates };

        const { resource: replaced } = await container.item(clientPrincipal.userId, clientPrincipal.userId).replace(updatedProfile);
        return { jsonBody: replaced };
    }
});