const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');
const { requireAllowedUser } = require('./authUtils');

const UPDATABLE_FIELDS = ['status', 'assignees', 'category'];

app.http('BulkUpdateTasks', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const auth = await requireAllowedUser(request);
    if (!auth.ok) return auth.response;

    try {
      const { ids, field, value } = await request.json();
      if (!Array.isArray(ids) || ids.length === 0) {
        return { status: 400, body: 'ids array is required.' };
      }
      if (!UPDATABLE_FIELDS.includes(field)) {
        return { status: 400, body: `field must be one of: ${UPDATABLE_FIELDS.join(', ')}` };
      }

      const container = getNamedContainer('Tasks', ['COSMOS_TASKS_CONTAINER', 'CosmosTasksContainer']);
      const now = new Date().toISOString();
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const { resource: existing } = await container.item(id, id).read();
          if (!existing) throw new Error(`Task ${id} not found`);
          const updated = { ...existing, [field]: value, updatedAt: now };
          const { resource } = await container.item(id, id).replace(updated);
          return resource;
        }),
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
      const failed = results.filter((r) => r.status === 'rejected').length;

      return { status: 200, jsonBody: { updated: succeeded.length, failed, tasks: succeeded } };
    } catch (error) {
      context.log('BulkUpdateTasks failed', error);
      return { status: 500, body: 'Error bulk updating tasks.' };
    }
  },
});
