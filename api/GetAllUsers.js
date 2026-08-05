const { app } = require('@azure/functions');
const { ensureNamedContainer } = require('./cosmosClient');

const USER_CONTAINER_KEYS = ['COSMOS_USERS_CONTAINER', 'COSMOS_USER_CONTAINER', 'CosmosUsersContainer'];
const USER_PARTITION_KEY = '/id';

async function usersContainer() {
  return ensureNamedContainer('Users', {
    overrideKeys: USER_CONTAINER_KEYS,
    partitionKey: USER_PARTITION_KEY,
  });
}

async function allowedUsersContainer() {
  return ensureNamedContainer('AllowedUsers', { partitionKey: '/id' });
}

app.http('GetAllUsers', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      // ホワイトリスト（isAllowed !== false）のメールアドレスを取得
      let allowedEmails = null;
      try {
        const wlContainer = await allowedUsersContainer();
        const { resources: wlUsers } = await wlContainer.items
          .query('SELECT c.email, c.name, c.isAllowed FROM c')
          .fetchAll();
        allowedEmails = new Map(
          wlUsers
            .filter(u => u.isAllowed !== false && u.email)
            .map(u => [u.email.toLowerCase(), u.name || u.email]),
        );
      } catch (wlErr) {
        context.log('AllowedUsers container unavailable, falling back to all users', wlErr.message);
      }

      // Usersコンテナからプロフィール取得
      const container = await usersContainer();
      const { resources } = await container.items.readAll().fetchAll();

      let userList = resources.map((user) => ({
        userId: user.userId || user.id,
        displayName: user.displayName || user.userDetails || 'Unknown User',
        email: user.userDetails || '',
        slackMemberId: user.slackMemberId || null,
      }));

      // ホワイトリストが取得できた場合はフィルタリング
      if (allowedEmails) {
        userList = userList.filter(u => u.email && allowedEmails.has(u.email.toLowerCase()));
        // Usersプロフィールに存在しないホワイトリストユーザーも追加
        const profileEmails = new Set(userList.map(u => u.email.toLowerCase()));
        for (const [email, name] of allowedEmails) {
          if (!profileEmails.has(email)) {
            userList.push({ userId: email, displayName: name || email, email });
          }
        }
      }

      return {
        status: 200,
        jsonBody: userList.map(u => ({ userId: u.userId, displayName: u.displayName, slackMemberId: u.slackMemberId || null })),
      };
    } catch (error) {
      const message = error.message || 'Error loading users.';
      if (error?.code === 404 || error?.code === 'NotFound' || message.includes('Resource NotFound')) {
        context.log('Users container not found, returning empty list.', message);
        return { status: 200, jsonBody: [] };
      }
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('GetAllUsers failed', error);
      return { status: 500, body: 'Error loading users.' };
    }
  },
});
