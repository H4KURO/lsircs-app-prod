const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { getContainer } = require('./cosmosClient');

const databaseId = 'lsircs-database';
const containerId = 'Customers';
const ownerKey = '�S����';

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

      const container = getContainer(databaseId, containerId);
      const newCustomer = {
        id: uuidv4(),
        name,
        property: payload?.property ?? '',
        price: payload?.price ?? 0,
        [ownerKey]: payload?.[ownerKey] ?? '',
        createdAt: new Date().toISOString(),
      };

      const { resource } = await container.items.create(newCustomer);
      return { status: 201, jsonBody: resource };
    } catch (error) {
      const message = error.message || 'Error creating customer.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log.error('CreateCustomer failed', error);
      return { status: 500, body: 'Error creating customer.' };
    }
  },
});