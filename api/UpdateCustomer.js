const { app } = require('@azure/functions');
const { getContainer } = require('./cosmosClient');

const databaseId = 'lsircs-database';
const containerId = 'Customers';

app.http('UpdateCustomer', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'UpdateCustomer/{id}',
  handler: async (request, context) => {
    try {
      const id = request.params?.id;
      if (!id) {
        return { status: 400, body: 'Customer id is required.' };
      }

      const updates = await request.json();
      const container = getContainer(databaseId, containerId);

      const { resource: existingCustomer } = await container.item(id, id).read();
      if (!existingCustomer) {
        return { status: 404, body: 'Customer not found.' };
      }

      const updated = { ...existingCustomer, ...updates, updatedAt: new Date().toISOString() };
      const { resource } = await container.item(id, id).replace(updated);

      return { status: 200, jsonBody: resource };
    } catch (error) {
      if (error?.code === 404) {
        return { status: 404, body: 'Customer not found.' };
      }
      const message = error.message || 'Error updating customer.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log.error('UpdateCustomer failed', error);
      return { status: 500, body: 'Error updating customer.' };
    }
  },
});
