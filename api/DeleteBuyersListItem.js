const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const buyersListContainer = () =>
  getNamedContainer('BuyersList', ['COSMOS_BUYERSLIST_CONTAINER', 'CosmosBuyersListContainer']);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch (error) {
    return null;
  }
}

app.http('DeleteBuyersListItem', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'DeleteBuyersListItem/{id}',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      const id = request.params?.id;
      if (!id) {
        return { status: 400, body: 'Item id is required.' };
      }

      const container = buyersListContainer();
      await container.item(id, id).delete();

      return { status: 200, body: 'Buyers list item deleted successfully.' };
    } catch (error) {
      if (error?.code === 404) {
        return { status: 404, body: 'Buyers list item not found.' };
      }
      const message = error.message || 'Error deleting buyers list item.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('DeleteBuyersListItem failed', error);
      return { status: 500, body: 'Error deleting buyers list item.' };
    }
  },
});
