const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const ownersContainer = () =>
  getNamedContainer('AssetOwners', ['COSMOS_ASSET_OWNERS_CONTAINER']);

app.http('GetAssetOwners', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const container = ownersContainer();
      const { resources } = await container.items
        .query('SELECT * FROM c')
        .fetchAll();

      resources.sort((a, b) => {
        const aName = a.name || '';
        const bName = b.name || '';
        return aName.localeCompare(bName);
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
      context.log('GetAssetOwners failed', error);
      return { status: 500, body: 'Error fetching asset owners.' };
    }
  },
});
