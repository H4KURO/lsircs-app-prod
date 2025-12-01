import { useState } from 'react';
import {
  Box,
  Button,
  Stack,
  Typography,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  IconButton,
  Alert,
} from '@mui/material';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { useTranslation } from 'react-i18next';
import {
  MANAGED_PROPERTY_MAX_PHOTO_BYTES,
  MANAGED_PROPERTY_MAX_PHOTO_COUNT,
  formatBytesInMb,
  filesToAttachmentPayloads,
  isDisplayableImage,
  isPdfAttachment,
  getAttachmentHref,
  ATTACHMENT_ACCEPTED_TYPES,
} from './propertyPhotoUtils';
import { AttachmentPreviewDialog } from './AttachmentPreviewDialog';

export function AttachmentManager({
  value = [],
  onChange,
  maxCount = MANAGED_PROPERTY_MAX_PHOTO_COUNT,
  maxFileSize = MANAGED_PROPERTY_MAX_PHOTO_BYTES,
  accept = ATTACHMENT_ACCEPTED_TYPES,
}) {
  const { t } = useTranslation();
  const attachments = Array.isArray(value) ? value : [];
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);

  const remainingSlots = Math.max(maxCount - attachments.length, 0);

  const handleAddFiles = async (event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) {
      return;
    }

    if (attachments.length + files.length > maxCount) {
      setUploadError(t('attachments.tooMany', { count: maxCount }));
      return;
    }

    const oversized = files.find((file) => file.size > maxFileSize);
    if (oversized) {
      setUploadError(
        t('attachments.tooLarge', {
          name: oversized.name,
          size: formatBytesInMb(maxFileSize),
        }),
      );
      return;
    }

    setIsUploading(true);
    try {
      const newAttachments = await filesToAttachmentPayloads(files);
      onChange?.([...attachments, ...newAttachments]);
      setUploadError('');
    } catch (error) {
      setUploadError(t('attachments.readError'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = (id) => {
    onChange?.(attachments.filter((attachment) => attachment.id !== id));
  };

  const renderPreviewContent = (attachment) => {
    if (isDisplayableImage(attachment)) {
      return <img src={attachment.url || attachment.dataUrl} alt={attachment.name} loading="lazy" />;
    }
    if (isPdfAttachment(attachment)) {
      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 140,
            border: '1px dashed',
            borderColor: 'divider',
          }}
        >
          <Stack spacing={1} alignItems="center">
            <PictureAsPdfIcon color="action" fontSize="large" />
            <Typography variant="caption" sx={{ wordBreak: 'break-all', px: 1 }}>
              {attachment.name}
            </Typography>
          </Stack>
        </Box>
      );
    }
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 140,
          border: '1px dashed',
          borderColor: 'divider',
        }}
      >
        <Typography variant="caption">{attachment.name}</Typography>
      </Box>
    );
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
        <Button
          variant="outlined"
          component="label"
          startIcon={<AddAPhotoIcon />}
          disabled={remainingSlots === 0 || isUploading}
        >
          {t('attachments.add')}
          <input type="file" hidden multiple accept={accept} onChange={handleAddFiles} />
        </Button>
        <Typography variant="body2" color="text.secondary">
          {t('attachments.helper', {
            count: maxCount,
            size: formatBytesInMb(maxFileSize),
          })}
        </Typography>
      </Stack>
      {uploadError && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {uploadError}
        </Alert>
      )}
      {attachments.length > 0 && (
        <ImageList cols={3} gap={8} sx={{ mt: 2 }}>
          {attachments.map((attachment) => {
            const downloadHref = getAttachmentHref(attachment);
            return (
              <ImageListItem key={attachment.id}>
                {renderPreviewContent(attachment)}
                <ImageListItemBar
                  title={attachment.name}
                  actionIcon={
                    <Stack direction="row">
                      <IconButton
                        color="inherit"
                        aria-label={t('attachments.preview')}
                        onClick={() => setPreviewAttachment(attachment)}
                      >
                        <VisibilityIcon />
                      </IconButton>
                      <IconButton
                        color="inherit"
                        aria-label={t('attachments.download')}
                        component="a"
                        href={downloadHref || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={attachment.name}
                        disabled={!downloadHref}
                      >
                        <DownloadIcon />
                      </IconButton>
                      <IconButton
                        color="inherit"
                        aria-label={t('attachments.delete')}
                        onClick={() => handleRemove(attachment.id)}
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
      <AttachmentPreviewDialog
        attachment={previewAttachment}
        open={Boolean(previewAttachment)}
        onClose={() => setPreviewAttachment(null)}
      />
    </Box>
  );
}
