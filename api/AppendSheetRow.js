const { app } = require('@azure/functions');
const { getSheetsClient } = require('./googleSheetsClient');

app.http('AppendSheetRow', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const { spreadsheetId, sheetTab, values } = body;

      if (!spreadsheetId) {
        return { status: 400, body: 'spreadsheetId is required.' };
      }
      if (!Array.isArray(values) || values.length === 0) {
        return { status: 400, body: 'values (array) is required.' };
      }

      const sheets = getSheetsClient();
      const range = sheetTab ? `'${sheetTab}'!A1` : 'A1';

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [values],
        },
      });

      return { status: 200, jsonBody: { success: true } };
    } catch (error) {
      context.log('AppendSheetRow failed', error);
      if (error.code === 403 || error.status === 403) {
        return {
          status: 403,
          body: 'アクセス拒否: サービスアカウントがスプレッドシートに共有されているか確認してください。',
        };
      }
      if (error.code === 404 || error.status === 404) {
        return { status: 404, body: 'スプレッドシートが見つかりません。spreadsheetId を確認してください。' };
      }
      if (error.message && error.message.includes('credentials')) {
        return { status: 500, body: error.message };
      }
      return { status: 500, body: '行の追加に失敗しました。' };
    }
  },
});
