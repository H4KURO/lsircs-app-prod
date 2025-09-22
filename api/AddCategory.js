const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { getContainer } = require('./cosmosClient');

const databaseId = 'lsircs-database';
const containerId = 'Categories';

app.http('AddCategory', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const payload = await request.json();
      const name = payload?.name?.trim();
      const color = payload?.color?.trim();

      if (!name || !color) {
        return { status: 400, body: 'Category name and color are required.' };
      }

      const container = getContainer(databaseId, containerId);
      const newCategory = {
        id: uuidv4(),
        name,
        color,
        createdAt: new Date().toISOString(),
      };

      const { resource } = await container.items.create(newCategory);
      return { status: 201, jsonBody: resource };
    } catch (error) {
      const message = error.message || 'Failed to create category.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log.error('AddCategory failed', error);
      return { status: 500, body: 'Failed to create category.' };
    }
  },
});