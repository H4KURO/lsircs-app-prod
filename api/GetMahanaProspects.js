const { app } = require('@azure/functions');
const { getSheetValues } = require('./sheetsClient');

const SHEET_NAME = 'Mahana Prospects';
const HEADER_ROW_COUNT = 1;

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

// GET /api/GetMahanaProspects
app.http('GetMahanaProspects', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) return { status: 401, body: 'Unauthorized' };

    try {
      const allValues = await getSheetValues(`'${SHEET_NAME}'`);
      if (!allValues || allValues.length === 0) {
        return { status: 200, jsonBody: { headers: [], rows: [] } };
      }

      const headers = allValues.slice(0, HEADER_ROW_COUNT);
      const rows = allValues.slice(HEADER_ROW_COUNT);

      return {
        status: 200,
        jsonBody: { headers, rows, totalRows: rows.length, sheetName: SHEET_NAME },
      };
    } catch (error) {
      context.log('GetMahanaProspects failed', error);
      return { status: 500, body: `Error: ${error.message}` };
    }
  },
});
