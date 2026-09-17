const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { getNamedContainer } = require('./cosmosClient');
const { requireAllowedUser } = require('./authUtils');

const propertiesContainer = () =>
  getNamedContainer('Properties', ['COSMOS_PROPERTIES_CONTAINER']);

app.http('AddPropertyActivity', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const auth = await requireAllowedUser(request);
    if (!auth.ok) return auth.response;

    try {
      const { propertyId, content } = await request.json();
      if (!propertyId || !content?.trim()) {
        return { status: 400, body: 'propertyId and content are required.' };
      }

      const container = propertiesContainer();
      const { resource: existing } = await container.item(propertyId, propertyId).read();
      if (!existing) return { status: 404, body: 'Property not found.' };

      const entry = {
        id: uuidv4(),
        content: content.trim(),
        author: auth.principal.userDetails || '',
        createdAt: new Date().toISOString(),
      };

      const activityLog = Array.isArray(existing.activityLog) ? existing.activityLog : [];
      const updated = { ...existing, activityLog: [entry, ...activityLog] };
      const { resource } = await container.item(propertyId, propertyId).replace(updated);

      return { status: 200, jsonBody: resource };
    } catch (error) {
      context.log('AddPropertyActivity failed', error);
      return { status: 500, body: 'Error adding activity.' };
    }
  },
});
