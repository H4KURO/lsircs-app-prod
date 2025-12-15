const { app } = require('@azure/functions');
const ExcelJS = require('exceljs');
const { getNamedContainer } = require('./cosmosClient');

const container = () =>
  getNamedContainer('ProjectCustomers', [
    'COSMOS_PROJECT_CUSTOMERS_CONTAINER',
    'CosmosProjectCustomersContainer',
  ]);

function buildHeaders(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }
  const ordered = [];
  const seen = new Set();
  for (const item of items) {
    const keys = Object.keys(item.data || {});
    for (const key of keys) {
      if (!seen.has(key)) {
        seen.add(key);
        ordered.push(key);
      }
    }
  }
  return ordered;
}

function addRowsToSheet(worksheet, headers, items) {
  worksheet.addRow(headers);
  for (const item of items) {
    const rowValues = headers.map((key) => item.data?.[key] ?? '');
    worksheet.addRow(rowValues);
  }
  worksheet.columns.forEach((col) => {
    col.width = Math.max(col.header?.length || 10, 15);
  });
}

async function fetchProjectItems(projectId) {
  const querySpec = {
    query: 'SELECT * FROM c WHERE c.projectId = @projectId ORDER BY c.rowIndex',
    parameters: [{ name: '@projectId', value: projectId }],
  };
  const { resources } = await container().items.query(querySpec).fetchAll();
  return Array.isArray(resources) ? resources : [];
}

app.http('ExportProjectExcel', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const projectId = request.query.get('projectId');
      if (!projectId) {
        return { status: 400, body: 'projectId is required' };
      }

      const items = await fetchProjectItems(projectId);
      if (items.length === 0) {
        return { status: 200, jsonBody: { fileBase64: '', fileName: `${projectId}.xlsx` } };
      }

      const headers = buildHeaders(items);
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(projectId);
      addRowsToSheet(sheet, headers, items);

      const buffer = await workbook.xlsx.writeBuffer();
      const fileBase64 = buffer.toString('base64');
      const fileName = `${projectId}.xlsx`;

      return {
        status: 200,
        jsonBody: {
          fileBase64,
          fileName,
          count: items.length,
          headers,
        },
      };
    } catch (error) {
      context.log.error('ExportProjectExcel failed', error);
      return { status: 500, body: 'Failed to export project Excel.' };
    }
  },
});
