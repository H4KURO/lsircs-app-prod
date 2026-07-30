const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');
const { v4: uuidv4 } = require('uuid');
const { notifyCommentMention } = require('./slackClient');

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

app.http('AddTaskComment', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const principal = parseClientPrincipal(request);
    if (!principal) return { status: 401, body: 'Unauthorized.' };

    try {
      const { taskId, text, replyTo, mentionedDisplayNames } = await request.json();
      if (!taskId || !text?.trim()) {
        return { status: 400, body: 'taskId and text are required.' };
      }

      const container = tasksContainer();
      const { resource: task } = await container.item(taskId, taskId).read();
      if (!task) return { status: 404, body: 'Task not found.' };

      const comment = {
        id: uuidv4(),
        text: text.trim(),
        authorDisplayName: principal.userDetails || principal.userId,
        authorUserId: principal.userId,
        createdAt: new Date().toISOString(),
        ...(replyTo ? { replyTo } : {}),
      };

      const comments = [...(task.comments || []), comment];
      await container.item(taskId, taskId).patch([
        { op: 'set', path: '/comments', value: comments },
        { op: 'set', path: '/updatedAt', value: new Date().toISOString() },
      ]);

      if (Array.isArray(mentionedDisplayNames) && mentionedDisplayNames.length > 0) {
        const authorName = principal.userDetails || principal.userId;
        notifyCommentMention(
          { task, commentText: text.trim(), authorName, mentionedNames: mentionedDisplayNames },
          context,
        ).catch(() => {});
      }

      return { status: 201, jsonBody: comment };
    } catch (error) {
      context.log('AddTaskComment error', error);
      return { status: 500, body: error.message };
    }
  },
});
