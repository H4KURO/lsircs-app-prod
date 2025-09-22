const { app } = require('@azure/functions');
const { getContainer } = require('./cosmosClient');

const databaseId = 'lsircs-database';
const containerId = 'Invoices';

app.http('DeleteInvoice', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'DeleteInvoice/{id}',
  handler: async (request, context) => {
    try {
      const id = request.params?.id;
      if (!id) {
        return { status: 400, body: 'Invoice id is required.' };
      }

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
      await container.item(id, existingInvoice.customerId).delete();
      return { status: 204 };
    } catch (error) {
      if (error?.code === 404) {
        return { status: 404, body: 'Invoice not found.' };
      }
      const message = error.message || 'Error deleting invoice.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log.error('DeleteInvoice failed', error);
      return { status: 500, body: `Error deleting invoice.` };
    }
  },
});
