const { app } = require('@azure/functions');
const ExcelJS = require('exceljs');
const path = require('path');
const { ensureNamedContainer } = require('./cosmosClient');

const DEFAULT_CONTAINER = 'ProjectCustomers';
const DEFAULT_PARTITION_KEY = '/projectId';
const DEFAULT_KEY_COLUMN = Number(process.env.BOX_IMPORT_KEY_COLUMN || 2);
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

function getKeyColumnIndex(overrideIndex) {
  const parsed = Number(overrideIndex ?? process.env.BOX_IMPORT_KEY_COLUMN ?? DEFAULT_KEY_COLUMN);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_KEY_COLUMN;
  }
  return parsed;
}

function normaliseHeader(value, index) {
  const str = toStringValue(value).trim();
  if (str.length > 0) {
    return str;
  }
  return `col_${index}`;
}

function buildDocument(projectId, headers, row, keyColumnIndex, blobName, fileName) {
  const data = {};
  headers.forEach((header, idx) => {
    const cellValue = toStringValue(row.getCell(idx + 1).value);
    data[header] = cellValue;
  });

  const keyValue = toStringValue(row.getCell(keyColumnIndex).value).trim();
  if (!keyValue) {
    return null;
  }

  return {
    id: `${projectId}:${keyValue}`,
    projectId,
    key: keyValue,
    rowIndex: row.number,
    data,
    source: {
      blobName,
      fileName,
      keyColumnIndex,
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

  const keyColumnIndex = getKeyColumnIndex(overrideKeyColumnIndex);
  const documents = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber < dataStartRow) return;
    const doc = buildDocument(projectId, headers, row, keyColumnIndex, blobName, fileName);
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
        const keyColumnIndex = body.keyColumnIndex;
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
