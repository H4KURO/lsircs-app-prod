const { app } = require('@azure/functions');
const { getSheetValues } = require('./sheetsClient');

const COMMISSION_SHEET = 'Comission & Referral';

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

// GET /api/GetCommissions
// Returns all rows from "Comission & Referral" sheet
app.http('GetCommissions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      const allValues = await getSheetValues(`'${COMMISSION_SHEET}'`);
      if (!allValues || allValues.length === 0) {
        return { status: 200, jsonBody: { headers: [], rows: [] } };
      }

      // Commission sheet has 1 header row (13 columns, simpler structure)
      const headers = allValues.slice(0, 1);
      const rows = allValues.slice(1);

      return {
        status: 200,
        jsonBody: {
          headers,
          rows,
          totalRows: rows.length,
          sheetName: COMMISSION_SHEET,
        },
      };
    } catch (error) {
      context.log('GetCommissions failed', error);
      return { status: 500, body: `Error fetching commissions: ${error.message}` };
    }
  },
});
