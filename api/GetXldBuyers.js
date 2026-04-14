const { app } = require('@azure/functions');
const { getSheetValues } = require('./sheetsClient');

const XLD_SHEET = 'Xld';

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

// GET /api/GetXldBuyers
// Returns all rows from "Xld" sheet (cancelled/rescinded buyers)
app.http('GetXldBuyers', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      const allValues = await getSheetValues(`'${XLD_SHEET}'`);
      if (!allValues || allValues.length === 0) {
        return { status: 200, jsonBody: { headers: [], rows: [] } };
      }

      const headers = allValues.slice(0, 3);
      const rows = allValues.slice(3);

      return {
        status: 200,
        jsonBody: {
          headers,
          rows,
          totalRows: rows.length,
          sheetName: XLD_SHEET,
        },
      };
    } catch (error) {
      context.log('GetXldBuyers failed', error);
      return { status: 500, body: `Error fetching Xld buyers: ${error.message}` };
    }
  },
});
