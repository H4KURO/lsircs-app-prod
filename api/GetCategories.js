const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const categoriesContainer = () =>
  getNamedContainer('Categories', ['COSMOS_CATEGORIES_CONTAINER', 'CosmosCategoriesContainer']);

app.http('GetCategories', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const container = categoriesContainer();
      const { resources } = await container.items.readAll().fetchAll();
      return { status: 200, jsonBody: resources };
    } catch (error) {
      const message = error.message || 'Failed to fetch categories.';
      if (message.includes('Resource NotFound')) {
        context.log.warn('Categories container not found, returning empty list.');
        return { status: 200, jsonBody: [] };
      }
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log.error('GetCategories failed', error);
      return { status: 500, body: 'Failed to fetch categories.' };
    }
  },
});