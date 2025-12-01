const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');
const { validationError, splitAttachmentsByUploadRequirement } = require('./attachmentUtils');
const {
  uploadAttachmentForEntity,
  deleteAttachments,
  attachAttachmentUrls,
} = require('./propertyPhotoStorage');

const customersContainer = () =>
  getNamedContainer('Customers', ['COSMOS_CUSTOMERS_CONTAINER', 'CosmosCustomersContainer']);

app.http('UpdateCustomer', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'UpdateCustomer/{id}',
  handler: async (request, context) => {
    try {
      const id = request.params?.id;
      if (!id) {
        return { status: 400, body: 'Customer id is required.' };
      }

      const updates = await request.json();
      const container = customersContainer();

      const { resource: existingCustomer } = await container.item(id, id).read();
      if (!existingCustomer) {
        return { status: 404, body: 'Customer not found.' };
      }

      let attachmentsToPersist = existingCustomer.attachments || [];
      if (Object.prototype.hasOwnProperty.call(updates, 'attachments')) {
        const { existingAttachments, newAttachments } = splitAttachmentsByUploadRequirement(
          updates.attachments,
        );
        delete updates.attachments;

        const existingMap = new Map((existingCustomer.attachments || []).map((att) => [att.id, att]));
        const kept = existingAttachments.map((attachment) => {
          const stored = existingMap.get(attachment.id);
          if (!stored) {
            throw validationError(`Attachment "${attachment.name}" no longer exists on the server.`);
          }
          return {
            ...stored,
            name: attachment.name || stored.name,
            description:
              typeof attachment.description === 'string' ? attachment.description : stored.description,
          };
        });

        const uploaded = [];
        for (const attachment of newAttachments) {
          uploaded.push(await uploadAttachmentForEntity('customer', existingCustomer.id, attachment));
        }

        const combined = [...kept, ...uploaded];
        const combinedIds = new Set(combined.map((attachment) => attachment.id));
        const removed = (existingCustomer.attachments || []).filter(
          (attachment) => !combinedIds.has(attachment.id),
        );
        await deleteAttachments(removed.map((attachment) => attachment.blobName));
        attachmentsToPersist = combined;
      }

      const updated = {
        ...existingCustomer,
        ...updates,
        attachments: attachmentsToPersist,
        updatedAt: new Date().toISOString(),
      };
      const { resource } = await container.item(id, id).replace(updated);

      const response = {
        ...resource,
        attachments: await attachAttachmentUrls(resource.attachments || []),
      };

      return { status: 200, jsonBody: response };
    } catch (error) {
      if (error?.code === 404) {
        return { status: 404, body: 'Customer not found.' };
      }
      const message = error.message || 'Error updating customer.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('UpdateCustomer failed', error);
      return { status: 500, body: 'Error updating customer.' };
    }
  },
});

