const { app } = require('@azure/functions');
const { managedPropertiesContainer } = require('./managedPropertiesStore');
const {
  applyManagedPropertyUpdates,
  splitPhotosByUploadRequirement,
  validationError,
} = require('./managedPropertyUtils');
const {
  uploadManagedPropertyPhoto,
  deleteManagedPropertyPhotos,
  attachPhotoUrls,
} = require('./propertyPhotoStorage');

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
      let nextPhotos = existing.photos || [];

      if (Object.prototype.hasOwnProperty.call(payload, 'photos')) {
        const { existingPhotos, newPhotos } = splitPhotosByUploadRequirement(payload.photos);
        const existingPhotoMap = new Map((existing.photos || []).map((photo) => [photo.id, photo]));

        const keptPhotos = existingPhotos.map((photo) => {
          const stored = existingPhotoMap.get(photo.id);
          if (!stored) {
            throw validationError(`Photo "${photo.name}" no longer exists on the server.`);
          }
          return {
            ...stored,
            name: photo.name || stored.name,
            description:
              typeof photo.description === 'string' ? photo.description : stored.description,
          };
        });

        const uploadedPhotos = [];
        for (const photo of newPhotos) {
          uploadedPhotos.push(await uploadManagedPropertyPhoto(existing.id, photo));
        }

        const incomingPhotos = [...keptPhotos, ...uploadedPhotos];
        const incomingIds = new Set(incomingPhotos.map((photo) => photo.id));
        const removedPhotos = (existing.photos || []).filter(
          (photo) => !incomingIds.has(photo.id),
        );
        await deleteManagedPropertyPhotos(removedPhotos.map((photo) => photo.blobName));

        nextPhotos = incomingPhotos;
      }

      updated.photos = nextPhotos;
      const { resource } = await container.item(id, id).replace(updated);
      const response = { ...resource, photos: await attachPhotoUrls(resource.photos || []) };

      return { status: 200, jsonBody: response };
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
      const debugMessage = error?.stack || error?.message || 'Failed to update managed property.';
      return { status: 500, body: debugMessage };
    }
  },
});
