const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');
const { v4: uuidv4 } = require('uuid');

function parseClientPrincipal(request) {
  if (process.env.DEV_AUTH_BYPASS === 'true') {
    return { userId: 'dev-user', userDetails: 'dev@local.test' };
  }
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

const CONTAINERS = {
  property: () => getNamedContainer('Properties', ['COSMOS_PROPERTIES_CONTAINER']),
  customer: () => getNamedContainer('Customers', ['COSMOS_CUSTOMERS_CONTAINER']),
};

app.http('AddEntityComment', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const principal = parseClientPrincipal(request);
    if (!principal) return { status: 401, body: 'Unauthorized.' };

    try {
      const { entityType, entityId, text } = await request.json();
      if (!entityType || !entityId || !text?.trim()) {
        return { status: 400, body: 'entityType, entityId, and text are required.' };
      }
      const containerFn = CONTAINERS[entityType];
      if (!containerFn) return { status: 400, body: 'Invalid entityType. Use "property" or "customer".' };

      const container = containerFn();
      const { resource: entity } = await container.item(entityId, entityId).read();
      if (!entity) return { status: 404, body: 'Entity not found.' };

      const comment = {
        id: uuidv4(),
        text: text.trim(),
        authorDisplayName: principal.userDetails || principal.userId,
        authorUserId: principal.userId,
        createdAt: new Date().toISOString(),
      };

      const comments = [...(entity.comments || []), comment];
      await container.item(entityId, entityId).patch([
        { op: 'set', path: '/comments', value: comments },
        { op: 'set', path: '/updatedAt', value: new Date().toISOString() },
      ]);

      return { status: 201, jsonBody: comment };
    } catch (error) {
      context.log('AddEntityComment error', error);
      return { status: 500, body: error.message };
    }
  },
});
