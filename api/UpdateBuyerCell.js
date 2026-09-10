const { app } = require('@azure/functions');
const { updateSheetValues, updateSheetValuesById, getSheetDataRow, resolveColumnLetter, resolveColumnLetterById } = require('./sheetsClient');

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

// POST /api/UpdateBuyerCell
// タスクのサブタスクをチェック/解除したとき、対応するSheetsセルを更新する
// Body: { sheetName, rowIndex, column, value }
//   sheetName: "Buyers list" | "Xld" | "Comission & Referral"
//   rowIndex: 0始まりのデータ行インデックス
//   column: 列記号（例: "EH"）
//   value: 書き込む値（完了時: "〇", 解除時: ""）
app.http('UpdateBuyerCell', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) return { status: 401, body: 'Unauthorized' };

    try {
      const payload = await request.json();
      const { sheetName, rowIndex, column, value, spreadsheetId, sheetName: syncSheetName, headerRows } = payload;

      if (!sheetName || rowIndex == null || (!column && !payload.columnName)) {
        return { status: 400, body: 'sheetName, rowIndex, column are required.' };
      }

      const customSpreadsheetId = spreadsheetId || null;
      const customSheetName = syncSheetName || 'Buyers list';
      const customHeaderRows = headerRows ?? 3;

      let col = column ? String(column).toUpperCase() : null;
      if (!col && payload.columnName) {
        col = customSpreadsheetId
          ? await resolveColumnLetterById(customSpreadsheetId, customSheetName, customHeaderRows, payload.columnName)
          : await resolveColumnLetter(sheetName || 'Buyers list', payload.columnName);
      }
      if (!col) return { status: 400, body: 'column or columnName is required.' };
      const sheetRow = getSheetDataRow(sheetName, rowIndex);
      const range = `'${sheetName}'!${col}${sheetRow}`;

      if (customSpreadsheetId) {
        await updateSheetValuesById(customSpreadsheetId, range, [[value ?? '']]);
      } else {
        await updateSheetValues(range, [[value ?? '']]);
      }

      context.log(
        `UpdateBuyerCell: ${range} = "${value}" by ${clientPrincipal.userDetails}`,
      );

      return { status: 200, jsonBody: { range, value } };
    } catch (error) {
      context.log('UpdateBuyerCell failed', error);
      return { status: 500, body: `Error: ${error.message}` };
    }
  },
});
