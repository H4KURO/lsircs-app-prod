const { app } = require('@azure/functions');
const { ensureNamedContainer } = require('./cosmosClient');

const automationRulesContainer = () =>
  ensureNamedContainer('AutomationRules', [
    'COSMOS_AUTOMATION_RULES_CONTAINER',
    'CosmosAutomationRulesContainer',
  ]);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch (error) {
    return null;
  }
}

app.http('DeleteAutomationRule', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'DeleteAutomationRule/{id}',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      const id = request.params?.id;
      if (!id) {
        return { status: 400, body: 'Automation rule id is required.' };
      }

      const container = await automationRulesContainer();
      await container.item(id, id).delete();
      return { status: 204 };
    } catch (error) {
      if (error?.code === 404) {
        return { status: 404, body: 'Automation rule not found.' };
      }
      const message = error.message || 'Error deleting automation rule.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('DeleteAutomationRule failed', error);
      return { status: 500, body: 'Error deleting automation rule.' };
    }
  },
});
