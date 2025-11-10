const { v4: uuidv4 } = require('uuid');

const DEFAULT_MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4MB
const DEFAULT_MAX_PHOTO_COUNT = 10;

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

const MAX_PHOTO_BYTES = parsePositiveInteger(
  process.env.MANAGED_PROPERTY_MAX_PHOTO_BYTES,
  DEFAULT_MAX_PHOTO_BYTES,
);
const MAX_PHOTO_COUNT = parsePositiveInteger(
  process.env.MANAGED_PROPERTY_MAX_PHOTOS,
  DEFAULT_MAX_PHOTO_COUNT,
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

function sanitizePhotos(rawPhotos = [], { now = new Date().toISOString() } = {}) {
  if (!Array.isArray(rawPhotos) || rawPhotos.length === 0) {
    return [];
  }

  if (rawPhotos.length > MAX_PHOTO_COUNT) {
    throw validationError(`Up to ${MAX_PHOTO_COUNT} photos can be attached per property.`);
  }

  return rawPhotos.map((photo, index) => {
    const dataUrl = toTrimmedString(photo?.dataUrl);
    if (!dataUrl.startsWith('data:')) {
      throw validationError(`Photo #${index + 1} is missing encoded data.`);
    }

    const estimatedBytes = estimateDataUrlBytes(dataUrl);
    if (estimatedBytes > MAX_PHOTO_BYTES) {
      throw validationError(
        `Photo "${photo?.name || `#${index + 1}`}" exceeds the ${Math.floor(
          MAX_PHOTO_BYTES / (1024 * 1024),
        )}MB limit.`,
      );
    }

    const id = toTrimmedString(photo?.id) || uuidv4();
    const name = toTrimmedString(photo?.name) || `Photo ${index + 1}`;
    const description = toTrimmedString(photo?.description);
    const contentType = toTrimmedString(photo?.contentType) || extractContentType(dataUrl);
    const uploadedAt = toTrimmedString(photo?.uploadedAt) || now;

    return {
      id,
      name,
      description,
      dataUrl,
      contentType,
      size: estimatedBytes,
      uploadedAt,
    };
  });
}

function buildManagedProperty(payload = {}, { now = new Date().toISOString() } = {}) {
  const propertyName = requireNonEmpty(payload?.propertyName, 'Property name is required.');

  return {
    id: uuidv4(),
    owner: toTrimmedString(payload?.owner),
    propertyName,
    address: toTrimmedString(payload?.address),
    memo: toTrimmedString(payload?.memo),
    photos: sanitizePhotos(payload?.photos, { now }),
    createdAt: now,
    updatedAt: now,
  };
}

function applyManagedPropertyUpdates(existing, updates = {}, { now = new Date().toISOString() } = {}) {
  if (!existing) {
    throw validationError('Managed property record was not found.', 'NotFound');
  }

  const next = { ...existing };

  if (Object.prototype.hasOwnProperty.call(updates, 'owner')) {
    next.owner = toTrimmedString(updates.owner);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'propertyName')) {
    next.propertyName = requireNonEmpty(updates.propertyName, 'Property name is required.');
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'address')) {
    next.address = toTrimmedString(updates.address);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'memo')) {
    next.memo = toTrimmedString(updates.memo);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'photos')) {
    next.photos = sanitizePhotos(updates.photos, { now });
  }

  if (!toTrimmedString(next.propertyName)) {
    throw validationError('Property name is required.');
  }

  next.updatedAt = now;
  return next;
}

module.exports = {
  MAX_PHOTO_BYTES,
  MAX_PHOTO_COUNT,
  sanitizePhotos,
  buildManagedProperty,
  applyManagedPropertyUpdates,
  estimateDataUrlBytes,
  validationError,
};
