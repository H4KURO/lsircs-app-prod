const { app } = require('@azure/functions');
const { ensureNamedContainer } = require('./cosmosClient');

const expensesContainer = () =>
  ensureNamedContainer('AssetExpenses', { overrideKeys: ['COSMOS_ASSET_EXPENSES_CONTAINER'] });

app.http('GetAssetExpenses', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const container = await expensesContainer();
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
      context.log('GetAssetExpenses failed', error);
      return { status: 500, body: 'Error fetching asset expenses.' };
    }
  },
});
