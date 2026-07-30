const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');
const { parseClientPrincipal } = require('./userProfileStore');
const { normalizeSubtasksInput } = require('./subtaskUtils');

const templatesContainer = () =>
  getNamedContainer('TaskTemplates', ['COSMOS_TASK_TEMPLATES_CONTAINER', 'CosmosTaskTemplatesContainer']);

app.http('UpdateTaskTemplate', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'UpdateTaskTemplate/:id',
  handler: async (request, context) => {
    const principal = parseClientPrincipal(request);
    if (!principal) return { status: 401, body: 'Not logged in' };

    const id = request.params?.id;
    if (!id) return { status: 400, body: 'Template id is required' };

    let body;
    try { body = await request.json(); } catch { return { status: 400, body: 'Invalid JSON' }; }

    try {
      const container = templatesContainer();
      const { resource: existing } = await container.item(id, id).read();
      if (!existing) return { status: 404, body: 'Template not found' };

      const now = new Date().toISOString();
      const updated = {
        ...existing,
        name: typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : existing.name,
        description: body?.description ?? existing.description,
        category: body?.category !== undefined ? body.category : existing.category,
        priority: body?.priority ?? existing.priority,
        importance: body?.importance ?? existing.importance,
        tags: Array.isArray(body?.tags) ? body.tags.filter(t => typeof t === 'string') : existing.tags,
        subtasks: body?.subtasks !== undefined ? normalizeSubtasksInput(body.subtasks) : existing.subtasks,
        updatedAt: now,
        updatedById: principal.userId,
        updatedByName: principal.userDetails,
      };

      const { resource } = await container.item(id, id).replace(updated);
      return { status: 200, jsonBody: resource };
    } catch (error) {
      if (error?.code === 404) return { status: 404, body: 'Template not found' };
      context.log('UpdateTaskTemplate failed', error);
      return { status: 500, body: 'Error updating template.' };
    }
  },
});
