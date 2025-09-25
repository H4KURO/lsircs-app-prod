const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const invoicesContainer = () =>
  getNamedContainer('Invoices', ['COSMOS_INVOICES_CONTAINER', 'CosmosInvoicesContainer']);

app.http('GetInvoices', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const container = invoicesContainer();
      const { resources } = await container.items.readAll().fetchAll();
      return { status: 200, jsonBody: resources };
    } catch (error) {
      const message = error.message || 'Error fetching invoices from the database.';
      if (message.includes('Resource NotFound')) {
        context.log('Invoices container not found, returning empty list.');
        return { status: 200, jsonBody: [] };
      }
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('GetInvoices failed', error);
      return { status: 500, body: 'Error fetching invoices from the database.' };
    }
  },
});

