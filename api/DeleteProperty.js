const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');
const { requireAllowedUser } = require('./authUtils');

const propertiesContainer = () =>
  getNamedContainer('Properties', ['COSMOS_PROPERTIES_CONTAINER']);

app.http('DeleteProperty', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'DeleteProperty/{id}',
  handler: async (request, context) => {
    const auth = await requireAllowedUser(request);
    if (!auth.ok) return auth.response;
    try {
      const id = request.params?.id;
      const container = propertiesContainer();
      await container.item(id, id).delete();
      return { status: 200, jsonBody: { ok: true } };
    } catch (error) {
      context.log('DeleteProperty failed', error);
      return { status: 500, body: 'Error deleting property.' };
    }
  },
});
