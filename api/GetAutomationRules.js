const { app } = require('@azure/functions');
const { ensureNamedContainer } = require('./cosmosClient');
const { normalizeSubtasksInput } = require('./subtaskUtils');

const automationRulesContainer = () =>
  ensureNamedContainer('AutomationRules', [
    'COSMOS_AUTOMATION_RULES_CONTAINER',
    'CosmosAutomationRulesContainer',
  ]);

app.http('GetAutomationRules', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const container = await automationRulesContainer();
      const { resources } = await container.items.readAll().fetchAll();
      const rules = (resources ?? []).map((rule) => ({
        ...rule,
        enabled: rule?.enabled !== false,
        subtasks: normalizeSubtasksInput(rule?.subtasks),
      }));
      return { status: 200, jsonBody: rules };
    } catch (error) {
      const message = error.message || 'Error fetching automation rules.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('GetAutomationRules failed', error);
      return { status: 500, body: 'Error fetching automation rules.' };
    }
  },
});
