const { app } = require('@azure/functions');
const { getSheetsClient } = require('./googleSheetsClient');

// Convert 0-based column index to A1 letter(s): 0→A, 25→Z, 26→AA, etc.
function colIndexToLetter(index) {
  let letter = '';
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

app.http('UpdateSheetRow', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const { spreadsheetId, sheetTab, rowIndex, values } = body;

      if (!spreadsheetId) {
        return { status: 400, body: 'spreadsheetId is required.' };
      }
      if (!rowIndex || rowIndex < 2) {
        return { status: 400, body: 'rowIndex must be >= 2 (cannot overwrite header row).' };
      }
      if (!Array.isArray(values) || values.length === 0) {
        return { status: 400, body: 'values (array) is required.' };
      }

      const sheets = getSheetsClient();
      const endCol = colIndexToLetter(values.length - 1);
      const sheetPrefix = sheetTab ? `${sheetTab}!` : '';
      const range = `${sheetPrefix}A${rowIndex}:${endCol}${rowIndex}`;

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [values],
        },
      });

      return { status: 200, jsonBody: { success: true } };
    } catch (error) {
      context.log('UpdateSheetRow failed', error);
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
      return { status: 500, body: '行の更新に失敗しました。' };
    }
  },
});
