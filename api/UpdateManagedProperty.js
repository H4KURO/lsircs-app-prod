const { app } = require('@azure/functions');
const { managedPropertiesContainer } = require('./managedPropertiesStore');
const { applyManagedPropertyUpdates } = require('./managedPropertyUtils');

async function readManagedProperty(container, id) {
  try {
    const { resource } = await container.item(id, id).read();
    return resource;
  } catch (error) {
    if (error?.code === 404 || error?.code === 'NotFound') {
      return null;
    }
    throw error;
  }
}

app.http('UpdateManagedProperty', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'UpdateManagedProperty/{id}',
  handler: async (request, context) => {
    try {
      const id = request.params?.id;
      if (!id) {
        return { status: 400, body: 'Managed property id is required.' };
      }

      const payload = await request.json();
      const container = await managedPropertiesContainer();
      const existing = await readManagedProperty(container, id);
      if (!existing) {
        return { status: 404, body: 'Managed property not found.' };
      }

      const updated = applyManagedPropertyUpdates(existing, payload);
      const { resource } = await container.item(id, id).replace(updated);

      return { status: 200, jsonBody: resource };
    } catch (error) {
      if (error?.code === 'ValidationError') {
        return { status: 400, body: error.message };
      }
      if (error?.code === 'NotFound') {
        return { status: 404, body: 'Managed property not found.' };
      }
      const message = error?.message || 'Failed to update managed property.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('UpdateManagedProperty failed', error);
      return { status: 500, body: 'Failed to update managed property.' };
    }
  },
});
