const { app } = require('@azure/functions');
const ExcelJS = require('exceljs');
const { getSheetValues } = require('./sheetsClient');

const BUYERS_SHEET = 'Buyers list';
const XLD_SHEET = 'Xld';
const COMMISSION_SHEET = 'Comission & Referral';

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

async function buildSheet(workbook, sheetName, values) {
  const ws = workbook.addWorksheet(sheetName);
  if (!values || values.length === 0) return;
  values.forEach((row) => {
    ws.addRow(row);
  });
}

// GET /api/GenerateBuyersExcel
// Called by Power Automate every 5 minutes
// Returns Excel file (.xlsx) with all 3 sheets from Google Sheets
app.http('GenerateBuyersExcel', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (!isAuthorized(request)) {
      return { status: 401, body: 'Unauthorized' };
    }

    try {
      context.log('GenerateBuyersExcel: fetching data from Google Sheets...');

      // Fetch all 3 sheets in parallel
      const [buyersValues, xldValues, commissionValues] = await Promise.all([
        getSheetValues(`'${BUYERS_SHEET}'`),
        getSheetValues(`'${XLD_SHEET}'`),
        getSheetValues(`'${COMMISSION_SHEET}'`),
      ]);

      context.log(
        `GenerateBuyersExcel: Buyers=${buyersValues.length} rows, Xld=${xldValues.length} rows, Commission=${commissionValues.length} rows`,
      );

      // Build Excel workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'LSIRCS App';
      workbook.created = new Date();

      await buildSheet(workbook, BUYERS_SHEET, buyersValues);
      await buildSheet(workbook, XLD_SHEET, xldValues);
      await buildSheet(workbook, COMMISSION_SHEET, commissionValues);

      // Write to buffer
      const buffer = await workbook.xlsx.writeBuffer();

      return {
        status: 200,
        body: Buffer.from(buffer),
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
