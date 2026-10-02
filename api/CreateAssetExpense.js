const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { ensureNamedContainer } = require('./cosmosClient');

const expensesContainer = () =>
  ensureNamedContainer('AssetExpenses', { overrideKeys: ['COSMOS_ASSET_EXPENSES_CONTAINER'] });

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

app.http('CreateAssetExpense', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      const payload = await request.json();

      const propertyId = payload?.propertyId?.trim();
      if (!propertyId) {
        return { status: 400, body: 'propertyId is required.' };
      }

      const yearMonth = payload?.yearMonth?.trim();
      if (!yearMonth) {
        return { status: 400, body: 'yearMonth is required.' };
      }

      const container = await expensesContainer();
      const now = new Date().toISOString();

      const expense = {
        id: uuidv4(),
        propertyId,
        category: payload.category ?? 'other',
        yearMonth,
        amount: payload.amount ?? 0,
        paidDate: payload.paidDate ?? '',
        vendor: payload.vendor ?? '',
        notes: payload.notes ?? '',
        createdAt: now,
        updatedAt: now,
        createdBy: clientPrincipal.userDetails,
        updatedBy: null,
      };

      const { resource } = await container.items.create(expense);

      return { status: 201, jsonBody: resource };
    } catch (error) {
      const message = error.message || '';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('CreateAssetExpense failed', error);
      return { status: 500, body: 'Error creating asset expense.' };
    }
  },
});
