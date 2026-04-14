const { app } = require('@azure/functions');
const { updateSheetValues, getSheetDataRow } = require('./sheetsClient');

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
      const { sheetName, rowIndex, column, value } = payload;

      if (!sheetName || rowIndex == null || !column) {
        return { status: 400, body: 'sheetName, rowIndex, column are required.' };
      }

      const col = String(column).toUpperCase();
      const sheetRow = getSheetDataRow(sheetName, rowIndex);
      const range = `'${sheetName}'!${col}${sheetRow}`;

      await updateSheetValues(range, [[value ?? '']]);

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
