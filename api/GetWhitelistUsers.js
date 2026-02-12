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

app.http('GetWhitelistUsers', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, jsonBody: { error: 'Unauthorized' } };
    }

    try {
      const { database } = await cosmosClient.getDatabase();
      const container = database.container('AllowedUsers');

      // 呼び出し元が管理者かチェック
      const { resources: callerList } = await container.items
        .query({
          query: 'SELECT * FROM c WHERE c.email = @email',
          parameters: [{ name: '@email', value: clientPrincipal.userDetails }]
        })
        .fetchAll();

      const caller = callerList[0];
      if (!caller || !caller.isAdmin) {
        return { status: 403, jsonBody: { error: 'Admin access required' } };
      }

      // 全ユーザー取得
      const { resources: users } = await container.items
        .query('SELECT * FROM c ORDER BY c.createdAt')
        .fetchAll();

      return { status: 200, jsonBody: users };

    } catch (error) {
      context.error('GetWhitelistUsers error:', error);
      return { status: 500, jsonBody: { error: error.message } };
    }
  },
});
