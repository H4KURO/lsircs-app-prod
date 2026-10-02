const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const rentTransactionsContainer = () =>
  getNamedContainer('AssetRentTransactions', ['COSMOS_ASSET_RENT_TRANSACTIONS_CONTAINER']);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

const ALLOWED_UPDATE_FIELDS = [
  'contractId', 'propertyId', 'yearMonth',
  'expectedAmount', 'receivedAmount', 'receivedDate',
  'ownerPayoutAmount', 'ownerPayoutDate', 'status', 'notes',
];

app.http('UpdateAssetRentTransaction', {
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
        return { status: 400, body: 'Transaction id is required.' };
      }

      const container = rentTransactionsContainer();

      let existingTransaction;
      try {
        const { resource } = await container.item(id, id).read();
        existingTransaction = resource;
      } catch (readError) {
        const msg = readError.message || '';
        if (msg.includes('Resource NotFound') || msg.includes('Resource Not Found') || readError.code === 404) {
          return { status: 404, body: 'Transaction not found.' };
        }
        throw readError;
      }

      if (!existingTransaction) {
        return { status: 404, body: 'Transaction not found.' };
      }

      const updates = {};
      for (const field of ALLOWED_UPDATE_FIELDS) {
        if (payload[field] !== undefined) {
          updates[field] = payload[field];
        }
      }

      const now = new Date().toISOString();
      const updatedTransaction = {
        ...existingTransaction,
        ...updates,
        updatedAt: now,
        updatedBy: clientPrincipal.userDetails,
      };

      const { resource } = await container.item(id, id).replace(updatedTransaction);

      return { status: 200, jsonBody: resource };
    } catch (error) {
      const message = error.message || '';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      if (message.includes('Resource NotFound') || message.includes('Resource Not Found')) {
        return { status: 404, body: 'Transaction not found.' };
      }
      context.log('UpdateAssetRentTransaction failed', error);
      return { status: 500, body: 'Error updating asset rent transaction.' };
    }
  },
});
