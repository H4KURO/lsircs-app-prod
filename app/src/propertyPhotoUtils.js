export const MANAGED_PROPERTY_MAX_PHOTO_COUNT = 10;
export const MANAGED_PROPERTY_MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB

const FALLBACK_RANDOM_ID = () => `photo_${Math.random().toString(36).slice(2, 10)}`;

export const formatBytesInMb = (bytes) => Number((bytes / (1024 * 1024)).toFixed(1));

export const createClientId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return FALLBACK_RANDOM_ID();
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const filesToPhotoPayloads = async (fileList) => {
  const files = Array.from(fileList ?? []);
  if (files.length === 0) {
    return [];
  }

  const photos = await Promise.all(
    files.map(async (file) => ({
      id: createClientId(),
      name: file.name,
      contentType: file.type,
      size: file.size,
      dataUrl: await readFileAsDataUrl(file),
      uploadedAt: new Date().toISOString(),
      description: '',
    })),
  );

  return photos;
};

export const isDisplayableImage = (photo) => {
  const contentType = (photo?.contentType || '').toLowerCase();
  if (contentType.startsWith('image/')) {
    return true;
  }
  const dataUrl = photo?.dataUrl;
  if (typeof dataUrl === 'string') {
    return dataUrl.startsWith('data:image/');
  }
  return false;
};
