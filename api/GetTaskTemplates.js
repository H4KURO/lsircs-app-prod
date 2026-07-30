const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');
const { parseClientPrincipal } = require('./userProfileStore');

const templatesContainer = () =>
  getNamedContainer('TaskTemplates', ['COSMOS_TASK_TEMPLATES_CONTAINER', 'CosmosTaskTemplatesContainer']);

app.http('GetTaskTemplates', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const principal = parseClientPrincipal(request);
    if (!principal) return { status: 401, body: 'Not logged in' };

    try {
      const container = templatesContainer();
      const { resources } = await container.items
        .query('SELECT * FROM c ORDER BY c.createdAt DESC')
        .fetchAll();
      return { status: 200, jsonBody: resources };
    } catch (error) {
      const msg = error.message || '';
      if (error?.code === 404 || msg.includes('Resource NotFound')) {
        return { status: 200, jsonBody: [] };
      }
      context.log('GetTaskTemplates failed', error);
      return { status: 500, body: 'Error loading templates.' };
    }
  },
});
