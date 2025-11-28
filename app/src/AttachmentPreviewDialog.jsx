import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { getAttachmentHref, isDisplayableImage, isPdfAttachment } from './propertyPhotoUtils';

export function AttachmentPreviewDialog({ attachment, open, onClose }) {
  const { t } = useTranslation();
  const href = getAttachmentHref(attachment);
  const isImage = isDisplayableImage(attachment);
  const isPdf = isPdfAttachment(attachment);

  const renderContent = () => {
    if (!href) {
      return (
        <Typography color="text.secondary">
          {t('managedPropertiesView.preview.notAvailable')}
        </Typography>
      );
    }
    if (isImage) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box
            component="img"
            src={href}
            alt={attachment?.name}
            sx={{ maxWidth: '100%', maxHeight: '70vh' }}
          />
        </Box>
      );
    }
    if (isPdf) {
      return (
        <Box sx={{ height: '70vh' }}>
          <object data={href} type="application/pdf" width="100%" height="100%">
            <Typography>
              {t('managedPropertiesView.preview.pdfFallback')}{' '}
              <Button component="a" href={href} target="_blank" rel="noopener noreferrer">
                {t('managedPropertiesView.preview.open')}
              </Button>
            </Typography>
          </object>
        </Box>
      );
    }
    return (
      <Typography color="text.secondary">
        {t('managedPropertiesView.preview.notAvailable')}
      </Typography>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{attachment?.name || t('managedPropertiesView.preview.title')}</DialogTitle>
      <DialogContent dividers>{renderContent()}</DialogContent>
      <DialogActions>
        {href && (
          <Button
            component="a"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            download={attachment?.name || 'attachment'}
          >
            {t('managedPropertiesView.actions.download')}
          </Button>
        )}
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
