const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { getNamedContainer } = require('./cosmosClient');

const propertiesContainer = () =>
  getNamedContainer('AssetProperties', ['COSMOS_ASSET_PROPERTIES_CONTAINER']);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

app.http('CreateAssetProperty', {
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
        return { status: 400, body: 'Property name is required.' };
      }

      const container = propertiesContainer();
      const now = new Date().toISOString();

      const property = {
        id: uuidv4(),
        name,
        address: payload.address ?? '',
        propertyType: payload.propertyType ?? 'apartment',
        ownerId: payload.ownerId ?? null,
        unitCount: payload.unitCount ?? null,
        builtYear: payload.builtYear ?? null,
        status: payload.status ?? 'active',
        notes: payload.notes ?? '',
        createdAt: now,
        updatedAt: now,
        createdBy: clientPrincipal.userDetails,
        updatedBy: null,
      };

      const { resource } = await container.items.create(property);

      return { status: 201, jsonBody: resource };
    } catch (error) {
      const message = error.message || '';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      if (message.includes('Resource NotFound')) {
        return { status: 404, body: 'AssetProperties container not found in Cosmos DB.' };
      }
      context.log('CreateAssetProperty failed', error);
      return { status: 500, body: 'Error creating asset property.' };
    }
  },
});
