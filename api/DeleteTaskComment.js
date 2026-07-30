const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const tasksContainer = () =>
  getNamedContainer('Tasks', ['COSMOS_TASKS_CONTAINER', 'CosmosTasksContainer']);

function parseClientPrincipal(request) {
  if (process.env.DEV_AUTH_BYPASS === 'true') {
    return { userId: 'dev-user', userDetails: 'dev@local.test' };
  }
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

app.http('DeleteTaskComment', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const principal = parseClientPrincipal(request);
    if (!principal) return { status: 401, body: 'Unauthorized.' };

    try {
      const { taskId, commentId } = await request.json();
      if (!taskId || !commentId) {
        return { status: 400, body: 'taskId and commentId are required.' };
      }

      const container = tasksContainer();
      const { resource: task } = await container.item(taskId, taskId).read();
      if (!task) return { status: 404, body: 'Task not found.' };

      const comment = (task.comments || []).find(c => c.id === commentId);
      if (comment && comment.authorUserId !== principal.userId) {
        return { status: 403, body: 'You can only delete your own comments.' };
      }

      const comments = (task.comments || []).filter(c => c.id !== commentId);
      await container.item(taskId, taskId).patch([
        { op: 'set', path: '/comments', value: comments },
        { op: 'set', path: '/updatedAt', value: new Date().toISOString() },
      ]);

      return { status: 200, jsonBody: { success: true } };
    } catch (error) {
      context.log('DeleteTaskComment error', error);
      return { status: 500, body: error.message };
    }
  },
});
