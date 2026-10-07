const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const projectsContainer = () => getNamedContainer('Projects', ['COSMOS_PROJECTS_CONTAINER']);

app.http('GetReportConfig', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const reportType = request.query.get('reportType');
      if (!reportType) return { status: 400, body: 'reportType is required.' };

      const container = projectsContainer();
      const id = `report-config-${reportType}`;

      try {
        const { resource } = await container.item(id, id).read();
        return { status: 200, jsonBody: resource };
      } catch (e) {
        if (e.code === 404 || (e.body && JSON.parse(e.body)?.code === 'NotFound')) {
          return { status: 200, jsonBody: { spreadsheetId: '', sheetTab: '', headerRow: null } };
        }
        throw e;
      }
    } catch (error) {
      context.log('GetReportConfig failed', error);
      return { status: 500, body: `設定の取得に失敗しました: ${error.message || error.toString()}` };
    }
  },
});
