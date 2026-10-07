const { app } = require('@azure/functions');
const { getSheetsClient } = require('./googleSheetsClient');

app.http('GetSheetTabs', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const spreadsheetId = request.query.get('spreadsheetId');
      if (!spreadsheetId) return { status: 400, body: 'spreadsheetId is required.' };

      const sheets = getSheetsClient();
      const response = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties.title',
      });

      const tabs = (response.data.sheets || []).map((s) => s.properties?.title || '').filter(Boolean);
      return { status: 200, jsonBody: { tabs } };
    } catch (error) {
      context.log('GetSheetTabs failed', error);
      if (error.code === 403 || error.status === 403) {
        return { status: 403, body: 'アクセス拒否: サービスアカウントがスプレッドシートに共有されているか確認してください。' };
      }
      if (error.code === 404 || error.status === 404) {
        return { status: 404, body: 'スプレッドシートが見つかりません。' };
      }
      return { status: 500, body: `シートタブの取得に失敗しました: ${error.message || error.toString()}` };
    }
  },
});
