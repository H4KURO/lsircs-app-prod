const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { getNamedContainer } = require('./cosmosClient');

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

app.http('CreateProject', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      const payload = await request.json();

      const name = payload?.name?.trim();
      if (!name) {
        return { status: 400, body: 'Project name is required.' };
      }

      const spreadsheetId = payload?.spreadsheetId?.trim();
      if (!spreadsheetId) {
        return { status: 400, body: 'spreadsheetId is required.' };
      }

      const sheetName = payload?.sheetName?.trim();
      if (!sheetName) {
        return { status: 400, body: 'sheetName is required.' };
      }

      const container = projectsContainer();
      const now = new Date().toISOString();

      const project = {
        id: uuidv4(),
        name,
        developer: payload.developer ?? '',
        spreadsheetId,
        sheetName,
        headerRows: payload.headerRows ?? 3,
        status: payload.status ?? 'active',
        createdAt: now,
        updatedAt: now,
        createdBy: clientPrincipal.userDetails,
        updatedBy: null,
      };

      const { resource } = await container.items.create(project);

      return { status: 201, jsonBody: resource };
    } catch (error) {
      const message = error.message || '';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      if (message.includes('Resource NotFound')) {
        return { status: 404, body: 'Projects container not found in Cosmos DB.' };
      }
      context.log('CreateProject failed', error);
      return { status: 500, body: 'Error creating project.' };
    }
  },
});
