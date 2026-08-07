const { app } = require('@azure/functions');
const { getSheetColumnNames, getSheetValuesById, indexToColumnLetter } = require('./sheetsClient');
const { getNamedContainer } = require('./cosmosClient');

const BUYERS_SHEET = 'Buyers list';
const DEFAULT_HEADER_ROWS = 3;

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try { return JSON.parse(Buffer.from(header, 'base64').toString('ascii')); } catch { return null; }
}

const projectsContainer = () =>
  getNamedContainer('Projects', ['COSMOS_PROJECTS_CONTAINER']);

// Build column list from raw sheet values (same logic as getSheetColumnNames in sheetsClient)
function buildColumnList(headerValues) {
  if (!headerValues || headerValues.length === 0) return [];
  const maxCols = Math.max(...headerValues.map(r => r?.length ?? 0));
  const result = [];
  for (let col = 0; col < maxCols; col++) {
    const parts = headerValues
      .map(row => (row?.[col] != null && row[col] !== '' ? String(row[col]).trim() : null))
      .filter(Boolean);
    const unique = [...new Set(parts)];
    result.push({ letter: indexToColumnLetter(col), name: unique.join(' / ') || `列${col + 1}` });
  }
  return result;
}

// GET /api/GetBuyerListColumns[?projectId=xxx]
// Returns [{ letter: 'A', name: '...' }, ...] from BL header rows
app.http('GetBuyerListColumns', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) return { status: 401, body: 'Unauthorized' };
    try {
      const url = new URL(request.url);
      const projectId = url.searchParams.get('projectId');

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

        const sheetName = project.sheetName || BUYERS_SHEET;
        const headerRows = project.headerRows ?? DEFAULT_HEADER_ROWS;
        const allValues = await getSheetValuesById(project.spreadsheetId, `'${sheetName}'!1:${headerRows}`);
        const columns = buildColumnList(allValues);
        return { status: 200, jsonBody: columns };
      }

      // Default: use the default spreadsheet
      const columns = await getSheetColumnNames(BUYERS_SHEET);
      return { status: 200, jsonBody: columns };
    } catch (error) {
      context.log('GetBuyerListColumns failed', error);
      return { status: 500, body: `Error: ${error.message}` };
    }
  },
});
