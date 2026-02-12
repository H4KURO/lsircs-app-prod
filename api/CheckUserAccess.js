const { app } = require('@azure/functions');
const cosmosClient = require('./cosmosClient');

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

app.http('CheckUserAccess', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, jsonBody: { allowed: false, reason: 'not_logged_in' } };
    }

    try {
      const { database } = await cosmosClient.getDatabase();
      const container = database.container('AllowedUsers');

      // ホワイトリストが空かどうかチェック（初回セットアップ用）
      const { resources: allUsers } = await container.items
        .query('SELECT VALUE COUNT(1) FROM c')
        .fetchAll();

      const totalUsers = allUsers[0] || 0;

      // ホワイトリストが空なら、最初のユーザーを管理者として自動登録
      if (totalUsers === 0) {
        const firstAdmin = {
          id: `user_${Date.now()}`,
          email: clientPrincipal.userDetails,
          name: clientPrincipal.userDetails,
          isAdmin: true,
          isAllowed: true,
          createdAt: new Date().toISOString(),
          createdBy: 'system',
          updatedAt: new Date().toISOString(),
        };
        await container.items.create(firstAdmin);
        context.log(`First admin registered: ${clientPrincipal.userDetails}`);
        return {
          status: 200,
          jsonBody: {
            allowed: true,
            isAdmin: true,
            isFirstAdmin: true,
            email: clientPrincipal.userDetails
          }
        };
      }

      // ホワイトリストでメールアドレスを検索
      const { resources: users } = await container.items
        .query({
          query: 'SELECT * FROM c WHERE c.email = @email',
          parameters: [{ name: '@email', value: clientPrincipal.userDetails }]
        })
        .fetchAll();

      if (users.length === 0) {
        return {
          status: 200,
          jsonBody: {
            allowed: false,
            reason: 'not_in_whitelist',
            email: clientPrincipal.userDetails
          }
        };
      }

      const user = users[0];
      return {
        status: 200,
        jsonBody: {
          allowed: user.isAllowed !== false,
          isAdmin: user.isAdmin === true,
          email: clientPrincipal.userDetails,
          name: user.name
        }
      };

    } catch (error) {
      context.error('CheckUserAccess error:', error);
      // Cosmos DBのコンテナが存在しない場合は最初のユーザーを許可
      if (error.code === 404) {
        return {
          status: 200,
          jsonBody: {
            allowed: true,
            isAdmin: true,
            isFirstAdmin: true,
            email: clientPrincipal.userDetails
          }
        };
      }
      return { status: 500, jsonBody: { allowed: false, reason: 'error', error: error.message } };
    }
  },
});
