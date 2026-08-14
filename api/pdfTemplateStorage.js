const { BlobServiceClient } = require('@azure/storage-blob');

const CONNECTION_STRING_KEYS = [
  'PropertyPhotoStorageConnection',
  'PROPERTY_PHOTO_STORAGE_CONNECTION',
  'AzureWebJobsStorage',
];
const CONTAINER_NAME = 'pdf-templates';

function resolveConnectionString() {
  for (const key of CONNECTION_STRING_KEYS) {
    const v = process.env[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  throw new Error('Azure Storage connection string is not configured.');
}

let cachedContainerPromise = null;

async function getContainerClient() {
  if (!cachedContainerPromise) {
    cachedContainerPromise = (async () => {
      const client = BlobServiceClient.fromConnectionString(resolveConnectionString())
        .getContainerClient(CONTAINER_NAME);
      await client.createIfNotExists({ access: 'private' });
      return client;
    })();
  }
  return cachedContainerPromise;
}

function blobName(projectId, templateId) {
  return `${projectId}/${templateId}.pdf`;
}

async function uploadPdfTemplate(projectId, templateId, buffer) {
  const container = await getContainerClient();
  const name = blobName(projectId, templateId);
  const blob = container.getBlockBlobClient(name);
  await blob.uploadData(buffer, { blobHTTPHeaders: { blobContentType: 'application/pdf' } });
  return name;
}

async function downloadPdfTemplate(blobNamePath) {
  const container = await getContainerClient();
  const blob = container.getBlobClient(blobNamePath);
  const download = await blob.download(0);
  const chunks = [];
  for await (const chunk of download.readableStreamBody) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function deletePdfTemplateBlob(blobNamePath) {
  const container = await getContainerClient();
  await container.getBlobClient(blobNamePath).deleteIfExists();
}

module.exports = { uploadPdfTemplate, downloadPdfTemplate, deletePdfTemplateBlob };
