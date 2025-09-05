// api/src/functions/UpdateUserProfile.js
const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");
const client = new CosmosClient(process.env.CosmosDbConnectionString);
const container = client.database("lsircs-database").container("Users");

app.http('UpdateUserProfile', {
    methods: ['PUT'], authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const header = request.headers.get('x-ms-client-principal');
            if (!header) { return { status: 401, body: "Not logged in" }; }
            const p = JSON.parse(Buffer.from(header, 'base64').toString('ascii'));

            const updates = await request.json();
            const { resource: existing } = await container.item(p.userId, p.userId).read();
            const updatedProfile = { ...existing, displayName: updates.displayName }; // displayNameのみ更新
            
            const { resource: replaced } = await container.item(p.userId, p.userId).replace(updatedProfile);
            return { jsonBody: replaced };
        } catch (error) {
            context.log("UpdateUserProfile Error:", error);
            return { status: 500, body: error.message };
        }
    }
});