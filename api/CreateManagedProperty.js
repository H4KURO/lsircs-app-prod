const { app } = require('@azure/functions');
const { managedPropertiesContainer } = require('./managedPropertiesStore');
const { buildManagedProperty } = require('./managedPropertyUtils');

app.http('CreateManagedProperty', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const payload = await request.json();
      const managedProperty = buildManagedProperty(payload);

      const container = await managedPropertiesContainer();
      const { resource } = await container.items.create(managedProperty);

      return { status: 201, jsonBody: resource };
    } catch (error) {
      if (error?.code === 'ValidationError') {
        return { status: 400, body: error.message };
      }
      const message = error?.message || 'Failed to create managed property.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('CreateManagedProperty failed', error);
      return { status: 500, body: 'Failed to create managed property.' };
    }
  },
});
