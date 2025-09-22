const { app } = require('@azure/functions');
const { getContainer } = require('./cosmosClient');

const databaseId = 'lsircs-database';
const containerId = 'Customers';

app.http('DeleteCustomer', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'DeleteCustomer/{id}',
  handler: async (request, context) => {
    try {
      const id = request.params?.id;
      if (!id) {
        return { status: 400, body: 'Customer id is required.' };
      }

      const container = getContainer(databaseId, containerId);
      await container.item(id, id).delete();

      return { status: 204 };
    } catch (error) {
      if (error?.code === 404) {
        return { status: 404, body: 'Customer not found.' };
      }
      const message = error.message || 'Error deleting customer.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log.error('DeleteCustomer failed', error);
      return { status: 500, body: 'Error deleting customer.' };
    }
  },
});
