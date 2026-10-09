const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const projectsContainer = () => getNamedContainer('Projects', ['COSMOS_PROJECTS_CONTAINER']);

app.http('GetContractConfig', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const container = projectsContainer();
      const id = 'contract-config';
      try {
        const { resource } = await container.item(id, id).read();
        return { status: 200, jsonBody: resource };
      } catch (e) {
        if (e.code === 404 || (e.body && JSON.parse(e.body)?.code === 'NotFound')) {
          return { status: 200, jsonBody: { spreadsheetId: '' } };
        }
        throw e;
      }
    } catch (error) {
      context.log('GetContractConfig failed', error);
      return { status: 500, body: `設定の取得に失敗しました: ${error.message || error.toString()}` };
    }
  },
});
