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

app.http('UpdateBuyersListItem', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'UpdateBuyersListItem/{id}',
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

      const updatesPayload = await request.json();
      const container = buyersListContainer();
      
      const { resource: existingItem } = await container.item(id, id).read();
      if (!existingItem) {
        return { status: 404, body: 'Buyers list item not found.' };
      }

      const now = new Date().toISOString();
      const updatedItem = {
        ...existingItem,
        ...updatesPayload,
        id: existingItem.id, // IDは変更不可
        createdAt: existingItem.createdAt, // 作成日時は変更不可
        createdBy: existingItem.createdBy, // 作成者は変更不可
        updatedAt: now,
        updatedBy: clientPrincipal.userDetails || 'Unknown',
      };

      const { resource } = await container.item(id, id).replace(updatedItem);
      return { status: 200, jsonBody: resource };
    } catch (error) {
      if (error?.code === 404) {
        return { status: 404, body: 'Buyers list item not found.' };
      }
      const message = error.message || 'Error updating buyers list item.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('UpdateBuyersListItem failed', error);
      return { status: 500, body: 'Error updating buyers list item.' };
    }
  },
});
