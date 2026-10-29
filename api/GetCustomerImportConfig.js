const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const projectsContainer = () => getNamedContainer('Projects', ['COSMOS_PROJECTS_CONTAINER']);

app.http('GetCustomerImportConfig', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (_request, context) => {
    try {
      const container = projectsContainer();
      const { resource } = await container.item('customer-import-config', 'customer-import-config').read();
      return { status: 200, jsonBody: resource || {} };
    } catch (e) {
      if (e.code === 404) return { status: 200, jsonBody: {} };
      context.log('GetCustomerImportConfig failed', e);
      return { status: 500, body: '設定の取得に失敗しました。' };
    }
  },
});
