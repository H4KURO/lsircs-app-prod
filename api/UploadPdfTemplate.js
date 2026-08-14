const { app } = require('@azure/functions');
const { PDFDocument } = require('pdf-lib');
const { v4: uuidv4 } = require('uuid');
const { uploadPdfTemplate } = require('./pdfTemplateStorage');
const { getNamedContainer } = require('./cosmosClient');

const projectsContainer = () => getNamedContainer('Projects', ['COSMOS_PROJECTS_CONTAINER']);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try { return JSON.parse(Buffer.from(header, 'base64').toString('ascii')); } catch { return null; }
}

// POST /api/UploadPdfTemplate
// Body JSON: { projectId, templateName, pdfBase64, templateId? }
// templateId が指定された場合は既存テンプレートを上書き
app.http('UploadPdfTemplate', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) return { status: 401, body: 'Unauthorized' };

    try {
      const { projectId, templateName, pdfBase64, templateId: existingId } = await request.json();
      if (!projectId)    return { status: 400, body: 'projectId is required' };
      if (!pdfBase64)    return { status: 400, body: 'pdfBase64 is required' };
      if (!templateName) return { status: 400, body: 'templateName is required' };

      const buffer = Buffer.from(pdfBase64, 'base64');

      // AcroFormフィールド名を検出
      let fieldNames = [];
      try {
        const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
        fieldNames = pdfDoc.getForm().getFields().map(f => f.getName());
      } catch (e) {
        context.log('PDF field detection failed:', e.message);
      }

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
      const templates = Array.isArray(ds.pdfTemplates) ? [...ds.pdfTemplates] : [];

      const templateId = existingId || uuidv4();
      const blobName = await uploadPdfTemplate(projectId, templateId, buffer);

      const idx = templates.findIndex(t => t.id === templateId);
      const entry = {
        id: templateId,
        name: templateName,
        blobName,
        fieldNames,
        fieldMapping: idx >= 0 ? (templates[idx].fieldMapping || {}) : {},
      };

      if (idx >= 0) {
        templates[idx] = entry;
      } else {
        templates.push(entry);
      }

      const updated = { ...project, documentSettings: { ...ds, pdfTemplates: templates } };
      await container.items.upsert(updated);

      return {
        status: 200,
        jsonBody: { templateId, fieldNames, blobName },
      };
    } catch (error) {
      context.log('UploadPdfTemplate failed', error);
      return { status: 500, body: `Error: ${error.message}` };
    }
  },
});
