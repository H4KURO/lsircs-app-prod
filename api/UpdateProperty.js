const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const propertiesContainer = () =>
  getNamedContainer('Properties', ['COSMOS_PROPERTIES_CONTAINER']);

const ALLOWED_FIELDS = ['managementType', 'ownerName', 'ownerPhone', 'tenantStatus',
  'leaseStart', 'leaseEnd', 'monthlyRent', 'notes', 'manualFields', 'status',
  'buildingName', 'registrationDate', 'purchasePrice'];

app.http('UpdateProperty', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'UpdateProperty/{id}',
  handler: async (request, context) => {
    try {
      const id = request.params?.id;
      const body = await request.json();
      const container = propertiesContainer();
      const { resource: existing } = await container.item(id, id).read();
      if (!existing) return { status: 404, body: 'Property not found.' };
      const updates = {};
      for (const f of ALLOWED_FIELDS) {
        if (body[f] !== undefined) updates[f] = body[f];
      }
      const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
      const { resource } = await container.item(id, id).replace(updated);
      return { status: 200, jsonBody: resource };
    } catch (error) {
      context.log('UpdateProperty failed', error);
      return { status: 500, body: 'Error updating property.' };
    }
  },
});
