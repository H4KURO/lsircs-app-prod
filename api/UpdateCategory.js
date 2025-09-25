const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const categoriesContainer = () =>
  getNamedContainer('Categories', ['COSMOS_CATEGORIES_CONTAINER', 'CosmosCategoriesContainer']);

app.http('UpdateCategory', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'UpdateCategory/{id}',
  handler: async (request, context) => {
    try {
      const id = request.params?.id;
      if (!id) {
        return { status: 400, body: 'Category id is required.' };
      }

      const payload = await request.json();
      const name = payload?.name?.trim();
      const color = payload?.color?.trim();
      if (!name || !color) {
        return { status: 400, body: 'Category name and color are required.' };
      }

      const container = categoriesContainer();
      const { resource: existing } = await container.item(id, id).read();
      if (!existing) {
        return { status: 404, body: 'Category not found.' };
      }

      const updated = {
        ...existing,
        name,
        color,
        updatedAt: new Date().toISOString(),
      };

      const { resource } = await container.item(id, id).replace(updated);
      return { status: 200, jsonBody: resource };
    } catch (error) {
      if (error?.code === 404) {
        return { status: 404, body: 'Category not found.' };
      }
      const message = error.message || 'Failed to update category.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log.error('UpdateCategory failed', error);
      return { status: 500, body: 'Failed to update category.' };
    }
  },
});