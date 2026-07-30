const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { getNamedContainer } = require('./cosmosClient');

const contractsContainer = () =>
  getNamedContainer('AssetContracts', ['COSMOS_ASSET_CONTRACTS_CONTAINER']);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

app.http('CreateAssetContract', {
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

      const tenantName = payload?.tenantName?.trim();
      if (!tenantName) {
        return { status: 400, body: 'Tenant name is required.' };
      }

      const container = contractsContainer();
      const now = new Date().toISOString();

      const contract = {
        id: uuidv4(),
        propertyId,
        unitNumber: payload.unitNumber ?? '',
        tenantName,
        tenantContact: payload.tenantContact ?? '',
        rentAmount: payload.rentAmount ?? 0,
        managementFeeAmount: payload.managementFeeAmount ?? 0,
        depositAmount: payload.depositAmount ?? 0,
        startDate: payload.startDate ?? '',
        endDate: payload.endDate ?? '',
        status: payload.status ?? 'active',
        notes: payload.notes ?? '',
        createdAt: now,
        updatedAt: now,
        createdBy: clientPrincipal.userDetails,
        updatedBy: null,
      };

      const { resource } = await container.items.create(contract);

      return { status: 201, jsonBody: resource };
    } catch (error) {
      const message = error.message || '';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      if (message.includes('Resource NotFound')) {
        return { status: 404, body: 'AssetContracts container not found in Cosmos DB.' };
      }
      context.log('CreateAssetContract failed', error);
      return { status: 500, body: 'Error creating asset contract.' };
    }
  },
});
