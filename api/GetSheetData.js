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

app.http('GetSheetData', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const spreadsheetId = request.query.get('spreadsheetId');
      const sheetTab = request.query.get('sheetTab') || '';

      if (!spreadsheetId) {
        return { status: 400, body: 'spreadsheetId is required.' };
      }

      const sheets = getSheetsClient();
      const range = sheetTab ? `${sheetTab}` : 'A:ZZ';

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const allRows = response.data.values || [];
      if (allRows.length === 0) {
        return { status: 200, jsonBody: { headers: [], rows: [] } };
      }

      const headers = allRows[0];
      const dataRows = allRows.slice(1);

      // _rowIndex is 1-based (header = row 1, data starts at row 2)
      const rows = dataRows.map((row, i) => {
        const obj = { _rowIndex: i + 2 };
        headers.forEach((header, colIdx) => {
          obj[header] = row[colIdx] !== undefined ? row[colIdx] : '';
        });
        return obj;
      });

      return {
        status: 200,
        jsonBody: {
          headers,
          rows,
          endCol: colIndexToLetter(headers.length - 1),
        },
      };
    } catch (error) {
      context.log('GetSheetData failed', error);
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
      return { status: 500, body: `シートデータの取得に失敗しました: ${error.message || error.toString()}` };
    }
  },
});
