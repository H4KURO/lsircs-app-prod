const { app } = require('@azure/functions');
const { ensureNamedContainer } = require('./cosmosClient');

// Fields added by the system — excluded from display headers
const SYSTEM_FIELDS = new Set([
  'id', 'projectTab', '_rowIndex', '_spreadsheetId',
  'importedAt', 'updatedAt', '_etag', '_rid', '_self', '_attachments', '_ts',
]);

app.http('GetContracts', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const projectTab = request.query.get('projectTab');
      if (!projectTab) {
        return { status: 400, body: 'projectTab is required.' };
      }

      const container = await ensureNamedContainer('Contracts', {
        overrideKeys: ['COSMOS_CONTRACTS_CONTAINER'],
        partitionKey: '/projectTab',
      });

      const { resources } = await container.items.query(
        {
          query: 'SELECT * FROM c WHERE c.projectTab = @tab ORDER BY c._rowIndex',
          parameters: [{ name: '@tab', value: projectTab }],
        },
        { partitionKey: projectTab },
      ).fetchAll();

      if (resources.length === 0) {
        return { status: 200, jsonBody: { headers: [], items: [], total: 0 } };
      }

      // Derive column order from the first document (insertion order is preserved)
      const headers = Object.keys(resources[0]).filter((k) => !SYSTEM_FIELDS.has(k));

      const items = resources.map((doc) => {
        const item = { _rowIndex: doc._rowIndex };
        headers.forEach((h) => { item[h] = doc[h] ?? ''; });
        return item;
      });

      return {
        status: 200,
        jsonBody: { headers, items, total: items.length },
      };
    } catch (error) {
      context.log('GetContracts failed', error);
      return { status: 500, body: `データの取得に失敗しました: ${error.message || error.toString()}` };
    }
  },
});
