// api/src/functions/GetUserProfile.js
const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");
const client = new CosmosClient(process.env.CosmosDbConnectionString);
const container = client.database("lsircs-database").container("Users");

app.http('GetUserProfile', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const header = request.headers.get('x-ms-client-principal');
        if (!header) { return { status: 401, body: "Not logged in" }; }
        const clientPrincipal = JSON.parse(Buffer.from(header, 'base64').toString('ascii'));

        try {
            const { resource: existingProfile } = await container.item(clientPrincipal.userId, clientPrincipal.userId).read();
            return { jsonBody: existingProfile };
        } catch (error) {
            if (error.code === 404) {
                // プロフィールが存在しない場合、新しく作成する
                const newUserProfile = {
                    id: clientPrincipal.userId, // ユーザーIDをドキュメントのIDにする
                    userId: clientPrincipal.userId,
                    identityProvider: clientPrincipal.identityProvider,
                    userDetails: clientPrincipal.userDetails,
                    displayName: clientPrincipal.userDetails // 初期表示名はログイン名と同じ
                };
                const { resource: createdProfile } = await container.items.create(newUserProfile);
                return { status: 201, jsonBody: createdProfile };
            }
            return { status: 500, body: error.message };
        }
    }
});