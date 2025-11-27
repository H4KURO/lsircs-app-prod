const { app } = require('@azure/functions');
const { managedPropertiesContainer } = require('./managedPropertiesStore');
const { deleteManagedPropertyPhotos } = require('./propertyPhotoStorage');

app.http('DeleteManagedProperty', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'DeleteManagedProperty/{id}',
  handler: async (request, context) => {
    try {
      const id = request.params?.id;
      if (!id) {
        return { status: 400, body: 'Managed property id is required.' };
      }

      const container = await managedPropertiesContainer();
      let existing = null;
      try {
        const { resource } = await container.item(id, id).read();
        existing = resource;
      } catch (error) {
        if (error?.code === 404 || error?.code === 'NotFound') {
          return { status: 404, body: 'Managed property not found.' };
        }
        throw error;
      }

      await container.item(id, id).delete();
      await deleteManagedPropertyPhotos((existing?.photos || []).map((photo) => photo.blobName));

      return { status: 204 };
    } catch (error) {
      if (error?.code === 404 || error?.code === 'NotFound') {
        return { status: 404, body: 'Managed property not found.' };
      }
      const message = error?.message || 'Failed to delete managed property.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('DeleteManagedProperty failed', error);
      return { status: 500, body: 'Failed to delete managed property.' };
    }
  },
});
