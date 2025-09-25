const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { getNamedContainer } = require('./cosmosClient');

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
      if (message.includes('Resource NotFound')) {
        context.log('Customers container not found, returning conflict.');
        return { status: 404, body: 'Customer container not found in Cosmos DB.' };
      }
      context.log('CreateCustomer failed', error);
      return { status: 500, body: 'Error creating customer.' };
    }
  },
});

