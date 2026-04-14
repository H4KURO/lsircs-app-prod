const { app } = require('@azure/functions');
const { updateSheetValues } = require('./sheetsClient');

const BUYERS_SHEET = 'Buyers list';
// Data starts at row 4 (header rows 1-3)
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

// PUT /api/UpdateBuyer/{rowIndex}
// rowIndex: 0-based index of the data row (0 = first data row = sheet row 4)
// Body: { values: [...] }  (array of cell values for the entire row)
app.http('UpdateBuyer', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'UpdateBuyer/{rowIndex}',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    const rowIndexStr = request.params.rowIndex;
    const rowIndex = parseInt(rowIndexStr, 10);
    if (isNaN(rowIndex) || rowIndex < 0) {
      return { status: 400, body: 'Invalid rowIndex.' };
    }

    try {
      const payload = await request.json();
      if (!Array.isArray(payload.values)) {
        return { status: 400, body: 'values array is required in the request body.' };
      }

      // Sheet row number = DATA_START_ROW + rowIndex
      const sheetRow = DATA_START_ROW + rowIndex;
      const range = `'${BUYERS_SHEET}'!A${sheetRow}`;

      const result = await updateSheetValues(range, [payload.values]);
      context.log(
        `UpdateBuyer: row ${sheetRow} updated by ${clientPrincipal.userDetails}`,
      );

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
      context.log('UpdateBuyer failed', error);
      return { status: 500, body: `Error updating buyer: ${error.message}` };
    }
  },
});
