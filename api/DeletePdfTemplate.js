const { app } = require('@azure/functions');
const { deletePdfTemplateBlob } = require('./pdfTemplateStorage');
const { getNamedContainer } = require('./cosmosClient');

const projectsContainer = () => getNamedContainer('Projects', ['COSMOS_PROJECTS_CONTAINER']);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try { return JSON.parse(Buffer.from(header, 'base64').toString('ascii')); } catch { return null; }
}

// POST /api/DeletePdfTemplate
// Body JSON: { projectId, templateId }
app.http('DeletePdfTemplate', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) return { status: 401, body: 'Unauthorized' };

    try {
      const { projectId, templateId } = await request.json();
      if (!projectId)  return { status: 400, body: 'projectId is required' };
      if (!templateId) return { status: 400, body: 'templateId is required' };

      const container = projectsContainer();
      let project;
      try {
        const { resource } = await container.item(projectId, projectId).read();
        project = resource;
      } catch (e) {
        if (e.code === 404 || (e.message || '').includes('NotFound'))
          return { status: 404, body: 'Project not found' };
        throw e;
      }
      if (!project) return { status: 404, body: 'Project not found' };

      const ds = project.documentSettings || {};
      const templates = Array.isArray(ds.pdfTemplates) ? ds.pdfTemplates : [];
      const target = templates.find(t => t.id === templateId);

      if (target?.blobName) {
        await deletePdfTemplateBlob(target.blobName).catch(() => {});
      }

      const updated = {
        ...project,
        documentSettings: {
          ...ds,
          pdfTemplates: templates.filter(t => t.id !== templateId),
        },
      };
      await container.items.upsert(updated);

      return { status: 200, jsonBody: { ok: true } };
    } catch (error) {
      context.log('DeletePdfTemplate failed', error);
      return { status: 500, body: `Error: ${error.message}` };
    }
  },
});
