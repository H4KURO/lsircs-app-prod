const { app } = require('@azure/functions');
const { getSheetsClient } = require('./googleSheetsClient');

app.http('DeleteSheetRow', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const { spreadsheetId, sheetTab, rowIndex } = body;

      if (!spreadsheetId) {
        return { status: 400, body: 'spreadsheetId is required.' };
      }
      if (!rowIndex || rowIndex < 2) {
        return { status: 400, body: 'rowIndex must be >= 2 (cannot delete header row).' };
      }

      const sheets = getSheetsClient();

      // Step 1: Get the numeric sheetId for the given tab name
      const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetsData = spreadsheetMeta.data.sheets || [];

      let numericSheetId = 0; // default to first sheet (sheetId=0)
      if (sheetTab) {
        const found = sheetsData.find(
          (s) => s.properties && s.properties.title === sheetTab
        );
        if (found) {
          numericSheetId = found.properties.sheetId;
        } else {
          return {
            status: 404,
            body: `シートタブ "${sheetTab}" が見つかりません。`,
          };
        }
      }

      // Step 2: Delete the row via batchUpdate + deleteDimension
      // startIndex is 0-based; rowIndex is 1-based, so startIndex = rowIndex - 1
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: numericSheetId,
                  dimension: 'ROWS',
                  startIndex: rowIndex - 1,
                  endIndex: rowIndex,
                },
              },
            },
          ],
        },
      });

      return { status: 200, jsonBody: { success: true } };
    } catch (error) {
      context.log('DeleteSheetRow failed', error);
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
      return { status: 500, body: '行の削除に失敗しました。' };
    }
  },
});
