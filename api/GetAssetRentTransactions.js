const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const rentTransactionsContainer = () =>
  getNamedContainer('AssetRentTransactions', ['COSMOS_ASSET_RENT_TRANSACTIONS_CONTAINER']);

app.http('GetAssetRentTransactions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const container = rentTransactionsContainer();
      const { resources } = await container.items
        .query('SELECT * FROM c')
        .fetchAll();

      resources.sort((a, b) => {
        const aMonth = a.yearMonth || '';
        const bMonth = b.yearMonth || '';
        return bMonth.localeCompare(aMonth);
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
      context.log('GetAssetRentTransactions failed', error);
      return { status: 500, body: 'Error fetching asset rent transactions.' };
    }
  },
});
