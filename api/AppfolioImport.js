const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { getNamedContainer } = require('./cosmosClient');
const { mergeAppfolioData } = require('./appfolioParser');

const propertiesContainer = () =>
  getNamedContainer('Properties', ['COSMOS_PROPERTIES_CONTAINER']);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try { return JSON.parse(Buffer.from(header, 'base64').toString('utf-8')); } catch { return null; }
}

// POST /api/AppfolioImport
// Body: { propertyFile, propertyGroupFile, tenantFile, ownerFile } (base64 xlsx strings)
//       importSource: "manual" | "email"
// OR for n8n/direct JSON: { rows: { propertyRows, groupMap, tenantMap } }
app.http('AppfolioImport', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) return { status: 401, body: 'Unauthorized' };

    try {
      const body = await request.json();
      const importSource = body.importSource || 'manual';
      const now = new Date().toISOString();

      let mergedRecords;
      if (body.propertyFile) {
        mergedRecords = await mergeAppfolioData({
          propertyFile: body.propertyFile,
          propertyGroupFile: body.propertyGroupFile || null,
          tenantFile: body.tenantFile || null,
          ownerFile: body.ownerFile || null,
        });
      } else {
        return { status: 400, body: 'propertyFile (base64 xlsx) is required.' };
      }

      const container = propertiesContainer();
      const { resources: existing } = await container.items
        .query('SELECT c.id, c.propertyName, c.buildingName, c.notes, c.manualFields, c.registrationDate, c.purchasePrice, c.createdAt FROM c')
        .fetchAll();
      const existingByName = new Map(existing.map(r => [r.propertyName, r]));

      let created = 0, updated = 0, errors = 0;
      const results = [];

      for (const record of mergedRecords) {
        if (!record.propertyName) continue;
        try {
          const existing = existingByName.get(record.propertyName);
          if (existing) {
            const updated_doc = {
              ...existing,
              ...record,
              // Preserve user-entered fields
              notes: existing.notes || null,
              manualFields: existing.manualFields || {},
              registrationDate: existing.registrationDate || null,
              purchasePrice: existing.purchasePrice || null,
              importedAt: now,
              importSource,
              updatedAt: now,
            };
            await container.item(existing.id, existing.id).replace(updated_doc);
            updated++;
            results.push({ propertyName: record.propertyName, action: 'updated' });
          } else {
            const newDoc = {
              id: uuidv4(),
              ...record,
              notes: null,
              manualFields: {},
              importedAt: now,
              importSource,
              createdAt: now,
              updatedAt: now,
            };
            await container.items.create(newDoc);
            created++;
            results.push({ propertyName: record.propertyName, action: 'created' });
          }
        } catch (err) {
          errors++;
          context.log(`AppfolioImport upsert error for ${record.propertyName}: ${err.message}`);
          results.push({ propertyName: record.propertyName, action: 'error', error: err.message });
        }
      }

      context.log(`AppfolioImport: created=${created}, updated=${updated}, errors=${errors}`);
      return { status: 200, jsonBody: { ok: true, created, updated, errors, total: mergedRecords.length, results } };
    } catch (error) {
      context.log('AppfolioImport failed', error.message);
      return { status: 500, body: `Error: ${error.message}` };
    }
  },
});
