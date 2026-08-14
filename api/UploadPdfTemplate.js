const { app } = require('@azure/functions');
const { PDFDocument } = require('pdf-lib');
const { uploadPdfTemplate } = require('./pdfTemplateStorage');
const { getNamedContainer } = require('./cosmosClient');

const projectsContainer = () => getNamedContainer('Projects', ['COSMOS_PROJECTS_CONTAINER']);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try { return JSON.parse(Buffer.from(header, 'base64').toString('ascii')); } catch { return null; }
}

// POST /api/UploadPdfTemplate
// Body JSON: { projectId, pdfBase64 }
app.http('UploadPdfTemplate', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) return { status: 401, body: 'Unauthorized' };

    try {
      const { projectId, pdfBase64 } = await request.json();
      if (!projectId) return { status: 400, body: 'projectId is required' };
      if (!pdfBase64) return { status: 400, body: 'pdfBase64 is required' };

      const buffer = Buffer.from(pdfBase64, 'base64');

      // フィールド名を取得
      let fieldNames = [];
      try {
        const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
        const form = pdfDoc.getForm();
        fieldNames = form.getFields().map(f => f.getName());
      } catch (e) {
        context.log('PDF field detection failed:', e.message);
      }

      // Blob Storageに保存
      const blobName = await uploadPdfTemplate(projectId, buffer);

      // Cosmos DBのプロジェクトに blobName を記録
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

      const updated = {
        ...project,
        documentSettings: {
          ...(project.documentSettings || {}),
          pdfTemplateBlobName: blobName,
          pdfFieldNames: fieldNames,
        },
      };
      await container.items.upsert(updated);

      return {
        status: 200,
        jsonBody: { fieldNames, blobName },
      };
    } catch (error) {
      context.log('UploadPdfTemplate failed', error);
      return { status: 500, body: `Error: ${error.message}` };
    }
  },
});
