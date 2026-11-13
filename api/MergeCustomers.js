const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const customersContainer = () => getNamedContainer('Customers', ['COSMOS_CUSTOMERS_CONTAINER']);
const propertiesContainer = () => getNamedContainer('Properties', ['COSMOS_PROPERTIES_CONTAINER']);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try { return JSON.parse(Buffer.from(header, 'base64').toString('utf-8')); } catch { return null; }
}

function uniqueById(arr) {
  const seen = new Set();
  return (arr || []).filter((item) => {
    const key = item?.id || item?.url || item?.displayName || JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

      const custContainer = customersContainer();
      const [{ resource: primary }, { resource: secondary }] = await Promise.all([
        custContainer.item(primaryId, primaryId).read(),
        custContainer.item(secondaryId, secondaryId).read(),
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

      // Combine tags (deduplicated)
      merged.tags = Array.from(new Set([
        ...(primary.tags || []),
        ...(secondary.tags || []),
      ]));

      // Combine buyerLinks (deduplicated by url)
      const allLinks = [
        ...(primary.buyerLinks || (primary.buyerLink ? [{ url: primary.buyerLink, displayName: primary.buyerLink }] : [])),
        ...(secondary.buyerLinks || (secondary.buyerLink ? [{ url: secondary.buyerLink, displayName: secondary.buyerLink }] : [])),
      ];
      const seenUrls = new Set();
      merged.buyerLinks = allLinks.filter((l) => {
        if (!l?.url || seenUrls.has(l.url)) return false;
        seenUrls.add(l.url);
        return true;
      });

      // Combine boxFolders (deduplicated)
      merged.boxFolders = Array.from(new Set([
        ...(primary.boxFolders || []),
        ...(secondary.boxFolders || []),
      ]));

      // Combine comments (deduplicated by id)
      merged.comments = uniqueById([
        ...(primary.comments || []),
        ...(secondary.comments || []),
      ]);

      // Combine linkedPropertyNames
      merged.linkedPropertyNames = Array.from(new Set([
        ...(primary.linkedPropertyNames || []),
        ...(secondary.linkedPropertyNames || []),
      ]));

      // Save merged primary
      await custContainer.items.upsert(merged);

      // Re-link any Properties that referenced the secondary customer
      try {
        const propContainer = propertiesContainer();
        const { resources: linkedProps } = await propContainer.items
          .query({
            query: 'SELECT * FROM c WHERE c.linkedCustomerId = @id',
            parameters: [{ name: '@id', value: secondaryId }],
          })
          .fetchAll();

        await Promise.all(linkedProps.map(async (prop) => {
          const updated = { ...prop, linkedCustomerId: primaryId, updatedAt: now };
          await propContainer.item(prop.id, prop.id).replace(updated);
        }));

        if (linkedProps.length > 0) {
          context.log(`MergeCustomers: re-linked ${linkedProps.length} properties from ${secondaryId} to ${primaryId}`);
        }
      } catch (propErr) {
        context.log('MergeCustomers: failed to re-link properties', propErr);
        // Non-fatal — customer merge still succeeded
      }

      // Delete secondary
      await custContainer.item(secondaryId, secondaryId).delete();

      return { status: 200, jsonBody: merged };
    } catch (e) {
      context.log('MergeCustomers error', e);
      return { status: 500, body: e.message };
    }
  },
});
