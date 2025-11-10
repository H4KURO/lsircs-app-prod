const { app } = require('@azure/functions');
const { managedPropertiesContainer } = require('./managedPropertiesStore');

app.http('GetManagedProperties', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const container = await managedPropertiesContainer();
      const { resources } = await container.items.readAll().fetchAll();
      const sorted = (resources || []).sort((a, b) => {
        const left = b?.updatedAt || b?.createdAt || '';
        const right = a?.updatedAt || a?.createdAt || '';
        return left.localeCompare(right);
      });
      return { status: 200, jsonBody: sorted };
    } catch (error) {
      const message = error?.message || 'Failed to fetch managed properties.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('GetManagedProperties failed', error);
      return { status: 500, body: 'Failed to fetch managed properties.' };
    }
  },
});
