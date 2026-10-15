const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const projectsContainer = () => getNamedContainer('Projects', ['COSMOS_PROJECTS_CONTAINER']);

app.http('SaveContractConfig', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const { spreadsheetId } = body;

      const container = projectsContainer();
      const id = 'contract-config';
      const doc = {
        id,
        spreadsheetId: spreadsheetId || '',
        updatedAt: new Date().toISOString(),
      };
      await container.items.upsert(doc);
      return { status: 200, jsonBody: doc };
    } catch (error) {
      context.log('SaveContractConfig failed', error);
      return { status: 500, body: `設定の保存に失敗しました: ${error.message || error.toString()}` };
    }
  },
});
