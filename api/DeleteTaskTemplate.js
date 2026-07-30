const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');
const { parseClientPrincipal } = require('./userProfileStore');

const templatesContainer = () =>
  getNamedContainer('TaskTemplates', ['COSMOS_TASK_TEMPLATES_CONTAINER', 'CosmosTaskTemplatesContainer']);

app.http('DeleteTaskTemplate', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'DeleteTaskTemplate/:id',
  handler: async (request, context) => {
    const principal = parseClientPrincipal(request);
    if (!principal) return { status: 401, body: 'Not logged in' };

    const id = request.params?.id;
    if (!id) return { status: 400, body: 'Template id is required' };

    try {
      const container = templatesContainer();
      await container.item(id, id).delete();
      return { status: 200, jsonBody: { deleted: true, id } };
    } catch (error) {
      if (error?.code === 404) return { status: 404, body: 'Template not found' };
      context.log('DeleteTaskTemplate failed', error);
      return { status: 500, body: 'Error deleting template.' };
    }
  },
});
