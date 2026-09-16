const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const propertiesContainer = () =>
  getNamedContainer('Properties', ['COSMOS_PROPERTIES_CONTAINER']);

app.http('GetProperties', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const container = propertiesContainer();
      const { resources } = await container.items
        .query('SELECT * FROM c ORDER BY c.propertyName')
        .fetchAll();
      return { status: 200, jsonBody: resources };
    } catch (error) {
      if ((error.message || '').includes('Resource NotFound')) return { status: 200, jsonBody: [] };
      context.log('GetProperties failed', error);
      return { status: 500, body: 'Error fetching properties.' };
    }
  },
});
