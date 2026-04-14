const { app } = require('@azure/functions');
const { SPREADSHEET_ID, exportSpreadsheetAsExcel } = require('./sheetsClient');

const n8nSecretKey = process.env.N8N_SECRET_KEY;

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

function isAuthorized(request) {
  const n8nHeader = request.headers.get('x-n8n-secret-key');
  if (n8nHeader && n8nSecretKey && n8nHeader === n8nSecretKey) return true;
  return !!parseClientPrincipal(request);
}

// GET /api/GenerateBuyersExcel
// Google Drive API経由でスプレッドシートをxlsxエクスポート
// 枠線・色・結合セル・ドロップダウン等の書式がすべて保持される
app.http('GenerateBuyersExcel', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (!isAuthorized(request)) {
      return { status: 401, body: 'Unauthorized' };
    }

    try {
      context.log('GenerateBuyersExcel: exporting from Google Drive...');

      const buffer = await exportSpreadsheetAsExcel(SPREADSHEET_ID);

      context.log(`GenerateBuyersExcel: exported ${buffer.byteLength} bytes`);

      return {
        status: 200,
        body: buffer,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="TPWV_Buyers_List.xlsx"',
          'Content-Length': buffer.byteLength.toString(),
        },
      };
    } catch (error) {
      context.log('GenerateBuyersExcel failed', error);
      return { status: 500, body: `Error generating Excel: ${error.message}` };
    }
  },
});
