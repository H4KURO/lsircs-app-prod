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

app.http('GetAllUsers', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const container = await usersContainer();
      const { resources } = await container.items.readAll().fetchAll();
      const userList = resources.map((user) => ({
        userId: user.userId || user.id,
        displayName: user.displayName || user.userDetails || 'Unknown User',
      }));
      return { status: 200, jsonBody: userList };
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
