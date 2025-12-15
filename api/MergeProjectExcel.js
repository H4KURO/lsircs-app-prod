const { app } = require('@azure/functions');
const ExcelJS = require('exceljs');
const { getNamedContainer } = require('./cosmosClient');

const DEFAULT_HEADER_ROW = Number(process.env.BOX_IMPORT_HEADER_ROW_INDEX || 1);
const DEFAULT_DATA_START_ROW = Number(process.env.BOX_IMPORT_DATA_START_ROW || DEFAULT_HEADER_ROW + 1);
const DEFAULT_KEY_COLUMNS = (process.env.BOX_IMPORT_KEY_COLUMNS || process.env.BOX_IMPORT_KEY_COLUMN || '2')
  .split(',')
  .map((v) => Number(v.trim()))
  .filter((n) => Number.isFinite(n) && n > 0);

const container = () =>
  getNamedContainer('ProjectCustomers', [
    'COSMOS_PROJECT_CUSTOMERS_CONTAINER',
    'CosmosProjectCustomersContainer',
  ]);

function toStringValue(cell) {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'string') return cell;
  if (typeof cell === 'number' || typeof cell === 'boolean') return String(cell);
  if (cell?.text) return String(cell.text);
  if (cell?.result !== undefined) return String(cell.result);
  return String(cell);
}

function normaliseHeader(value, index) {
  const str = toStringValue(value).trim();
  return str.length > 0 ? str : `col_${index}`;
}

async function fetchProjectItems(projectId) {
  const querySpec = {
    query: 'SELECT * FROM c WHERE c.projectId = @projectId',
    parameters: [{ name: '@projectId', value: projectId }],
  };
  const { resources } = await container().items.query(querySpec).fetchAll();
  return Array.isArray(resources) ? resources : [];
}

function buildLookup(items) {
  const map = new Map();
  for (const item of items) {
    if (item?.key) {
      map.set(String(item.key).trim(), item);
    }
  }
  return map;
}

function getKeyColumns(override) {
  if (Array.isArray(override) && override.length > 0) {
    const clean = override.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
    if (clean.length > 0) return clean;
  }
  const env =
    process.env.BOX_IMPORT_KEY_COLUMNS ||
    process.env.BOX_IMPORT_KEY_COLUMN ||
    DEFAULT_KEY_COLUMNS.join(',');
  const parsed = String(env)
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return parsed.length > 0 ? parsed : [2];
}

function getKeyFromRow(row, keyColumns) {
  const parts = keyColumns.map((col) => toStringValue(row.getCell(col).value).trim());
  const key = parts.filter(Boolean).join('|').trim();
  return key;
}

function updateSheetWithData(worksheet, headers, keyColumns, dataStartRow, lookup) {
  let updated = 0;
  const lastRow = worksheet.rowCount;

  for (let rowNumber = dataStartRow; rowNumber <= lastRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const keyValue = getKeyFromRow(row, keyColumns);
    if (!keyValue) continue;
    const match = lookup.get(keyValue);
    if (!match) continue;

    headers.forEach((header, idx) => {
      const nextValue = match.data?.[header] ?? '';
      row.getCell(idx + 1).value = nextValue;
    });
    row.commit();
    updated += 1;
  }

  return updated;
}

app.http('MergeProjectExcel', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const projectId = body?.projectId;
      const fileBase64 = body?.fileBase64 || body?.fileContentBase64;

      if (!projectId) {
        return { status: 400, body: 'projectId is required.' };
      }
      if (!fileBase64) {
        return { status: 400, body: 'fileBase64 is required.' };
      }

      const headerRowIndex = Number(body?.headerRowIndex || DEFAULT_HEADER_ROW);
      const dataStartRow = Number(body?.dataStartRow || DEFAULT_DATA_START_ROW);
      const keyColumns = getKeyColumns(body?.keyColumns || body?.keyColumnIndex);

      const buffer = Buffer.from(fileBase64, 'base64');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];

      if (!worksheet) {
        return { status: 400, body: 'No worksheet found in the provided file.' };
      }

      const headerRow = worksheet.getRow(headerRowIndex);
      const headers = headerRow.values
        .slice(1)
        .map((value, idx) => normaliseHeader(value, idx + 1));

      const items = await fetchProjectItems(projectId);
      const lookup = buildLookup(items);

      const updated = updateSheetWithData(worksheet, headers, keyColumns, dataStartRow, lookup);
      const outBuffer = await workbook.xlsx.writeBuffer();
      const outBase64 = Buffer.from(outBuffer).toString('base64');

      context.log(
        `MergeProjectExcel updated ${updated} rows for project ${projectId} (headers: ${headers.length}).`,
      );

      return {
        status: 200,
        jsonBody: {
          fileBase64: outBase64,
          fileName: body?.fileName || `${projectId}.xlsx`,
          updated,
          projectId,
          headers,
          keyColumns,
        },
      };
    } catch (error) {
      context.log.error('MergeProjectExcel failed', error);
      return { status: 500, body: 'Failed to merge Excel data.' };
    }
  },
});
