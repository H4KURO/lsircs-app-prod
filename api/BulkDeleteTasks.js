const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');
const { deleteAttachments } = require('./propertyPhotoStorage');
const { requireAllowedUser } = require('./authUtils');

app.http('BulkDeleteTasks', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const auth = await requireAllowedUser(request);
    if (!auth.ok) return auth.response;

    try {
      const { ids } = await request.json();
      if (!Array.isArray(ids) || ids.length === 0) {
        return { status: 400, body: 'ids array is required.' };
      }

      const container = getNamedContainer('Tasks', ['COSMOS_TASKS_CONTAINER', 'CosmosTasksContainer']);
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          let existing = null;
          try {
            const { resource } = await container.item(id, id).read();
            existing = resource;
          } catch (e) {
            if (e?.code !== 404) throw e;
          }
          await container.item(id, id).delete();
          const blobs = (existing?.attachments || []).map((a) => a.blobName);
          if (blobs.length > 0) await deleteAttachments(blobs);
          return id;
        }),
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
      const failed = results.filter((r) => r.status === 'rejected').length;

      return { status: 200, jsonBody: { deleted: succeeded.length, failed, ids: succeeded } };
    } catch (error) {
      context.log('BulkDeleteTasks failed', error);
      return { status: 500, body: 'Error bulk deleting tasks.' };
    }
  },
});
