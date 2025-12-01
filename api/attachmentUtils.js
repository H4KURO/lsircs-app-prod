const { v4: uuidv4 } = require('uuid');

const DEFAULT_MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8MB
const DEFAULT_MAX_ATTACHMENT_COUNT = 10;

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

const MAX_ATTACHMENT_BYTES = parsePositiveInteger(
  process.env.MANAGED_PROPERTY_MAX_PHOTO_BYTES,
  DEFAULT_MAX_ATTACHMENT_BYTES,
);
const MAX_ATTACHMENT_COUNT = parsePositiveInteger(
  process.env.MANAGED_PROPERTY_MAX_PHOTOS,
  DEFAULT_MAX_ATTACHMENT_COUNT,
);

function validationError(message, code = 'ValidationError') {
  const error = new Error(message);
  error.code = code;
  return error;
}

function toTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function requireNonEmpty(value, message) {
  const result = toTrimmedString(value);
  if (!result) {
    throw validationError(message);
  }
  return result;
}

function estimateDataUrlBytes(dataUrl) {
  if (typeof dataUrl !== 'string') {
    return 0;
  }
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) {
    return 0;
  }
  const base64Part = dataUrl
    .slice(commaIndex + 1)
    .replace(/[^A-Za-z0-9+/=]/g, '');
  return Math.floor((base64Part.length * 3) / 4);
}

function extractContentType(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return null;
  }
  const semiColonIndex = dataUrl.indexOf(';');
  if (semiColonIndex === -1) {
    return null;
  }
  return dataUrl.slice(5, semiColonIndex);
}

function normaliseAttachmentsInput(input) {
  if (Array.isArray(input)) {
    return input;
  }
  if (input && typeof input === 'object') {
    return Object.values(input).filter((value) => value != null);
  }
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function splitAttachmentsByUploadRequirement(
  rawAttachments = [],
  { now = new Date().toISOString(), maxCount = MAX_ATTACHMENT_COUNT, maxBytes = MAX_ATTACHMENT_BYTES } = {},
) {
  const attachments = normaliseAttachmentsInput(rawAttachments);
  if (attachments.length === 0) {
    return { existingAttachments: [], newAttachments: [] };
  }
  if (attachments.length > maxCount) {
    throw validationError(`Up to ${maxCount} files can be attached per record.`);
  }

  const existingAttachments = [];
  const newAttachments = [];

  attachments.forEach((attachment, index) => {
    const id = toTrimmedString(attachment?.id) || uuidv4();
    const base = {
      id,
      name: toTrimmedString(attachment?.name) || `File ${index + 1}`,
      description: toTrimmedString(attachment?.description),
      uploadedAt: toTrimmedString(attachment?.uploadedAt) || now,
    };

    const blobName = toTrimmedString(attachment?.blobName);
    if (blobName) {
      existingAttachments.push({
        ...base,
        blobName,
        contentType: toTrimmedString(attachment?.contentType),
        size: Number.isFinite(Number(attachment?.size)) ? Number(attachment.size) : undefined,
      });
      return;
    }

    const dataUrl = toTrimmedString(attachment?.dataUrl);
    if (!dataUrl.startsWith('data:')) {
      throw validationError(`Attachment "${base.name}" is missing encoded data.`);
    }

    const estimatedBytes = estimateDataUrlBytes(dataUrl);
    if (estimatedBytes > maxBytes) {
      throw validationError(
        `Attachment "${base.name}" exceeds the ${Math.floor(maxBytes / (1024 * 1024))}MB limit.`,
      );
    }

    const contentType = toTrimmedString(attachment?.contentType) || extractContentType(dataUrl);
    newAttachments.push({
      ...base,
      dataUrl,
      contentType,
      size: estimatedBytes,
    });
  });

  return { existingAttachments, newAttachments };
}

module.exports = {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_COUNT,
  validationError,
  toTrimmedString,
  requireNonEmpty,
  estimateDataUrlBytes,
  extractContentType,
  splitAttachmentsByUploadRequirement,
  normaliseAttachmentsInput,
};
