const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { ensureNamedContainer } = require('./cosmosClient');
const { normalizeSubtasksInput } = require('./subtaskUtils');

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

app.http('CreateAutomationRule', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      const payload = await request.json();
      const tag = typeof payload?.tag === 'string' ? payload.tag.trim() : '';
      if (!tag) {
        return { status: 400, body: 'Automation rule tag is required.' };
      }

      const enabled = payload?.enabled !== false;
      const subtasks = normalizeSubtasksInput(payload?.subtasks);
      const container = await automationRulesContainer();
      const timestamp = new Date().toISOString();
      const rule = {
        id: uuidv4(),
        tag,
        enabled,
        subtasks,
        createdAt: timestamp,
        updatedAt: timestamp,
        createdById: clientPrincipal.userId,
        createdByName: clientPrincipal.userDetails,
        updatedById: clientPrincipal.userId,
        updatedByName: clientPrincipal.userDetails,
      };

      await container.items.create(rule);
      return { status: 201, jsonBody: rule };
    } catch (error) {
      const message = error.message || 'Error creating automation rule.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('CreateAutomationRule failed', error);
      return { status: 500, body: 'Error creating automation rule.' };
    }
  },
});
