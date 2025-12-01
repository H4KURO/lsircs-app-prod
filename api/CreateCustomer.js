const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { getNamedContainer } = require('./cosmosClient');
const { splitAttachmentsByUploadRequirement } = require('./attachmentUtils');
const { uploadAttachmentForEntity, attachAttachmentUrls } = require('./propertyPhotoStorage');

const ownerKey = '担当者';
const customersContainer = () =>
  getNamedContainer('Customers', ['COSMOS_CUSTOMERS_CONTAINER', 'CosmosCustomersContainer']);

app.http('CreateCustomer', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const payload = await request.json();
      const name = payload?.name?.trim();
      if (!name) {
        return { status: 400, body: 'Customer name is required.' };
      }

      const container = customersContainer();
      const now = new Date().toISOString();
      const { existingAttachments, newAttachments } = splitAttachmentsByUploadRequirement(
        payload?.attachments,
        { now },
      );
      if (existingAttachments.length > 0) {
        return { status: 400, body: 'Existing attachments cannot be reused when creating a customer.' };
      }
      const newCustomer = {
        id: uuidv4(),
        name,
        property: payload?.property ?? '',
        price: payload?.price ?? 0,
        [ownerKey]: payload?.[ownerKey] ?? '',
        attachments: [],
        createdAt: now,
      };

      if (newAttachments.length > 0) {
        const uploaded = [];
        for (const attachment of newAttachments) {
          uploaded.push(await uploadAttachmentForEntity('customer', newCustomer.id, attachment));
        }
        newCustomer.attachments = uploaded;
      }

      const { resource } = await container.items.create(newCustomer);
      const response = {
        ...resource,
        attachments: await attachAttachmentUrls(resource.attachments || []),
      };
      return { status: 201, jsonBody: response };
    } catch (error) {
      const message = error.message || 'Error creating customer.';
      if (message.includes('connection string')) {
        return { status: 500, body: message }; 
      }
      if (message.includes('Resource NotFound')) {
        context.log('Customers container not found, returning conflict.');
        return { status: 404, body: 'Customer container not found in Cosmos DB.' };
      }
      context.log('CreateCustomer failed', error);
      return { status: 500, body: 'Error creating customer.' };
    }
  },
});

