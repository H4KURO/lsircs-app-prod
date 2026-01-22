const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
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

app.http('CreateBuyersListItem', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      const payload = await request.json();
      const unitNumber = payload?.unitNumber?.trim();
      
      if (!unitNumber) {
        return { status: 400, body: 'Unit number is required.' };
      }

      const container = buyersListContainer();
      const now = new Date().toISOString();

      const newItem = {
        id: uuidv4(),
        unitNumber,
        nameRomaji: payload?.nameRomaji || '',
        nameJapanese: payload?.nameJapanese || '',
        japanStaff: payload?.japanStaff || '',
        hawaiiStaff: payload?.hawaiiStaff || '',
        phone: payload?.phone || '',
        email: payload?.email || '',
        contractedDate: payload?.contractedDate || null,
        purchasePrice: payload?.purchasePrice || 0,
        status: payload?.status || 'Active',
        createdAt: now,
        createdBy: clientPrincipal.userDetails || 'Unknown',
        updatedAt: now,
        updatedBy: clientPrincipal.userDetails || 'Unknown',
      };

      const { resource } = await container.items.create(newItem);
      return { status: 201, jsonBody: resource };
    } catch (error) {
      const message = error.message || 'Error creating buyers list item.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      if (message.includes('Resource NotFound')) {
        return { status: 404, body: 'BuyersList container not found in Cosmos DB.' };
      }
      context.log('CreateBuyersListItem failed', error);
      return { status: 500, body: 'Error creating buyers list item.' };
    }
  },
});
