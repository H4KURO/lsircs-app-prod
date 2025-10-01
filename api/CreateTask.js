const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { getNamedContainer } = require('./cosmosClient');
const { normalizeSubtasksInput } = require('./subtaskUtils');
const { normalizeAssigneesPayload, ensureAssigneesOnTask } = require('./assigneeUtils');
const tasksContainer = () =>
  getNamedContainer('Tasks', ['COSMOS_TASKS_CONTAINER', 'CosmosTasksContainer']);
const n8nSecretKey = process.env.N8N_SECRET_KEY;

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

app.http('CreateTask', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const n8nHeader = request.headers.get('x-n8n-secret-key');
    let clientPrincipal = { userId: null, userDetails: 'n8n-import' };

    if (n8nHeader && n8nSecretKey && n8nHeader === n8nSecretKey) {
      clientPrincipal = { userId: 'n8n-automation', userDetails: 'n8n Automation' };
    } else {
      const parsedPrincipal = parseClientPrincipal(request);
      if (!parsedPrincipal) {
        return { status: 401, body: 'Unauthorized access. Please log in.' };
      }
      clientPrincipal = parsedPrincipal;
    }

    try {
      const payload = await request.json();
      const title = payload?.title?.trim();
      if (!title) {
        return { status: 400, body: 'Task title is required.' };
      }

      const container = tasksContainer();
      const now = new Date().toISOString();
      const assignees = normalizeAssigneesPayload(payload);

      const baseTask = {
        id: uuidv4(),
        title,
        description: payload?.description ?? '',
        status: payload?.status ?? 'Started',
        priority: payload?.priority ?? 'Medium',
        tags: Array.isArray(payload?.tags) ? payload.tags : [],
        category: payload?.category ?? null,
        importance: payload?.importance ?? 1,
        assignees,
        deadline: payload?.deadline ?? null,
        subtasks: normalizeSubtasksInput(payload?.subtasks),
        createdAt: now,
        createdById: clientPrincipal.userId,
        createdByName: clientPrincipal.userDetails,
      };

      const taskToCreate = ensureAssigneesOnTask(baseTask);
      const { resource } = await container.items.create(taskToCreate);
      return { status: 201, jsonBody: ensureAssigneesOnTask(resource) };
    } catch (error) {
      const message = error.message || 'Error creating task.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      if (message.includes('Resource NotFound')) {
        context.log('Tasks container not found, returning conflict.');
        return { status: 404, body: 'Task container not found in Cosmos DB.' };
      }
      context.log('CreateTask failed', error);
      return { status: 500, body: 'Error creating task.' };
    }
  },
});
