const { app } = require('@azure/functions');
const { getSheetValues, getSheetValuesById } = require('./sheetsClient');
const { getNamedContainer } = require('./cosmosClient');

const DEFAULT_SHEET = 'Buyers list';
const DEFAULT_HEADER_ROWS = 3;

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

app.http('GetBuyers', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      const url = new URL(request.url);
      const projectId = url.searchParams.get('projectId');

      let sheetName = DEFAULT_SHEET;
      let spreadsheetId = null;
      let headerRows = DEFAULT_HEADER_ROWS;
      let projectName = null;

      if (projectId) {
        const container = projectsContainer();
        let project;
        try {
          const { resource } = await container.item(projectId, projectId).read();
          project = resource;
        } catch (readErr) {
          const msg = readErr.message || '';
          if (msg.includes('Resource NotFound') || msg.includes('Resource Not Found') || readErr.code === 404) {
            return { status: 404, body: 'Project not found.' };
          }
          throw readErr;
        }
        if (!project) return { status: 404, body: 'Project not found.' };
        sheetName = project.sheetName;
        spreadsheetId = project.spreadsheetId;
        headerRows = project.headerRows ?? DEFAULT_HEADER_ROWS;
        projectName = project.name;
      }

      const range = `'${sheetName}'`;
      const allValues = spreadsheetId
        ? await getSheetValuesById(spreadsheetId, range)
        : await getSheetValues(range);

      if (!allValues || allValues.length === 0) {
        return {
          status: 200,
          jsonBody: { headers: [], rows: [], totalRows: 0, sheetName, projectName },
        };
      }

      const headers = allValues.slice(0, headerRows);
      const rows = allValues.slice(headerRows);

      return {
        status: 200,
        jsonBody: { headers, rows, totalRows: rows.length, sheetName, projectName },
      };
    } catch (error) {
      context.log('GetBuyers failed', error);
      return { status: 500, body: `Error fetching buyers: ${error.message}` };
    }
  },
});
