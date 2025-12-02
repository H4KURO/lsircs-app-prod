const { app } = require('@azure/functions');
const { parse } = require('csv-parse/sync');
const { weeklyLeasingReportContainer } = require('./weeklyLeasingReportStore');
const {
  parseReportDateFromFileName,
  normaliseReportDateInput,
  normaliseText,
  parseCurrencyValue,
  parseDateValue,
  createDocumentId,
} = require('./weeklyLeasingReportUtils');

const COLUMN_ALIASES = {
  unit: ['unit'],
  lastRent: ['lastrent', 'lastrentamount'],
  scheduledRent: ['scheduledrent'],
  newRent: ['newrent'],
  lastMoveOut: ['lastmoveout', 'lastmoveoutdate', 'lastmoveoutavailableon'],
  availableOn: ['availableon'],
  nextMoveIn: ['nextmovein', 'nextmoveindate'],
  showing: ['showing', 'showings'],
  inquiry: ['inquiry', 'inquiries'],
  application: ['application', 'applications'],
  status: ['status'],
  onMarketDate: ['onmarketdate', 'marketdate'],
  memo: ['memo'],
};

function detectDelimiter(csvText = '') {
  const firstLine = csvText.split(/\r?\n/, 1)[0] || '';
  return firstLine.includes('\t') ? '\t' : ',';
}

function normaliseRowKeys(row = {}) {
  const normalised = {};
  Object.entries(row).forEach(([key, value]) => {
    const targetKey = (key || '')
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    normalised[targetKey] = value;
  });
  return normalised;
}

function getValue(row, aliases = []) {
  for (const key of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      return row[key];
    }
  }
  return undefined;
}

function buildDocument(row, { reportDate, fileName, now }) {
  const unit = normaliseText(getValue(row, COLUMN_ALIASES.unit));
  if (!unit) {
    const hasContent = Object.values(row).some((value) => normaliseText(value));
    if (hasContent) {
      return { error: 'Unit value is required.' };
    }
    return { skip: true };
  }

  return {
    id: createDocumentId(reportDate, unit),
    reportDate,
    unit,
    lastRent: parseCurrencyValue(getValue(row, COLUMN_ALIASES.lastRent)),
    scheduledRent: parseCurrencyValue(getValue(row, COLUMN_ALIASES.scheduledRent)),
    newRent: parseCurrencyValue(getValue(row, COLUMN_ALIASES.newRent)),
    lastMoveOut: parseDateValue(getValue(row, COLUMN_ALIASES.lastMoveOut)),
    availableOn: parseDateValue(getValue(row, COLUMN_ALIASES.availableOn)),
    nextMoveIn: parseDateValue(getValue(row, COLUMN_ALIASES.nextMoveIn)),
    showing: normaliseText(getValue(row, COLUMN_ALIASES.showing)),
    inquiry: normaliseText(getValue(row, COLUMN_ALIASES.inquiry)),
    application: normaliseText(getValue(row, COLUMN_ALIASES.application)),
    status: normaliseText(getValue(row, COLUMN_ALIASES.status)),
    onMarketDate: parseDateValue(getValue(row, COLUMN_ALIASES.onMarketDate)),
    memo: normaliseText(getValue(row, COLUMN_ALIASES.memo)),
    sourceFileName: fileName,
    uploadedAt: now,
    updatedAt: now,
  };
}

function parseCsvContent(csvBuffer) {
  const csvText = csvBuffer.toString('utf8').replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(csvText);
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter,
  });
  return records;
}

app.http('UploadWeeklyLeasingReport', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      if (typeof request.formData !== 'function') {
        return { status: 400, jsonBody: { message: 'Multipart form uploads are not supported in this environment.' } };
      }

      const formData = await request.formData();
      const file = formData.get('file');
      if (!file || typeof file === 'string') {
        return { status: 400, jsonBody: { message: 'CSV file is required.' } };
      }

      const fileName = file.name || normaliseText(formData.get('fileName')) || 'report.csv';
      let reportDate = parseReportDateFromFileName(fileName);
      if (!reportDate) {
        reportDate = normaliseReportDateInput(formData.get('reportDate'));
      }
      if (!reportDate) {
        return {
          status: 400,
          jsonBody: {
            message: 'The file name must follow "unit_vacancy_detail-YYYYMMDD". Provide "reportDate" if this pattern is unavailable.',
          },
        };
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      if (!buffer.length) {
        return { status: 400, jsonBody: { message: 'The uploaded file is empty.' } };
      }

      const records = parseCsvContent(buffer);
      if (!records.length) {
        return { status: 400, jsonBody: { message: 'No records were detected in the CSV file.' } };
      }

      const container = await weeklyLeasingReportContainer();
      const now = new Date().toISOString();

      let processedCount = 0;
      const rowErrors = [];
      const upsertOperations = [];

      records.forEach((record, index) => {
        const rowNumber = index + 2; // account for header row
        const document = buildDocument(normaliseRowKeys(record), { reportDate, fileName, now });
        if (document.skip) {
          return;
        }
        if (document.error) {
          rowErrors.push({ rowNumber, message: document.error });
          return;
        }
        processedCount += 1;
        upsertOperations.push(container.items.upsert(document));
      });

      if (upsertOperations.length > 0) {
        await Promise.all(upsertOperations);
      }

      return {
        status: 201,
        jsonBody: {
          message: 'Weekly leasing report processed.',
          reportDate,
          processedCount,
          ignoredCount: rowErrors.length,
          errors: rowErrors,
        },
      };
    } catch (error) {
      context.log('UploadWeeklyLeasingReport failed', error);
      const message = error?.message || 'Failed to process the weekly report.';
      return { status: 500, jsonBody: { message } };
    }
  },
});
