const {
  BlobServiceClient,
  BlobSASPermissions,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} = require('@azure/storage-blob');
const { validationError } = require('./managedPropertyUtils');

const CONNECTION_STRING_KEYS = [
  'PropertyPhotoStorageConnection',
  'PROPERTY_PHOTO_STORAGE_CONNECTION',
  'AzureWebJobsStorage',
];
const CONTAINER_NAME_KEYS = ['PropertyPhotoContainerName', 'PROPERTY_PHOTO_CONTAINER_NAME'];
const DEFAULT_CONTAINER = 'property-photos';
const DEFAULT_SAS_TTL_MINUTES = 60 * 24 * 30; // 30 days

function resolveSetting(keys, fallback) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return fallback;
}

function parseTtlMinutes(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

const SAS_TTL_MINUTES = parseTtlMinutes(
  process.env.PROPERTY_PHOTO_SAS_TTL_MINUTES,
  DEFAULT_SAS_TTL_MINUTES,
);

let cachedContainerPromise;
let cachedConnectionString = null;
let cachedContainerName = null;
let cachedSharedKeyCredential = null;

async function getPhotoContainerClient() {
  if (!cachedContainerPromise) {
    cachedContainerPromise = (async () => {
      const connectionString = resolveSetting(CONNECTION_STRING_KEYS, null);
      if (!connectionString) {
        throw validationError(
          'Photo storage connection string is not configured.',
          'MissingStorageConnection',
        );
      }
      cachedConnectionString = connectionString;
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      const containerName = resolveSetting(CONTAINER_NAME_KEYS, DEFAULT_CONTAINER);
      cachedContainerName = containerName;
      const containerClient = blobServiceClient.getContainerClient(containerName);
      await containerClient.createIfNotExists({ access: 'private' });
      return containerClient;
    })();
  }
  return cachedContainerPromise;
}

function parseConnectionString(connectionString) {
  return connectionString.split(';').reduce((acc, part) => {
    const [key, value] = part.split('=');
    if (key && value) {
      acc[key.trim()] = value.trim();
    }
    return acc;
  }, {});
}

function getSharedKeyCredential() {
  if (cachedSharedKeyCredential) {
    return cachedSharedKeyCredential;
  }
  if (!cachedConnectionString) {
    return null;
  }
  const parts = parseConnectionString(cachedConnectionString);
  const accountName = parts.AccountName;
  const accountKey = parts.AccountKey;
  if (!accountName || !accountKey) {
    return null;
  }
  cachedSharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
  return cachedSharedKeyCredential;
}

const CONTENT_TYPE_EXTENSION = new Map([
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/png', 'png'],
  ['image/gif', 'gif'],
  ['image/webp', 'webp'],
  ['image/bmp', 'bmp'],
  ['image/svg+xml', 'svg'],
]);

function guessExtension(contentType) {
  const lowered = typeof contentType === 'string' ? contentType.toLowerCase() : '';
  return CONTENT_TYPE_EXTENSION.get(lowered) || 'bin';
}

function sanitizePathSegment(value) {
  if (typeof value !== 'string') {
    return 'value';
  }
  const cleaned = value.replace(/[^A-Za-z0-9-_]/g, '');
  return cleaned || 'value';
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) {
    throw validationError('Invalid image data provided.', 'InvalidPhotoData');
  }
  return {
    contentType: match[1],
    base64: match[2],
  };
}

async function uploadManagedPropertyPhoto(propertyId, photo) {
  const container = await getPhotoContainerClient();
  const parsed = parseDataUrl(photo.dataUrl);
  const contentType = photo.contentType || parsed.contentType || 'application/octet-stream';
  const buffer = Buffer.from(parsed.base64, 'base64');

  const blobName = `${sanitizePathSegment(propertyId)}/${sanitizePathSegment(photo.id)}.${guessExtension(
    contentType,
  )}`;
  const blockBlobClient = container.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: contentType,
    },
  });

  return {
    id: photo.id,
    name: photo.name,
    description: photo.description,
    blobName,
    contentType,
    size: buffer.length,
    uploadedAt: photo.uploadedAt,
  };
}

async function deleteManagedPropertyPhoto(blobName) {
  if (!blobName) {
    return;
  }
  const container = await getPhotoContainerClient();
  try {
    await container.getBlobClient(blobName).deleteIfExists();
  } catch (error) {
    // Swallow deletion errors to avoid blocking the main workflow.
  }
}

async function deleteManagedPropertyPhotos(blobNames = []) {
  await Promise.all(blobNames.map((blobName) => deleteManagedPropertyPhoto(blobName)));
}

async function generatePhotoUrl(blobName) {
  if (!blobName) {
    return null;
  }
  const container = await getPhotoContainerClient();
  const blobClient = container.getBlobClient(blobName);
  const expiresOn = new Date(Date.now() + SAS_TTL_MINUTES * 60 * 1000);
  const startsOn = new Date(Date.now() - 5 * 60 * 1000);
  const credential = getSharedKeyCredential();

  if (credential && cachedContainerName) {
    try {
      const sas = generateBlobSASQueryParameters(
        {
          containerName: cachedContainerName,
          blobName,
          permissions: BlobSASPermissions.parse('r'),
          startsOn,
          expiresOn,
        },
        credential,
      );
      return `${blobClient.url}?${sas.toString()}`;
    } catch (error) {
      // Fall back to unsigned URL if SAS generation fails.
    }
  }

  return blobClient.url;
}

async function attachPhotoUrls(photos = []) {
  if (!Array.isArray(photos) || photos.length === 0) {
    return [];
  }

  const enriched = await Promise.all(
    photos.map(async (photo) => {
      if (!photo?.blobName) {
        return photo;
      }
      const url = await generatePhotoUrl(photo.blobName);
      return { ...photo, url };
    }),
  );

  return enriched;
}

module.exports = {
  uploadManagedPropertyPhoto,
  deleteManagedPropertyPhoto,
  deleteManagedPropertyPhotos,
  attachPhotoUrls,
};
