const { app } = require('@azure/functions');
const { getContainer } = require('./cosmosClient');

const databaseId = 'lsircs-database';
const containerId = 'Invoices';

app.http('UpdateInvoice', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'UpdateInvoice/{id}',
  handler: async (request, context) => {
    try {
      const id = request.params.get('id');
      if (!id) {
        return { status: 400, body: 'Invoice id is required.' };
      }

      const updates = await request.json();
      const container = getContainer(databaseId, containerId);

      const query = {
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: id }],
      };
      const { resources } = await container.items.query(query).fetchAll();
      if (resources.length === 0) {
        return { status: 404, body: 'Invoice not found.' };
      }

      const existingInvoice = resources[0];
      const updatedInvoice = { ...existingInvoice, ...updates, updatedAt: new Date().toISOString() };
      const { resource } = await container.item(id, existingInvoice.customerId).replace(updatedInvoice);

      return { status: 200, jsonBody: resource };
    } catch (error) {
      if (error?.code === 404) {
        return { status: 404, body: 'Invoice not found.' };
      }
      const message = error.message || 'Error updating invoice.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log.error('UpdateInvoice failed', error);
      return { status: 500, body: 'Error updating invoice.' };
    }
  },
});