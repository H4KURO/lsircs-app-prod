const { app } = require('@azure/functions');
const { managedPropertiesContainer } = require('./managedPropertiesStore');
const { buildManagedProperty, splitPhotosByUploadRequirement } = require('./managedPropertyUtils');
const { uploadManagedPropertyPhoto, attachPhotoUrls } = require('./propertyPhotoStorage');

app.http('CreateManagedProperty', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const payload = await request.json();
      const managedProperty = buildManagedProperty(payload);
      const { existingPhotos, newPhotos } = splitPhotosByUploadRequirement(payload?.photos);
      if (existingPhotos.length > 0) {
        return {
          status: 400,
          body: 'Existing photos cannot be reused when creating a property.',
        };
      }

      const uploadedPhotos = [];
      for (const photo of newPhotos) {
        uploadedPhotos.push(await uploadManagedPropertyPhoto(managedProperty.id, photo));
      }
      managedProperty.photos = uploadedPhotos;

      const container = await managedPropertiesContainer();
      const { resource } = await container.items.create(managedProperty);

      const response = {
        ...resource,
        photos: await attachPhotoUrls(resource.photos || []),
      };

      return { status: 201, jsonBody: response };
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
