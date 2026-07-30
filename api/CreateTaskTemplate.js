const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { getNamedContainer } = require('./cosmosClient');
const { parseClientPrincipal } = require('./userProfileStore');
const { normalizeSubtasksInput } = require('./subtaskUtils');

const templatesContainer = () =>
  getNamedContainer('TaskTemplates', ['COSMOS_TASK_TEMPLATES_CONTAINER', 'CosmosTaskTemplatesContainer']);

app.http('CreateTaskTemplate', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const principal = parseClientPrincipal(request);
    if (!principal) return { status: 401, body: 'Not logged in' };

    let body;
    try { body = await request.json(); } catch { return { status: 400, body: 'Invalid JSON' }; }

    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) return { status: 400, body: 'Template name is required' };

    const now = new Date().toISOString();
    const template = {
      id: uuidv4(),
      name,
      description: body?.description ?? '',
      category: body?.category ?? null,
      priority: body?.priority ?? 'Medium',
      importance: body?.importance ?? 1,
      tags: Array.isArray(body?.tags) ? body.tags.filter(t => typeof t === 'string') : [],
      subtasks: normalizeSubtasksInput(body?.subtasks),
      createdAt: now,
      createdById: principal.userId,
      createdByName: principal.userDetails,
      updatedAt: now,
    };

    try {
      const container = templatesContainer();
      const { resource } = await container.items.create(template);
      return { status: 201, jsonBody: resource };
    } catch (error) {
      context.log('CreateTaskTemplate failed', error);
      return { status: 500, body: 'Error creating template.' };
    }
  },
});
