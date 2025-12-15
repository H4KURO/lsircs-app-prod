const { app } = require('@azure/functions');
const { ensureNamedContainer } = require('./cosmosClient');

const CONTAINER_OPTS = {
  overrideKeys: ['COSMOS_PROJECT_CUSTOMERS_CONTAINER', 'CosmosProjectCustomersContainer'],
  partitionKey: '/projectId',
};

function buildId(projectId, key) {
  return `${projectId}:${key}`;
}

async function readExisting(container, id, partitionKey) {
  try {
    const { resource } = await container.item(id, partitionKey).read();
    return resource;
  } catch (error) {
    if (error?.code === 404 || error?.code === 'NotFound') {
      return null;
    }
    throw error;
  }
}

app.http('UpsertProjectCustomer', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'ProjectCustomers/{projectId}/{key}',
  handler: async (request, context) => {
    try {
      const projectId = request.params?.projectId;
      const key = request.params?.key;

      if (!projectId || !key) {
        return { status: 400, jsonBody: { message: 'projectId and key are required.' } };
      }

      let payload;
      try {
        payload = await request.json();
      } catch {
        return { status: 400, jsonBody: { message: 'Request body must be valid JSON.' } };
      }

      const data = payload?.data;
      if (typeof data !== 'object' || data == null) {
        return { status: 400, jsonBody: { message: 'data object is required.' } };
      }

      const rowIndex =
        typeof payload?.rowIndex === 'number' && Number.isFinite(payload.rowIndex)
          ? payload.rowIndex
          : null;

      const container = await ensureNamedContainer('ProjectCustomers', CONTAINER_OPTS);
      const id = buildId(projectId, key);
      const existing = await readExisting(container, id, projectId);
      const now = new Date().toISOString();

      const next = {
        ...(existing || {}),
        id,
        projectId,
        key,
        data,
        rowIndex: rowIndex ?? existing?.rowIndex ?? null,
        updatedAt: now,
      };
      if (!existing) {
        next.createdAt = now;
      }

      const { resource } = await container.items.upsert(next);
      return { status: 200, jsonBody: resource };
    } catch (error) {
      context.log('UpsertProjectCustomer failed', error);
      return { status: 500, jsonBody: { message: 'Failed to upsert project customer.' } };
    }
  },
});
