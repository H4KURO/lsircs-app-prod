const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { getNamedContainer } = require('./cosmosClient');

const ownersContainer = () =>
  getNamedContainer('AssetOwners', ['COSMOS_ASSET_OWNERS_CONTAINER']);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

app.http('CreateAssetOwner', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      const payload = await request.json();

      const name = payload?.name?.trim();
      if (!name) {
        return { status: 400, body: 'Owner name is required.' };
      }

      const container = ownersContainer();
      const now = new Date().toISOString();

      const owner = {
        id: uuidv4(),
        name,
        kana: payload.kana ?? '',
        contactEmail: payload.contactEmail ?? '',
        contactPhone: payload.contactPhone ?? '',
        address: payload.address ?? '',
        bankName: payload.bankName ?? '',
        bankBranch: payload.bankBranch ?? '',
        bankAccountType: payload.bankAccountType ?? '',
        bankAccountNumber: payload.bankAccountNumber ?? '',
        bankAccountHolder: payload.bankAccountHolder ?? '',
        notes: payload.notes ?? '',
        createdAt: now,
        updatedAt: now,
        createdBy: clientPrincipal.userDetails,
        updatedBy: null,
      };

      const { resource } = await container.items.create(owner);

      return { status: 201, jsonBody: resource };
    } catch (error) {
      const message = error.message || '';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      if (message.includes('Resource NotFound')) {
        return { status: 404, body: 'AssetOwners container not found in Cosmos DB.' };
      }
      context.log('CreateAssetOwner failed', error);
      return { status: 500, body: 'Error creating asset owner.' };
    }
  },
});
