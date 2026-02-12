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

app.http('UpdateWhitelistUser', {
  methods: ['POST', 'PUT', 'DELETE'],
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
        .query('SELECT c.id, c.email, c.isAdmin FROM c')
        .fetchAll();

      const caller = allUsers.find(
        u => u.email && u.email.toLowerCase() === clientPrincipal.userDetails.toLowerCase()
      );

      if (!caller || !caller.isAdmin) {
        return { status: 403, jsonBody: { error: 'Admin access required' } };
      }

      const method = request.method.toUpperCase();

      // DELETE: ユーザー削除
      if (method === 'DELETE') {
        const body = await request.json();
        const { id } = body;
        if (!id) return { status: 400, jsonBody: { error: 'id is required' } };
        await container.item(id, id).delete();
        return { status: 200, jsonBody: { message: 'User removed from whitelist' } };
      }

      // POST: 新規追加
      if (method === 'POST') {
        const body = await request.json();
        const { email, name, isAdmin = false } = body;
        if (!email) return { status: 400, jsonBody: { error: 'email is required' } };

        // 既存チェック
        const existing = allUsers.find(
          u => u.email && u.email.toLowerCase() === email.toLowerCase()
        );
        if (existing) {
          return { status: 409, jsonBody: { error: 'User already exists in whitelist' } };
        }

        const newUser = {
          id: `user_${Date.now()}`,
          email,
          name: name || '',
          isAdmin,
          isAllowed: true,
          createdAt: new Date().toISOString(),
          createdBy: clientPrincipal.userDetails,
          updatedAt: new Date().toISOString(),
        };
        const { resource } = await container.items.create(newUser);
        return { status: 201, jsonBody: resource };
      }

      // PUT: 更新
      if (method === 'PUT') {
        const body = await request.json();
        const { id, isAdmin } = body;
        if (!id) return { status: 400, jsonBody: { error: 'id is required' } };

        const { resource: existingItem } = await container.item(id, id).read();
        if (!existingItem) return { status: 404, jsonBody: { error: 'User not found' } };

        const updated = {
          ...existingItem,
          isAdmin: isAdmin ?? existingItem.isAdmin,
          updatedAt: new Date().toISOString(),
        };
        const { resource } = await container.item(id, id).replace(updated);
        return { status: 200, jsonBody: resource };
      }

      return { status: 405, jsonBody: { error: 'Method not allowed' } };

    } catch (error) {
      context.error('UpdateWhitelistUser error:', error);
      return { status: 500, jsonBody: { error: error.message } };
    }
  },
});
