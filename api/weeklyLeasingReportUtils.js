const crypto = require('crypto');

const REPORT_FILE_REGEX = /^unit_vacancy_detail-(\d{8})(?:\.[A-Za-z0-9]+)?$/i;

function toIsoDateFromDigits(digits) {
  if (!/^\d{8}$/.test(digits)) {
    return null;
  }
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  return `${year}-${month}-${day}`;
}

function parseReportDateFromFileName(fileName) {
  if (typeof fileName !== 'string') {
    return null;
  }
  const match = fileName.match(REPORT_FILE_REGEX);
  if (!match) {
    return null;
  }
  return toIsoDateFromDigits(match[1]);
}

function normaliseReportDateInput(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^\d{8}$/.test(trimmed)) {
    return toIsoDateFromDigits(trimmed);
  }
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, '0');
    const day = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    return `${year}-${month}-${day}`;
  }
  return null;
}

function normaliseText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseCurrencyValue(value) {
  if (value == null) {
    return null;
  }
  const stringValue = String(value).replace(/[^\d.\-]/g, '').trim();
  if (!stringValue) {
    return null;
  }
  const parsed = Number(stringValue);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateValue(value) {
  if (value == null) {
    return '';
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, '0');
    const day = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    return `${year}-${month}-${day}`;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return parsed.toISOString().slice(0, 10);
}

function createDocumentId(reportDate, unit) {
  const hash = crypto.createHash('sha256').update(`${reportDate}:${unit}`, 'utf8').digest('hex');
  return `${reportDate}:${hash}`;
}

module.exports = {
  parseReportDateFromFileName,
  normaliseReportDateInput,
  normaliseText,
  parseCurrencyValue,
  parseDateValue,
  createDocumentId,
};
