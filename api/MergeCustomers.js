const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const customersContainer = () => getNamedContainer('Customers', ['COSMOS_CUSTOMERS_CONTAINER']);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try { return JSON.parse(Buffer.from(header, 'base64').toString('utf-8')); } catch { return null; }
}

// Merge secondary into primary: fill empty fields, combine arrays, then delete secondary
app.http('MergeCustomers', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) return { status: 401, body: 'Unauthorized' };

    try {
      const { primaryId, secondaryId } = await request.json();
      if (!primaryId || !secondaryId) return { status: 400, body: 'primaryId and secondaryId required' };
      if (primaryId === secondaryId) return { status: 400, body: 'Cannot merge a record with itself' };

      const container = customersContainer();
      const [{ resource: primary }, { resource: secondary }] = await Promise.all([
        container.item(primaryId, primaryId).read(),
        container.item(secondaryId, secondaryId).read(),
      ]);
      if (!primary) return { status: 404, body: 'Primary customer not found' };
      if (!secondary) return { status: 404, body: 'Secondary customer not found' };

      const now = new Date().toISOString();
      const user = clientPrincipal.userDetails || clientPrincipal.userId;

      // Fill empty scalar fields from secondary
      const scalarFields = ['email', 'phone', 'company', 'country', 'region', 'source',
        'assignedTo', 'propertyInterest', 'preferredBedrooms', 'budget',
        'lastContactedAt', 'nextFollowUpAt', 'buyerLink'];

      const merged = { ...primary, updatedAt: now, updatedBy: user };
      for (const f of scalarFields) {
        if (!merged[f] && secondary[f]) merged[f] = secondary[f];
      }
      // Combine notes
      if (secondary.notes && secondary.notes !== primary.notes) {
        merged.notes = [primary.notes, secondary.notes].filter(Boolean).join('\n---\n');
      }
      // Combine linkedPropertyNames
      merged.linkedPropertyNames = Array.from(new Set([
        ...(primary.linkedPropertyNames || []),
        ...(secondary.linkedPropertyNames || []),
      ]));

      await container.items.upsert(merged);
      await container.item(secondaryId, secondaryId).delete();

      return { status: 200, jsonBody: merged };
    } catch (e) {
      context.log('MergeCustomers error', e);
      return { status: 500, body: e.message };
    }
  },
});
