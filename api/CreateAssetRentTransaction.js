const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { ensureNamedContainer } = require('./cosmosClient');

const rentTransactionsContainer = () =>
  ensureNamedContainer('AssetRentTransactions', { overrideKeys: ['COSMOS_ASSET_RENT_TRANSACTIONS_CONTAINER'] });

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

app.http('CreateAssetRentTransaction', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      const payload = await request.json();

      const contractId = payload?.contractId?.trim();
      if (!contractId) {
        return { status: 400, body: 'contractId is required.' };
      }

      const yearMonth = payload?.yearMonth?.trim();
      if (!yearMonth) {
        return { status: 400, body: 'yearMonth is required.' };
      }

      const container = await rentTransactionsContainer();
      const now = new Date().toISOString();

      const transaction = {
        id: uuidv4(),
        contractId,
        propertyId: payload.propertyId ?? null,
        yearMonth,
        expectedAmount: payload.expectedAmount ?? 0,
        receivedAmount: payload.receivedAmount ?? 0,
        receivedDate: payload.receivedDate ?? '',
        ownerPayoutAmount: payload.ownerPayoutAmount ?? 0,
        ownerPayoutDate: payload.ownerPayoutDate ?? '',
        status: payload.status ?? 'unpaid',
        notes: payload.notes ?? '',
        createdAt: now,
        updatedAt: now,
        createdBy: clientPrincipal.userDetails,
        updatedBy: null,
      };

      const { resource } = await container.items.create(transaction);

      return { status: 201, jsonBody: resource };
    } catch (error) {
      const message = error.message || '';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      if (message.includes('Resource NotFound')) {
        return { status: 404, body: 'AssetRentTransactions container not found in Cosmos DB.' };
      }
      context.log('CreateAssetRentTransaction failed', error);
      return { status: 500, body: 'Error creating asset rent transaction.' };
    }
  },
});
