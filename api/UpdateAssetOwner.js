const { app } = require('@azure/functions');
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

const ALLOWED_UPDATE_FIELDS = [
  'name', 'kana', 'contactEmail', 'contactPhone', 'address',
  'bankName', 'bankBranch', 'bankAccountType', 'bankAccountNumber', 'bankAccountHolder',
  'notes',
];

app.http('UpdateAssetOwner', {
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
        return { status: 400, body: 'Owner id is required.' };
      }

      const container = ownersContainer();

      let existingOwner;
      try {
        const { resource } = await container.item(id, id).read();
        existingOwner = resource;
      } catch (readError) {
        const msg = readError.message || '';
        if (msg.includes('Resource NotFound') || msg.includes('Resource Not Found') || readError.code === 404) {
          return { status: 404, body: 'Owner not found.' };
        }
        throw readError;
      }

      if (!existingOwner) {
        return { status: 404, body: 'Owner not found.' };
      }

      const updates = {};
      for (const field of ALLOWED_UPDATE_FIELDS) {
        if (payload[field] !== undefined) {
          updates[field] = payload[field];
        }
      }

      const now = new Date().toISOString();
      const updatedOwner = {
        ...existingOwner,
        ...updates,
        updatedAt: now,
        updatedBy: clientPrincipal.userDetails,
      };

      const { resource } = await container.item(id, id).replace(updatedOwner);

      return { status: 200, jsonBody: resource };
    } catch (error) {
      const message = error.message || '';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      if (message.includes('Resource NotFound') || message.includes('Resource Not Found')) {
        return { status: 404, body: 'Owner not found.' };
      }
      context.log('UpdateAssetOwner failed', error);
      return { status: 500, body: 'Error updating asset owner.' };
    }
  },
});
