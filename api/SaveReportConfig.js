const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const projectsContainer = () => getNamedContainer('Projects', ['COSMOS_PROJECTS_CONTAINER']);

app.http('SaveReportConfig', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const { reportType, spreadsheetId, sheetTab, headerRow } = body;

      if (!reportType) return { status: 400, body: 'reportType is required.' };

      const container = projectsContainer();
      const id = `report-config-${reportType}`;

      const doc = {
        id,
        reportType,
        spreadsheetId: spreadsheetId || '',
        sheetTab: sheetTab || '',
        headerRow: headerRow || 1,
        updatedAt: new Date().toISOString(),
      };

      await container.items.upsert(doc);
      return { status: 200, jsonBody: doc };
    } catch (error) {
      context.log('SaveReportConfig failed', error);
      return { status: 500, body: `設定の保存に失敗しました: ${error.message || error.toString()}` };
    }
  },
});
