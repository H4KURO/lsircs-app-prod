const { app } = require('@azure/functions');
const { getSheetValues, getSheetValuesById } = require('./sheetsClient');
const { getNamedContainer } = require('./cosmosClient');

const COMMISSION_SHEET = 'Comission & Referral';
const HEADER_ROWS = 1;

const projectsContainer = () =>
  getNamedContainer('Projects', ['COSMOS_PROJECTS_CONTAINER']);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

// GET /api/GetCommissions[?projectId=xxx]
app.http('GetCommissions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) return { status: 401, body: 'Unauthorized' };

    try {
      const url = new URL(request.url);
      const projectId = url.searchParams.get('projectId');

      let spreadsheetId = null;

      if (projectId) {
        const container = projectsContainer();
        let project;
        try {
          const { resource } = await container.item(projectId, projectId).read();
          project = resource;
        } catch (e) {
          if (e.code === 404 || (e.message || '').includes('NotFound')) return { status: 404, body: 'Project not found' };
          throw e;
        }
        if (!project) return { status: 404, body: 'Project not found' };
        spreadsheetId = project.spreadsheetId;
      }

      const range = `'${COMMISSION_SHEET}'`;
      const allValues = spreadsheetId
        ? await getSheetValuesById(spreadsheetId, range)
        : await getSheetValues(range);

      if (!allValues || allValues.length === 0) {
        return { status: 200, jsonBody: { headers: [], rows: [], totalRows: 0, sheetName: COMMISSION_SHEET } };
      }

      return {
        status: 200,
        jsonBody: {
          headers: allValues.slice(0, HEADER_ROWS),
          rows: allValues.slice(HEADER_ROWS),
          totalRows: allValues.length - HEADER_ROWS,
          sheetName: COMMISSION_SHEET,
        },
      };
    } catch (error) {
      context.log('GetCommissions failed', error);
      return { status: 500, body: `Error fetching commissions: ${error.message}` };
    }
  },
});
