const { app } = require('@azure/functions');
const { getContainer } = require('./cosmosClient');

const databaseId = 'lsircs-database';
const containerId = 'Users';

app.http('GetAllUsers', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const container = getContainer(databaseId, containerId);
      const { resources } = await container.items.readAll().fetchAll();
      const userList = resources.map((user) => ({
        userId: user.userId || user.id,
        displayName: user.displayName || user.userDetails || 'Unknown User',
      }));
      return { status: 200, jsonBody: userList };
    } catch (error) {
      const message = error.message || 'Error loading users.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log.error('GetAllUsers failed', error);
      return { status: 500, body: 'Error loading users.' };
    }
  },
});