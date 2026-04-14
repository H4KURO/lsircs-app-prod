const { app } = require('@azure/functions');
const { getSheetValues } = require('./sheetsClient');

// Sheet name for Buyers list (active)
const BUYERS_SHEET = 'Buyers list';

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

// GET /api/GetBuyers
// Returns all rows from "Buyers list" sheet as { headers: [[...],[...],[...]], rows: [[...], ...] }
// headers = first 3 rows (3-level merged header)
// rows = data rows starting from row 4
app.http('GetBuyers', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      const allValues = await getSheetValues(`'${BUYERS_SHEET}'`);
      if (!allValues || allValues.length === 0) {
        return { status: 200, jsonBody: { headers: [], rows: [] } };
      }

      // First 3 rows are header rows (3-level merged header)
      const headers = allValues.slice(0, 3);
      // Data rows start from row 4 (index 3)
      const rows = allValues.slice(3);

      return {
        status: 200,
        jsonBody: {
          headers,
          rows,
          totalRows: rows.length,
          sheetName: BUYERS_SHEET,
        },
      };
    } catch (error) {
      context.log('GetBuyers failed', error);
      return { status: 500, body: `Error fetching buyers: ${error.message}` };
    }
  },
});
