const { app } = require('@azure/functions');
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

const ALLOWED_UPDATE_FIELDS = [
  'name', 'developer', 'spreadsheetId', 'sheetName', 'headerRows', 'status',
];

app.http('UpdateProject', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      const payload = await request.json();
      const { id } = payload;
      if (!id) {
        return { status: 400, body: 'Project id is required.' };
      }

      const container = projectsContainer();

      let existingProject;
      try {
        const { resource } = await container.item(id, id).read();
        existingProject = resource;
      } catch (readError) {
        const msg = readError.message || '';
        if (msg.includes('Resource NotFound') || msg.includes('Resource Not Found') || readError.code === 404) {
          return { status: 404, body: 'Project not found.' };
        }
        throw readError;
      }

      if (!existingProject) {
        return { status: 404, body: 'Project not found.' };
      }

      const updates = {};
      for (const field of ALLOWED_UPDATE_FIELDS) {
        if (payload[field] !== undefined) {
          updates[field] = payload[field];
        }
      }

      const now = new Date().toISOString();
      const updatedProject = {
        ...existingProject,
        ...updates,
        updatedAt: now,
        updatedBy: clientPrincipal.userDetails,
      };

      const { resource } = await container.item(id, id).replace(updatedProject);

      return { status: 200, jsonBody: resource };
    } catch (error) {
      const message = error.message || '';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      if (message.includes('Resource NotFound') || message.includes('Resource Not Found')) {
        return { status: 404, body: 'Project not found.' };
      }
      context.log('UpdateProject failed', error);
      return { status: 500, body: 'Error updating project.' };
    }
  },
});
