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

function buildManualWeeklyReport(payload = {}, { now = new Date().toISOString() } = {}) {
  const reportDate = normaliseReportDateInput(payload?.reportDate);
  if (!reportDate) {
    throw new Error('reportDate is required and must be in YYYY-MM-DD format.');
  }
  const unit = normaliseText(payload?.unit);
  if (!unit) {
    throw new Error('Unit is required.');
  }

  return {
    id: createDocumentId(reportDate, unit),
    reportDate,
    unit,
    lastRent: parseCurrencyValue(payload?.lastRent),
    scheduledRent: parseCurrencyValue(payload?.scheduledRent),
    newRent: parseCurrencyValue(payload?.newRent),
    lastMoveOut: parseDateValue(payload?.lastMoveOut),
    availableOn: parseDateValue(payload?.availableOn),
    nextMoveIn: parseDateValue(payload?.nextMoveIn),
    showing: normaliseText(payload?.showing),
    inquiry: normaliseText(payload?.inquiry),
    application: normaliseText(payload?.application),
    status: normaliseText(payload?.status),
    onMarketDate: parseDateValue(payload?.onMarketDate),
    memo: normaliseText(payload?.memo),
    taskId: normaliseText(payload?.taskId),
    taskTitle: normaliseText(payload?.taskTitle),
    assigneeUserId: normaliseText(payload?.assigneeUserId),
    assigneeName: normaliseText(payload?.assigneeName),
    sourceFileName: normaliseText(payload?.sourceFileName) || 'manual-entry',
    uploadedAt: now,
    updatedAt: now,
    manuallyAdded: true,
  };
}

function applyWeeklyReportUpdates(existing, updates = {}, { now = new Date().toISOString() } = {}) {
  if (!existing) {
    throw new Error('Weekly leasing report record not found.');
  }

  const next = { ...existing };
  const hasProp = (key) => Object.prototype.hasOwnProperty.call(updates, key);

  const assignCurrency = (key) => {
    if (hasProp(key)) {
      next[key] = parseCurrencyValue(updates[key]);
    }
  };

  const assignDate = (key) => {
    if (hasProp(key)) {
      next[key] = parseDateValue(updates[key]);
    }
  };

  const assignText = (key) => {
    if (hasProp(key)) {
      next[key] = normaliseText(updates[key]);
    }
  };

  assignCurrency('lastRent');
  assignCurrency('scheduledRent');
  assignCurrency('newRent');

  assignDate('lastMoveOut');
  assignDate('availableOn');
  assignDate('nextMoveIn');
  assignDate('onMarketDate');

  assignText('showing');
  assignText('inquiry');
  assignText('application');
  assignText('status');
  assignText('memo');
  assignText('taskId');
  assignText('taskTitle');
  assignText('assigneeUserId');
  assignText('assigneeName');

  next.updatedAt = now;
  return next;
}

module.exports = {
  parseReportDateFromFileName,
  normaliseReportDateInput,
  normaliseText,
  parseCurrencyValue,
  parseDateValue,
  createDocumentId,
  buildManualWeeklyReport,
  applyWeeklyReportUpdates,
};
