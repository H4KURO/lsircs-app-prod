const { app } = require('@azure/functions');
const { getSheetColumnNames } = require('./sheetsClient');

const BUYERS_SHEET = 'Buyers list';

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try { return JSON.parse(Buffer.from(header, 'base64').toString('ascii')); } catch { return null; }
}

// GET /api/GetBuyerListColumns
// Returns [{ letter: 'A', name: 'Buyer Name' }, ...] from Buyers List header rows
app.http('GetBuyerListColumns', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) return { status: 401, body: 'Unauthorized' };
    try {
      const columns = await getSheetColumnNames(BUYERS_SHEET);
      return { status: 200, jsonBody: columns };
    } catch (error) {
      context.log('GetBuyerListColumns failed', error);
      return { status: 500, body: `Error: ${error.message}` };
    }
  },
});
