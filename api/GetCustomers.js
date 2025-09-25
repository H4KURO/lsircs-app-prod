const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const customersContainer = () =>
  getNamedContainer('Customers', ['COSMOS_CUSTOMERS_CONTAINER', 'CosmosCustomersContainer']);

app.http('GetCustomers', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const container = customersContainer();
      const { resources } = await container.items.readAll().fetchAll();
      return { status: 200, jsonBody: resources };
    } catch (error) {
      const message = error.message || 'Error fetching customers from the database.';
      if (message.includes('Resource NotFound')) {
        context.log.warn('Customers container not found, returning empty list.');
        return { status: 200, jsonBody: [] };
      }
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log.error('GetCustomers failed', error);
      return { status: 500, body: 'Error fetching customers from the database.' };
    }
  },
});