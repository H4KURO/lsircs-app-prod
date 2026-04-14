const { app } = require('@azure/functions');
const { appendSheetValues } = require('./sheetsClient');

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

// POST /api/CreateBuyer
// Body: { values: [...] }  (array of cell values for the new row)
app.http('CreateBuyer', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      const payload = await request.json();
      if (!Array.isArray(payload.values)) {
        return { status: 400, body: 'values array is required in the request body.' };
      }

      const result = await appendSheetValues(`'${BUYERS_SHEET}'`, [payload.values]);
      context.log(`CreateBuyer: new row appended by ${clientPrincipal.userDetails}`);

      return {
        status: 201,
        jsonBody: {
          message: 'Buyer created successfully.',
          createdBy: clientPrincipal.userDetails,
          result,
        },
      };
    } catch (error) {
      context.log('CreateBuyer failed', error);
      return { status: 500, body: `Error creating buyer: ${error.message}` };
    }
  },
});
