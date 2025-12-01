const { v4: uuidv4 } = require('uuid');

const DEFAULT_MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB
const DEFAULT_MAX_PHOTO_COUNT = 10;

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function parseNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function normalisePhotosInput(input) {
  if (Array.isArray(input)) {
    return input;
  }
  if (input && typeof input === 'object') {
    const values = Object.values(input).filter((value) => value != null);
    return values;
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

function buildManagedProperty(payload = {}, { now = new Date().toISOString() } = {}) {
  const propertyName = requireNonEmpty(payload?.propertyName, 'Property name is required.');

  return {
    id: uuidv4(),
    owner: toTrimmedString(payload?.owner),
    propertyName,
    address: toTrimmedString(payload?.address),
    memo: toTrimmedString(payload?.memo),
    managementFee: parseNumber(payload?.managementFee, 0),
    photos: [],
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
  if (Object.prototype.hasOwnProperty.call(updates, 'managementFee')) {
    next.managementFee = parseNumber(updates.managementFee, next.managementFee ?? 0);
  }

  if (!toTrimmedString(next.propertyName)) {
    throw validationError('Property name is required.');
  }

  next.updatedAt = now;
  return next;
}

function splitPhotosByUploadRequirement(rawPhotos = [], { now = new Date().toISOString() } = {}) {
  const photosArray = normalisePhotosInput(rawPhotos);
  if (photosArray.length === 0) {
    return { existingPhotos: [], newPhotos: [] };
  }

  if (photosArray.length > MAX_PHOTO_COUNT) {
    throw validationError(`Up to ${MAX_PHOTO_COUNT} photos can be attached per property.`);
  }

  const existingPhotos = [];
  const newPhotos = [];

  photosArray.forEach((photo, index) => {
    const id = toTrimmedString(photo?.id) || uuidv4();
    const base = {
      id,
      name: toTrimmedString(photo?.name) || `Photo ${index + 1}`,
      description: toTrimmedString(photo?.description),
      uploadedAt: toTrimmedString(photo?.uploadedAt) || now,
    };

    const blobName = toTrimmedString(photo?.blobName);
    if (blobName) {
      existingPhotos.push({
        ...base,
        blobName,
        contentType: toTrimmedString(photo?.contentType),
        size: Number.isFinite(Number(photo?.size)) ? Number(photo.size) : undefined,
      });
      return;
    }

    const dataUrl = toTrimmedString(photo?.dataUrl);
    if (!dataUrl.startsWith('data:')) {
      throw validationError(`Photo "${base.name}" is missing encoded data.`);
    }

    const estimatedBytes = estimateDataUrlBytes(dataUrl);
    if (estimatedBytes > MAX_PHOTO_BYTES) {
      throw validationError(
        `Photo "${base.name}" exceeds the ${Math.floor(MAX_PHOTO_BYTES / (1024 * 1024))}MB limit.`,
      );
    }

    const contentType = toTrimmedString(photo?.contentType) || extractContentType(dataUrl);
    newPhotos.push({
      ...base,
      dataUrl,
      contentType,
      size: estimatedBytes,
    });
  });

  return { existingPhotos, newPhotos };
}

module.exports = {
  MAX_PHOTO_BYTES,
  MAX_PHOTO_COUNT,
  buildManagedProperty,
  applyManagedPropertyUpdates,
  splitPhotosByUploadRequirement,
  estimateDataUrlBytes,
  validationError,
  parseNumber,
};
