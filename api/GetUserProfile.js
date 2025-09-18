// api/src/functions/GetUserProfile.js
const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");
const client = new CosmosClient(process.env.CosmosDbConnectionString);
const container = client.database("lsircs-database").container("Users");

app.http('GetUserProfile', {
    methods: ['GET'], authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const header = request.headers.get('x-ms-client-principal');
            if (!header) { return { status: 401, body: "Not logged in" }; }
            const p = JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
            
            try {
                const { resource: profile } = await container.item(p.userId, p.userId).read();
                return { jsonBody: profile };
            } catch (error) {
                if (error.code === 404) {
                    const newUserProfile = { id: p.userId, userId: p.userId, identityProvider: p.identityProvider, userDetails: p.userDetails, displayName: p.userDetails };
                    const { resource: created } = await container.items.create(newUserProfile);
                    return { status: 201, jsonBody: created };
                }
                throw error; // その他のDBエラーをキャッチさせる
            }
        } catch (error) {
            context.log("GetUserProfile Error:", error);
            return { status: 500, body: error.message };
        }
    }
});