const { app } = require('@azure/functions');
const { getContainer } = require('./cosmosClient');

const databaseId = 'lsircs-database';
const containerId = 'Tasks';

app.http('DeleteTask', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'DeleteTask/{id}',
  handler: async (request, context) => {
    try {
      const id = request.params?.id;
      if (!id) {
        return { status: 400, body: 'Task id is required.' };
      }

      const container = getContainer(databaseId, containerId);
      await container.item(id, id).delete();
      return { status: 204 };
    } catch (error) {
      if (error?.code === 404) {
        return { status: 404, body: 'Task not found.' };
      }
      const message = error.message || 'Error deleting task.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log.error('DeleteTask failed', error);
      return { status: 500, body: 'Error deleting task.' };
    }
  },
});
