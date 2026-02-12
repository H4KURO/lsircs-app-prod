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

    const userEmail = clientPrincipal.userDetails;
    context.log(`CheckUserAccess called for: ${userEmail}`);

    try {
      const { database } = await cosmosClient.getDatabase();

      const containerName = process.env.COSMOS_ALLOWEDUSERS_CONTAINER || 'AllowedUsers';
      context.log(`Using container: ${containerName}`);
      const container = database.container(containerName);

      // 全件数確認
      const { resources: countResult } = await container.items
        .query('SELECT VALUE COUNT(1) FROM c')
        .fetchAll();
      const totalUsers = countResult[0] || 0;
      context.log(`Total users in container: ${totalUsers}`);

      // ホワイトリストが空なら最初のユーザーを管理者として自動登録
      if (totalUsers === 0) {
        const firstAdmin = {
          id: `user_${Date.now()}`,
          email: userEmail,
          name: userEmail,
          isAdmin: true,
          isAllowed: true,
          createdAt: new Date().toISOString(),
          createdBy: 'system',
          updatedAt: new Date().toISOString(),
        };
        await container.items.create(firstAdmin);
        context.log(`First admin auto-registered: ${userEmail}`);
        return {
          status: 200,
          jsonBody: { allowed: true, isAdmin: true, isFirstAdmin: true, email: userEmail }
        };
      }

      // 全ユーザー取得してJavaScript側でマッチング（大文字小文字無視）
      const { resources: allUsers } = await container.items
        .query('SELECT c.id, c.email, c.isAdmin, c.isAllowed FROM c')
        .fetchAll();
      context.log(`All registered emails: ${allUsers.map(u => u.email).join(', ')}`);

      const matchedUser = allUsers.find(
        u => u.email && u.email.toLowerCase() === userEmail.toLowerCase()
      );
      context.log(`Match result: ${matchedUser ? 'FOUND' : 'NOT FOUND'}`);

      if (!matchedUser) {
        return {
          status: 200,
          jsonBody: {
            allowed: false,
            reason: 'not_in_whitelist',
            email: userEmail,
            debug_registered_emails: allUsers.map(u => u.email)
          }
        };
      }

      return {
        status: 200,
        jsonBody: {
          allowed: matchedUser.isAllowed !== false,
          isAdmin: matchedUser.isAdmin === true,
          email: userEmail,
          name: matchedUser.name
        }
      };

    } catch (error) {
      context.error('CheckUserAccess error:', error);
      if (error.code === 404) {
        return {
          status: 200,
          jsonBody: { allowed: true, isAdmin: true, isFirstAdmin: true, email: userEmail }
        };
      }
      return {
        status: 200,
        jsonBody: {
          allowed: false,
          reason: 'error',
          error: error.message,
          errorCode: error.code
        }
      };
    }
  },
});
