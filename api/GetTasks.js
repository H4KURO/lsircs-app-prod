const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const tasksContainer = () =>
  getNamedContainer('Tasks', ['COSMOS_TASKS_CONTAINER', 'CosmosTasksContainer']);

app.http('GetTasks', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const container = tasksContainer();
      const { resources } = await container.items.readAll().fetchAll();
      return { status: 200, jsonBody: resources };
    } catch (error) {
      const message = error.message || 'Error fetching tasks from the database.';
      if (message.includes('Resource NotFound')) {
        context.log('Tasks container not found, returning empty list.');
        return { status: 200, jsonBody: [] };
      }
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('GetTasks failed', error);
      return { status: 500, body: 'Error fetching tasks from the database.' };
    }
  },
});

