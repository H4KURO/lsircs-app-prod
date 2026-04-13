const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const tasksContainer = () =>
  getNamedContainer('Tasks', ['COSMOS_TASKS_CONTAINER', 'CosmosTasksContainer']);

const n8nSecretKey = process.env.N8N_SECRET_KEY;

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

// GET /api/FindTaskByConversationId?conversationId=xxx
app.http('FindTaskByConversationId', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const n8nHeader = request.headers.get('x-n8n-secret-key');
    if (!(n8nHeader && n8nSecretKey && n8nHeader === n8nSecretKey)) {
      const clientPrincipal = parseClientPrincipal(request);
      if (!clientPrincipal) return { status: 401, body: 'Unauthorized' };
    }

    const conversationId = request.query.get('conversationId');
    if (!conversationId) return { status: 400, body: 'conversationId is required.' };

    try {
      const container = tasksContainer();
      const query = {
        query: 'SELECT * FROM c WHERE c.conversationId = @conversationId',
        parameters: [{ name: '@conversationId', value: conversationId }],
      };
      const { resources } = await container.items.query(query).fetchAll();
      if (resources.length === 0) {
        return { status: 404, body: 'No task found for this conversationId.' };
      }
      return { status: 200, jsonBody: resources[0] };
    } catch (error) {
      context.log('FindTaskByConversationId failed', error);
      return { status: 500, body: 'Error searching task.' };
    }
  },
});

// POST /api/AddEmailNote
app.http('AddEmailNote', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const n8nHeader = request.headers.get('x-n8n-secret-key');
    let actorName = 'n8n Automation';

    if (!(n8nHeader && n8nSecretKey && n8nHeader === n8nSecretKey)) {
      const clientPrincipal = parseClientPrincipal(request);
      if (!clientPrincipal) return { status: 401, body: 'Unauthorized' };
      actorName = clientPrincipal.userDetails;
    }

    try {
      const payload = await request.json();
      const { taskId, note, sender, subject } = payload;

      if (!taskId || !note) {
        return { status: 400, body: 'taskId and note are required.' };
      }

      const container = tasksContainer();
      const { resource: existingTask } = await container.item(taskId, taskId).read();
      if (!existingTask) return { status: 404, body: 'Task not found.' };

      const newNote = {
        id: `note-${Date.now()}`,
        content: note,
        sender: sender ?? '',
        subject: subject ?? '',
        addedAt: new Date().toISOString(),
        addedBy: actorName,
      };

      const emailNotes = Array.isArray(existingTask.emailNotes)
        ? [...existingTask.emailNotes, newNote]
        : [newNote];

      const updatedTask = {
        ...existingTask,
        emailNotes,
        lastUpdatedAt: new Date().toISOString(),
      };

      const { resource } = await container.item(taskId, taskId).replace(updatedTask);
      return { status: 200, jsonBody: resource };
    } catch (error) {
      context.log('AddEmailNote failed', error);
      return { status: 500, body: 'Error adding note.' };
    }
  },
});
