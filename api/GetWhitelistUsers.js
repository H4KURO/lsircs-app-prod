const { app } = require('@azure/functions');
const { ensureNamedContainer } = require('./cosmosClient');

const CONTAINER_NAME = 'AllowedUsers';

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
      const container = await ensureNamedContainer(CONTAINER_NAME, { partitionKey: '/id' });

      // 呼び出し元が管理者かチェック
      const { resources: allUsers } = await container.items
        .query('SELECT * FROM c ORDER BY c.createdAt')
        .fetchAll();

      const caller = allUsers.find(
        u => u.email && u.email.toLowerCase() === clientPrincipal.userDetails.toLowerCase()
      );

      if (!caller || !caller.isAdmin) {
        return { status: 403, jsonBody: { error: 'Admin access required' } };
      }

      return { status: 200, jsonBody: allUsers };

    } catch (error) {
      context.error('GetWhitelistUsers error:', error);
      return { status: 500, jsonBody: { error: error.message } };
    }
  },
});
