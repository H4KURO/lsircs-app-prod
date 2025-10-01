const { app } = require('@azure/functions');
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

function sanitiseTag(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

app.http('UpdateAutomationRule', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'UpdateAutomationRule/{id}',
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

      const updatesPayload = await request.json();
      const container = await automationRulesContainer();
      const { resource: existingRule } = await container.item(id, id).read();
      if (!existingRule) {
        return { status: 404, body: 'Automation rule not found.' };
      }

      const normalizedRule = { ...existingRule };

      if (Object.prototype.hasOwnProperty.call(updatesPayload, 'tag')) {
        const nextTag = sanitiseTag(updatesPayload.tag);
        if (!nextTag) {
          return { status: 400, body: 'Automation rule tag is required.' };
        }
        normalizedRule.tag = nextTag;
      }

      if (Object.prototype.hasOwnProperty.call(updatesPayload, 'enabled')) {
        normalizedRule.enabled = Boolean(updatesPayload.enabled);
      }

      if (Object.prototype.hasOwnProperty.call(updatesPayload, 'subtasks')) {
        normalizedRule.subtasks = normalizeSubtasksInput(updatesPayload.subtasks);
      } else {
        normalizedRule.subtasks = normalizeSubtasksInput(normalizedRule.subtasks);
      }

      const timestamp = new Date().toISOString();
      normalizedRule.updatedAt = timestamp;
      normalizedRule.updatedById = clientPrincipal.userId;
      normalizedRule.updatedByName = clientPrincipal.userDetails;

      const { resource } = await container.item(id, id).replace(normalizedRule);
      return { status: 200, jsonBody: {
        ...resource,
        enabled: resource?.enabled !== false,
        subtasks: normalizeSubtasksInput(resource?.subtasks),
      } };
    } catch (error) {
      if (error?.code === 404) {
        return { status: 404, body: 'Automation rule not found.' };
      }
      const message = error.message || 'Error updating automation rule.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('UpdateAutomationRule failed', error);
      return { status: 500, body: 'Error updating automation rule.' };
    }
  },
});
