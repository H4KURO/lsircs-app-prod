const { app } = require('@azure/functions');
const ExcelJS = require('exceljs');
const path = require('path');
const { ensureNamedContainer } = require('./cosmosClient');

const DEFAULT_CONTAINER = 'ProjectCustomers';
const DEFAULT_PARTITION_KEY = '/projectId';
const DEFAULT_KEY_COLUMNS = (process.env.BOX_IMPORT_KEY_COLUMNS || process.env.BOX_IMPORT_KEY_COLUMN || '2')
  .split(',')
  .map((v) => Number(v.trim()))
  .filter((n) => Number.isFinite(n) && n > 0);
const DEFAULT_HEADER_ROW = Number(process.env.BOX_IMPORT_HEADER_ROW_INDEX || 1);
const DEFAULT_DATA_START_ROW = Number(process.env.BOX_IMPORT_DATA_START_ROW || DEFAULT_HEADER_ROW + 1);

function toStringValue(cell) {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'string') return cell;
  if (typeof cell === 'number' || typeof cell === 'boolean') return String(cell);
  if (cell?.text) return String(cell.text);
  if (cell?.result !== undefined) return String(cell.result);
  return String(cell);
}

function deriveProjectId(blobName) {
  const base = path.basename(blobName);
  const withoutExt = base.replace(/\.[^.]+$/, '');
  const delimiterMatch = withoutExt.match(/^[^_-]+/);
  if (delimiterMatch) {
    return delimiterMatch[0];
  }
  return withoutExt || 'default';
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

function normaliseHeader(value, index) {
  const str = toStringValue(value).trim();
  if (str.length > 0) {
    return str;
  }
  return `col_${index}`;
}

function buildDocument(projectId, headers, row, keyColumns, blobName, fileName) {
  const data = {};
  headers.forEach((header, idx) => {
    const cellValue = toStringValue(row.getCell(idx + 1).value);
    data[header] = cellValue;
  });

  const keyParts = keyColumns.map((colIndex) =>
    toStringValue(row.getCell(colIndex).value).trim(),
  );
  const keyValue = keyParts.filter(Boolean).join('|').trim();
  if (!keyValue) {
    return null;
  }

  return {
    id: `${projectId}:${keyValue}`,
    projectId,
    key: keyValue,
    keyParts,
    rowIndex: row.number,
    data,
    source: {
      blobName,
      fileName,
      keyColumns,
    },
    updatedAt: new Date().toISOString(),
  };
}

async function parseWorkbook(
  buffer,
  projectId,
  blobName,
  fileName,
  overrideKeyColumnIndex,
  { headerRowIndex = DEFAULT_HEADER_ROW, dataStartRow = DEFAULT_DATA_START_ROW } = {},
) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return [];
  }

  const headerRow = worksheet.getRow(headerRowIndex);
  const headers = headerRow.values
    .slice(1)
    .map((value, idx) => normaliseHeader(value, idx + 1));

  const keyColumns = getKeyColumns(overrideKeyColumnIndex);
  const documents = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber < dataStartRow) return;
    const doc = buildDocument(projectId, headers, row, keyColumns, blobName, fileName);
    if (doc) {
      documents.push(doc);
    }
  });

  return documents;
}

async function upsertDocuments(docs) {
  const container = await ensureNamedContainer(DEFAULT_CONTAINER, {
    overrideKeys: ['COSMOS_PROJECT_CUSTOMERS_CONTAINER', 'CosmosProjectCustomersContainer'],
    partitionKey: DEFAULT_PARTITION_KEY,
  });

  if (!Array.isArray(docs) || docs.length === 0) {
    return { processed: 0 };
  }

  let success = 0;
  for (const doc of docs) {
    await container.items.upsert(doc);
    success += 1;
  }
  return { processed: success };
}

  app.http('ImportProjectExcel', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
      try {
        const body = await request.json();
        const base64 = body.fileBase64 || body.fileContentBase64 || body.data;
        if (!base64) {
          return { status: 400, body: 'fileBase64 is required in the request body.' };
        }
        const fileName = body.fileName || body.blobName || 'upload.xlsx';
        const blobName = body.blobName || fileName;
        const projectId = body.projectId || deriveProjectId(blobName);
        const keyColumnIndex = body.keyColumnIndex || body.keyColumns; // backward compatibility
        const headerRowIndex = body.headerRowIndex || DEFAULT_HEADER_ROW;
        const dataStartRow = body.dataStartRow || DEFAULT_DATA_START_ROW;

        const buffer = Buffer.from(base64, 'base64');
        const docs = await parseWorkbook(buffer, projectId, blobName, fileName, keyColumnIndex, {
          headerRowIndex,
          dataStartRow,
        });
        const { processed } = await upsertDocuments(docs);

        context.log(
          `ImportProjectExcel processed ${processed} rows for project ${projectId} from ${blobName}`,
        );
        return {
          status: 200,
          jsonBody: { processed, projectId, fileName, blobName, count: docs.length },
        };
      } catch (error) {
        context.log.error('ImportProjectExcel failed', error);
        return { status: 500, body: 'Failed to import Excel file.' };
      }
    },
  });
