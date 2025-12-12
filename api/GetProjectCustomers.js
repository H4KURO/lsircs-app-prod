const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const container = () =>
  getNamedContainer('ProjectCustomers', [
    'COSMOS_PROJECT_CUSTOMERS_CONTAINER',
    'CosmosProjectCustomersContainer',
  ]);

app.http('GetProjectCustomers', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const projectId = request.query.get('projectId');
      if (!projectId) {
        return { status: 400, body: 'projectId is required' };
      }

      const querySpec = {
        query: 'SELECT * FROM c WHERE c.projectId = @projectId ORDER BY c.rowIndex',
        parameters: [{ name: '@projectId', value: projectId }],
      };

      const { resources } = await container().items.query(querySpec).fetchAll();
      return { status: 200, jsonBody: resources };
    } catch (error) {
      const message = error?.message || 'Failed to fetch project customers.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      if (message.includes('Resource NotFound')) {
        context.log('ProjectCustomers container not found, returning empty list.');
        return { status: 200, jsonBody: [] };
      }
      context.log('GetProjectCustomers failed', error);
      return { status: 500, body: 'Failed to fetch project customers.' };
    }
  },
});
