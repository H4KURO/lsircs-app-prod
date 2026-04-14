const { app } = require('@azure/functions');
const { updateSheetValues } = require('./sheetsClient');

const XLD_SHEET = 'Xld';
const DATA_START_ROW = 4;

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

// PUT /api/UpdateXldBuyer/{rowIndex}
app.http('UpdateXldBuyer', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'UpdateXldBuyer/{rowIndex}',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    const rowIndex = parseInt(request.params.rowIndex, 10);
    if (isNaN(rowIndex) || rowIndex < 0) {
      return { status: 400, body: 'Invalid rowIndex.' };
    }

    try {
      const payload = await request.json();
      if (!Array.isArray(payload.values)) {
        return { status: 400, body: 'values array is required.' };
      }

      const sheetRow = DATA_START_ROW + rowIndex;
      const range = `'${XLD_SHEET}'!A${sheetRow}`;
      const result = await updateSheetValues(range, [payload.values]);

      return {
        status: 200,
        jsonBody: {
          updatedRow: sheetRow,
          rowIndex,
          updatedBy: clientPrincipal.userDetails,
          result,
        },
      };
    } catch (error) {
      context.log('UpdateXldBuyer failed', error);
      return { status: 500, body: `Error updating Xld buyer: ${error.message}` };
    }
  },
});
