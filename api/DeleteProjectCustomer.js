const { app } = require('@azure/functions');
const { ensureNamedContainer } = require('./cosmosClient');

const CONTAINER_OPTS = {
  overrideKeys: ['COSMOS_PROJECT_CUSTOMERS_CONTAINER', 'CosmosProjectCustomersContainer'],
  partitionKey: '/projectId',
};

function buildId(projectId, key) {
  return `${projectId}:${key}`;
}

app.http('DeleteProjectCustomer', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'ProjectCustomers/{projectId}/{key}',
  handler: async (request, context) => {
    try {
      const projectId = request.params?.projectId;
      const key = request.params?.key;
      if (!projectId || !key) {
        return { status: 400, jsonBody: { message: 'projectId and key are required.' } };
      }
      const container = await ensureNamedContainer('ProjectCustomers', CONTAINER_OPTS);
      const id = buildId(projectId, key);

      await container.item(id, projectId).delete();
      return { status: 204 };
    } catch (error) {
      if (error?.code === 404 || error?.code === 'NotFound') {
        return { status: 204 };
      }
      context.log('DeleteProjectCustomer failed', error);
      return { status: 500, jsonBody: { message: 'Failed to delete project customer.' } };
    }
  },
});
