import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  Typography,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  IconButton,
  Alert,
  Box,
} from '@mui/material';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import DeleteIcon from '@mui/icons-material/Delete';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import { useTranslation } from 'react-i18next';
import {
  MANAGED_PROPERTY_MAX_PHOTO_BYTES,
  MANAGED_PROPERTY_MAX_PHOTO_COUNT,
  filesToPhotoPayloads,
  formatBytesInMb,
  isDisplayableImage,
  getAttachmentHref,
} from './propertyPhotoUtils';
import { AttachmentPreviewDialog } from './AttachmentPreviewDialog';

export function ManagedPropertyDetailModal({ open, property, onClose, onSave, saving = false }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => ({
    owner: '',
    propertyName: '',
    address: '',
    memo: '',
  }));
  const [photos, setPhotos] = useState([]);
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);

  const renderAttachmentPreview = (photo) => {
    if (isDisplayableImage(photo)) {
      return <img src={photo.url || photo.dataUrl} alt={photo.name} loading="lazy" />;
    }
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
          height: 120,
          backgroundColor: 'background.paper',
          border: '1px dashed',
          borderColor: 'divider',
          textAlign: 'center',
        }}
      >
        <Stack spacing={1} alignItems="center">
          <PictureAsPdfIcon color="action" />
          <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>
            {photo.name}
          </Typography>
        </Stack>
      </Box>
    );
  };

  useEffect(() => {
    if (property) {
      setForm({
        owner: property.owner || '',
        propertyName: property.propertyName || '',
        address: property.address || '',
        memo: property.memo || '',
      });
      setPhotos(property.photos || []);
      setUploadError('');
    }
  }, [property]);

  const remainingSlots = useMemo(
    () => Math.max(MANAGED_PROPERTY_MAX_PHOTO_COUNT - photos.length, 0),
    [photos.length],
  );

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddPhotos = async (event) => {
    const fileArray = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (fileArray.length === 0) {
      return;
    }

    if (fileArray.length > remainingSlots) {
      setUploadError(
        t('managedPropertiesView.photos.tooMany', { count: MANAGED_PROPERTY_MAX_PHOTO_COUNT }),
      );
      return;
    }

    const oversized = fileArray.find((file) => file.size > MANAGED_PROPERTY_MAX_PHOTO_BYTES);
    if (oversized) {
      setUploadError(
        t('managedPropertiesView.photos.tooLarge', {
          name: oversized.name,
          size: formatBytesInMb(MANAGED_PROPERTY_MAX_PHOTO_BYTES),
        }),
      );
      return;
    }

    setIsUploading(true);
    try {
      const newPhotos = await filesToPhotoPayloads(fileArray);
      setPhotos((prev) => [...prev, ...newPhotos]);
      setUploadError('');
    } catch (error) {
      setUploadError(t('managedPropertiesView.photos.readError'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = (photoId) => {
    setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
  };

  const handleSubmit = () => {
    if (!property?.id) {
      return;
    }
    onSave?.({ ...property, ...form, photos });
  };

  const handlePreviewAttachment = (attachment) => {
    setPreviewAttachment(attachment);
  };

  const title = property?.propertyName
    ? t('managedPropertiesView.detailModal.titleWithName', { name: property.propertyName })
    : t('managedPropertiesView.detailModal.title');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={t('managedPropertiesView.fields.propertyName')}
            name="propertyName"
            value={form.propertyName}
            onChange={handleInputChange}
            required
            fullWidth
          />
          <TextField
            label={t('managedPropertiesView.fields.owner')}
            name="owner"
            value={form.owner}
            onChange={handleInputChange}
            fullWidth
          />
          <TextField
            label={t('managedPropertiesView.fields.address')}
            name="address"
            value={form.address}
            onChange={handleInputChange}
            fullWidth
          />
          <TextField
            label={t('managedPropertiesView.fields.memo')}
            name="memo"
            value={form.memo}
            onChange={handleInputChange}
            multiline
            minRows={3}
            fullWidth
          />

          <Box>
            <Stack direction="row" spacing={2} alignItems="center">
              <Button
                variant="outlined"
                component="label"
                startIcon={<AddAPhotoIcon />}
                disabled={remainingSlots === 0 || isUploading}
              >
                {t('managedPropertiesView.photos.add')}
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,application/pdf"
                  hidden
                  onChange={handleAddPhotos}
                />
              </Button>
              <Typography variant="body2" color="text.secondary">
                {t('managedPropertiesView.photos.helper', {
                  count: MANAGED_PROPERTY_MAX_PHOTO_COUNT,
                  size: formatBytesInMb(MANAGED_PROPERTY_MAX_PHOTO_BYTES),
                })}
              </Typography>
            </Stack>
            {uploadError && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {uploadError}
              </Alert>
            )}
            {photos.length > 0 && (
              <ImageList cols={3} gap={8} sx={{ mt: 2 }}>
                {photos.map((photo) => {
                  const downloadHref = getAttachmentHref(photo);
                  return (
                    <ImageListItem key={photo.id}>
                      {renderAttachmentPreview(photo)}
                      <ImageListItemBar
                        title={photo.name}
                        actionIcon={
                          <Stack direction="row">
                            <IconButton
                              color="inherit"
                              aria-label={t('managedPropertiesView.actions.preview')}
                              onClick={() => handlePreviewAttachment(photo)}
                            >
                              <VisibilityIcon />
                            </IconButton>
                            <IconButton
                              color="inherit"
                              aria-label={t('managedPropertiesView.actions.download')}
                              component="a"
                              href={downloadHref || undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={photo.name}
                              disabled={!downloadHref}
                            >
                              <DownloadIcon />
                            </IconButton>
                            <IconButton
                              color="inherit"
                              aria-label={t('managedPropertiesView.actions.delete')}
                              onClick={() => handleRemovePhoto(photo.id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Stack>
                        }
                      />
                    </ImageListItem>
                  );
                })}
              </ImageList>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={saving || !form.propertyName}>
          {saving ? t('managedPropertiesView.actions.saving') : t('managedPropertiesView.detailModal.save')}
        </Button>
      </DialogActions>
      <AttachmentPreviewDialog
        attachment={previewAttachment}
        open={Boolean(previewAttachment)}
        onClose={() => setPreviewAttachment(null)}
      />
    </Dialog>
  );
}
