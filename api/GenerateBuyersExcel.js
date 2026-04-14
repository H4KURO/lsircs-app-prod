const { app } = require('@azure/functions');
const ExcelJS = require('exceljs');
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

// Drive APIのエクスポートバッファに全シートの保護を追加する
async function addSheetProtection(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  workbook.worksheets.forEach((ws) => {
    ws.protect(undefined, {
      sheet: true,
      selectLockedCells: true,   // セル選択は許可（閲覧・コピー用）
      selectUnlockedCells: false,
      formatCells: false,
      formatColumns: false,
      formatRows: false,
      insertRows: false,
      insertColumns: false,
      deleteRows: false,
      deleteColumns: false,
      sort: false,
      autoFilter: false,
    });
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// GET /api/GenerateBuyersExcel
// Google Drive API経由でxlsxエクスポート後、全シートを読み取り専用保護して返す
app.http('GenerateBuyersExcel', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (!isAuthorized(request)) {
      return { status: 401, body: 'Unauthorized' };
    }

    try {
      context.log('GenerateBuyersExcel: exporting from Google Drive...');
      const rawBuffer = await exportSpreadsheetAsExcel(SPREADSHEET_ID);
      context.log(`GenerateBuyersExcel: exported ${rawBuffer.byteLength} bytes, adding sheet protection...`);

      const protectedBuffer = await addSheetProtection(rawBuffer);
      context.log(`GenerateBuyersExcel: protected file size ${protectedBuffer.byteLength} bytes`);

      return {
        status: 200,
        body: protectedBuffer,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="TPWV_Buyers_List.xlsx"',
          'Content-Length': protectedBuffer.byteLength.toString(),
        },
      };
    } catch (error) {
      context.log('GenerateBuyersExcel failed', error);
      return { status: 500, body: `Error generating Excel: ${error.message}` };
    }
  },
});
