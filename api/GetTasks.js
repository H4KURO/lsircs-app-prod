const { app } = require('@azure/functions');
const { getContainer } = require('./cosmosClient');

const databaseId = 'lsircs-database';
const containerId = 'Tasks';

app.http('GetTasks', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const container = getContainer(databaseId, containerId);
      const { resources } = await container.items.readAll().fetchAll();
      return { status: 200, jsonBody: resources };
    } catch (error) {
      const message = error.message || 'Error fetching tasks from the database.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log.error('GetTasks failed', error);
      return { status: 500, body: 'Error fetching tasks from the database.' };
    }
  },
});