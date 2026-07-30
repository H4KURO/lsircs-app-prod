const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const contractsContainer = () =>
  getNamedContainer('AssetContracts', ['COSMOS_ASSET_CONTRACTS_CONTAINER']);

app.http('GetAssetContracts', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const container = contractsContainer();
      const { resources } = await container.items
        .query('SELECT * FROM c')
        .fetchAll();

      resources.sort((a, b) => {
        const aDate = a.startDate || '';
        const bDate = b.startDate || '';
        return bDate.localeCompare(aDate);
      });

      return { status: 200, jsonBody: resources };
    } catch (error) {
      const message = error.message || '';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      if (message.includes('Resource NotFound')) {
        return { status: 200, jsonBody: [] };
      }
      context.log('GetAssetContracts failed', error);
      return { status: 500, body: 'Error fetching asset contracts.' };
    }
  },
});
