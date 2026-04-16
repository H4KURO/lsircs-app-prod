const { app } = require('@azure/functions');
const { updateSheetValues, getSheetDataRow } = require('./sheetsClient');

const SHEET_NAME = 'Mahana Prospects';

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

// POST /api/UpdateMahanaProspect
// Body: { rowIndex: number (0始まり), values: any[] }
app.http('UpdateMahanaProspect', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) return { status: 401, body: 'Unauthorized' };

    try {
      const { rowIndex, values } = await request.json();
      if (rowIndex == null || !Array.isArray(values)) {
        return { status: 400, body: 'rowIndex and values are required.' };
      }

      const sheetRow = getSheetDataRow(SHEET_NAME, rowIndex);
      const range = `'${SHEET_NAME}'!A${sheetRow}`;
      await updateSheetValues(range, [values]);

      context.log(`UpdateMahanaProspect: row ${sheetRow} updated by ${clientPrincipal.userDetails}`);
      return { status: 200, jsonBody: { sheetRow } };
    } catch (error) {
      context.log('UpdateMahanaProspect failed', error);
      return { status: 500, body: `Error: ${error.message}` };
    }
  },
});
