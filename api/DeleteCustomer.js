const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const customersContainer = () =>
  getNamedContainer('Customers', ['COSMOS_CUSTOMERS_CONTAINER']);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

app.http('DeleteCustomer', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      const payload = await request.json();
      const { id } = payload;
      if (!id) {
        return { status: 400, body: 'Customer id is required.' };
      }

      const container = customersContainer();
      await container.item(id, id).delete();

      return { status: 200, jsonBody: { success: true } };
    } catch (error) {
      const message = error.message || '';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      if (
        message.includes('Resource NotFound') ||
        message.includes('Resource Not Found') ||
        error.code === 404
      ) {
        return { status: 404, body: 'Customer not found.' };
      }
      context.log('DeleteCustomer failed', error);
      return { status: 500, body: 'Error deleting customer.' };
    }
  },
});
