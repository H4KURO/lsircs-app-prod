const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const projectsContainer = () => getNamedContainer('Projects', ['COSMOS_PROJECTS_CONTAINER']);

app.http('SaveCustomerImportConfig', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const { spreadsheetId, tabHeaderRows } = body;

      const container = projectsContainer();
      const id = 'customer-import-config';

      let existing = {};
      try {
        const { resource } = await container.item(id, id).read();
        existing = resource || {};
      } catch (_) { /* new config */ }

      const doc = {
        ...existing,
        id,
        spreadsheetId: spreadsheetId !== undefined ? (spreadsheetId || '') : (existing.spreadsheetId || ''),
        tabHeaderRows: { ...(existing.tabHeaderRows || {}), ...(tabHeaderRows || {}) },
        updatedAt: new Date().toISOString(),
      };
      await container.items.upsert(doc);
      return { status: 200, jsonBody: doc };
    } catch (error) {
      context.log('SaveCustomerImportConfig failed', error);
      return { status: 500, body: `設定の保存に失敗しました: ${error.message || error.toString()}` };
    }
  },
});
