const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const buyersListContainer = () =>
  getNamedContainer('BuyersList', ['COSMOS_BUYERSLIST_CONTAINER', 'CosmosBuyersListContainer']);

app.http('GetBuyersList', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const container = buyersListContainer();
      const { resources } = await container.items.readAll().fetchAll();

      // ユニット番号でソート
      const sortedResources = resources.sort((a, b) => {
        const unitA = parseInt(a.unitNumber) || 0;
        const unitB = parseInt(b.unitNumber) || 0;
        return unitA - unitB;
      });

      return { status: 200, jsonBody: sortedResources };
    } catch (error) {
      const message = error.message || 'Error fetching buyers list from the database.';
      if (message.includes('Resource NotFound')) {
        context.log('BuyersList container not found, returning empty list.');
        return { status: 200, jsonBody: [] };
      }
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('GetBuyersList failed', error);
      return { status: 500, body: 'Error fetching buyers list from the database.' };
    }
  },
});
