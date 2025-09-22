const { app } = require('@azure/functions');
const { getContainer } = require('./cosmosClient');

const databaseId = 'lsircs-database';
const containerId = 'Tasks';

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch (error) {
    return null;
  }
}

app.http('UpdateTask', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'UpdateTask/{id}',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      const id = request.params.get('id');
      if (!id) {
        return { status: 400, body: 'Task id is required.' };
      }

      const updates = await request.json();
      const container = getContainer(databaseId, containerId);

      const { resource: existingTask } = await container.item(id, id).read();
      if (!existingTask) {
        return { status: 404, body: 'Task not found.' };
      }

      const lastUpdatedAt = new Date().toISOString();
      const updatedTask = {
        ...existingTask,
        ...updates,
        lastUpdatedAt,
        lastUpdatedById: clientPrincipal.userId,
        lastUpdatedByName: clientPrincipal.userDetails,
      };

      if (updates?.status && updates.status !== existingTask.status) {
        const history = Array.isArray(existingTask.statusHistory) ? existingTask.statusHistory : [];
        history.push({
          status: updates.status,
          changedAt: lastUpdatedAt,
          changedById: clientPrincipal.userId,
          changedByName: clientPrincipal.userDetails,
        });
        updatedTask.statusHistory = history;
      }

      const { resource } = await container.item(id, id).replace(updatedTask);
      return { status: 200, jsonBody: resource };
    } catch (error) {
      if (error?.code === 404) {
        return { status: 404, body: 'Task not found.' };
      }
      const message = error.message || 'Error updating task.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log.error('UpdateTask failed', error);
      return { status: 500, body: 'Error updating task.' };
    }
  },
});