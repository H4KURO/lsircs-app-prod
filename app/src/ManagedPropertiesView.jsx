import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Stack,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  MenuItem,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import { useTranslation } from 'react-i18next';
import { ManagedPropertyDetailModal } from './ManagedPropertyDetailModal';
import { AttachmentPreviewDialog } from './AttachmentPreviewDialog';
import {
  MANAGED_PROPERTY_MAX_PHOTO_BYTES,
  MANAGED_PROPERTY_MAX_PHOTO_COUNT,
  filesToPhotoPayloads,
  formatBytesInMb,
  isDisplayableImage,
  getAttachmentHref,
  formatYen,
} from './propertyPhotoUtils';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';

const API_URL = '/api';
const DWELLING_TYPE_OPTIONS = [
  { value: 'house', labelKey: 'managedPropertiesView.dwellingTypes.house' },
  { value: 'apartment', labelKey: 'managedPropertiesView.dwellingTypes.apartment' },
];

const extractErrorMessage = (error, fallback) => {
  const serverMessage = error?.response?.data;
  if (typeof serverMessage === 'string' && serverMessage.trim()) {
    return serverMessage;
  }
  return fallback;
};

export function ManagedPropertiesView() {
  const { t } = useTranslation();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [filterText, setFilterText] = useState('');
  const [formValues, setFormValues] = useState({
    owner: '',
    propertyName: '',
    address: '',
    memo: '',
    managementFee: '',
  });
  const [formPhotos, setFormPhotos] = useState([]);
  const [photoFeedback, setPhotoFeedback] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const dwellingTypeOptions = useMemo(
    () => DWELLING_TYPE_OPTIONS.map((option) => ({ ...option, label: t(option.labelKey) })),
    [t],
  );

  const formatSquareMeters = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      return null;
    }
    return `${num.toLocaleString()} m²`;
  };

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
    let isMounted = true;
    axios
      .get(`${API_URL}/GetManagedProperties`)
      .then((response) => {
        if (isMounted) {
          setProperties(response.data || []);
        }
      })
      .catch(() => {
        if (isMounted) {
          setErrorMessage(t('managedPropertiesView.alerts.loadFailed'));
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [t]);

  const filteredProperties = useMemo(() => {
    if (!filterText.trim()) {
      return properties;
    }
    const keyword = filterText.trim().toLowerCase();
    return properties.filter((property) => {
      const combined = [
        property.propertyName,
        property.owner,
        property.address,
        property.memo,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return combined.includes(keyword);
    });
  }, [properties, filterText]);

  const sortedProperties = useMemo(() => {
    return [...filteredProperties].sort((a, b) => {
      const aDate = a.updatedAt || a.createdAt || '';
      const bDate = b.updatedAt || b.createdAt || '';
      return bDate.localeCompare(aDate);
    });
  }, [filteredProperties]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddPhotosToForm = async (event) => {
    const fileArray = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (fileArray.length === 0) {
      return;
    }
    if (formPhotos.length + fileArray.length > MANAGED_PROPERTY_MAX_PHOTO_COUNT) {
      setPhotoFeedback(
        t('managedPropertiesView.photos.tooMany', { count: MANAGED_PROPERTY_MAX_PHOTO_COUNT }),
      );
      return;
    }
    const oversized = fileArray.find((file) => file.size > MANAGED_PROPERTY_MAX_PHOTO_BYTES);
    if (oversized) {
      setPhotoFeedback(
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
      setFormPhotos((prev) => [...prev, ...newPhotos]);
      setPhotoFeedback('');
    } catch (error) {
      setPhotoFeedback(t('managedPropertiesView.photos.readError'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFormPhoto = (photoId) => {
    setFormPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
  };

  const resetForm = () => {
    setFormValues({
      owner: '',
      propertyName: '',
      address: '',
      memo: '',
      managementFee: '',
      buildingArea: '',
      lotArea: '',
      dwellingType: '',
    });
    setFormPhotos([]);
    setPhotoFeedback('');
  };

  const handleCreateProperty = async (event) => {
    event.preventDefault();
    if (!formValues.propertyName.trim()) {
      setErrorMessage(t('managedPropertiesView.validations.propertyNameRequired'));
      return;
    }

    setCreating(true);
    try {
      const payload = {
        ...formValues,
        photos: formPhotos,
      };
      const { data } = await axios.post(`${API_URL}/CreateManagedProperty`, payload);
      setProperties((prev) => [data, ...prev]);
      resetForm();
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, t('managedPropertiesView.alerts.createFailed')));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProperty = async (property) => {
    const confirmed = window.confirm(
      t('managedPropertiesView.actions.confirmDelete', { name: property.propertyName }),
    );
    if (!confirmed) {
      return;
    }
    try {
      await axios.delete(`${API_URL}/DeleteManagedProperty/${property.id}`);
      setProperties((prev) => prev.filter((item) => item.id !== property.id));
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, t('managedPropertiesView.alerts.deleteFailed')));
    }
  };

  const handleOpenModal = (property) => {
    setSelectedProperty(property);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedProperty(null);
  };

  const handleModalSave = async (updatedProperty) => {
    if (!updatedProperty?.id) {
      return;
    }
    setModalSaving(true);
    try {
      const { data } = await axios.put(
        `${API_URL}/UpdateManagedProperty/${updatedProperty.id}`,
        updatedProperty,
      );
      setProperties((prev) => prev.map((item) => (item.id === data.id ? data : item)));
      setErrorMessage('');
      handleModalClose();
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, t('managedPropertiesView.alerts.updateFailed')));
    } finally {
      setModalSaving(false);
    }
  };

  const handlePreviewAttachment = (attachment) => {
    setPreviewAttachment(attachment);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h4" component="h1">
        {t('managedPropertiesView.title')}
      </Typography>
      <Typography color="text.secondary">
        {t('managedPropertiesView.description')}
      </Typography>

      {errorMessage && (
        <Alert severity="error" onClose={() => setErrorMessage('')}>
          {errorMessage}
        </Alert>
      )}

      <Paper component="form" onSubmit={handleCreateProperty} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          {t('managedPropertiesView.createSection.title')}
        </Typography>
        <Stack spacing={2}>
          <TextField
            label={t('managedPropertiesView.fields.propertyName')}
            name="propertyName"
            value={formValues.propertyName}
            onChange={handleInputChange}
            required
            fullWidth
          />
          <TextField
            label={t('managedPropertiesView.fields.owner')}
            name="owner"
            value={formValues.owner}
            onChange={handleInputChange}
            fullWidth
          />
          <TextField
            label={t('managedPropertiesView.fields.address')}
            name="address"
            value={formValues.address}
            onChange={handleInputChange}
            fullWidth
          />
          <TextField
            label={t('managedPropertiesView.fields.managementFee')}
            name="managementFee"
            type="number"
            value={formValues.managementFee}
            onChange={handleInputChange}
            InputProps={{ inputProps: { min: 0 } }}
            fullWidth
          />
          <TextField
            label={t('managedPropertiesView.fields.buildingArea')}
            name="buildingArea"
            type="number"
            value={formValues.buildingArea}
            onChange={handleInputChange}
            InputProps={{ inputProps: { min: 0 } }}
            fullWidth
          />
          <TextField
            label={t('managedPropertiesView.fields.lotArea')}
            name="lotArea"
            type="number"
            value={formValues.lotArea}
            onChange={handleInputChange}
            InputProps={{ inputProps: { min: 0 } }}
            fullWidth
          />
          <TextField
            select
            label={t('managedPropertiesView.fields.dwellingType')}
            name="dwellingType"
            value={formValues.dwellingType}
            onChange={handleInputChange}
            fullWidth
          >
            <MenuItem value="">
              <em>{t('managedPropertiesView.dwellingTypes.unset')}</em>
            </MenuItem>
            {dwellingTypeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('managedPropertiesView.fields.memo')}
            name="memo"
            value={formValues.memo}
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
                disabled={isUploading || formPhotos.length >= MANAGED_PROPERTY_MAX_PHOTO_COUNT}
              >
                {t('managedPropertiesView.photos.add')}
                <input
                  type="file"
                  hidden
                  multiple
                  accept="image/*,.pdf,application/pdf"
                  onChange={handleAddPhotosToForm}
                />
              </Button>
              <Typography variant="body2" color="text.secondary">
                {t('managedPropertiesView.photos.helper', {
                  count: MANAGED_PROPERTY_MAX_PHOTO_COUNT,
                  size: formatBytesInMb(MANAGED_PROPERTY_MAX_PHOTO_BYTES),
                })}
              </Typography>
            </Stack>
            {photoFeedback && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {photoFeedback}
              </Alert>
            )}
            {formPhotos.length > 0 && (
              <ImageList cols={3} gap={8} sx={{ mt: 2 }}>
                {formPhotos.map((photo) => {
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
                              onClick={() => handleRemoveFormPhoto(photo.id)}
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

          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button type="button" variant="text" onClick={resetForm}>
              {t('managedPropertiesView.createSection.reset')}
            </Button>
            <Button type="submit" variant="contained" disabled={creating}>
              {creating ? t('managedPropertiesView.actions.saving') : t('managedPropertiesView.createSection.submit')}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
            <Box>
              <Typography variant="h6">
                {t('managedPropertiesView.list.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('managedPropertiesView.list.subtitle')}
              </Typography>
            </Box>
            <TextField
              variant="outlined"
              size="small"
              placeholder={t('managedPropertiesView.list.filterPlaceholder')}
              value={filterText}
              onChange={(event) => setFilterText(event.target.value)}
            />
          </Stack>
          <Divider />
          {loading ? (
            <Stack alignItems="center" sx={{ py: 6 }}>
              <CircularProgress size={32} />
              <Typography variant="body2" sx={{ mt: 2 }}>
                {t('managedPropertiesView.actions.loading')}
              </Typography>
            </Stack>
          ) : sortedProperties.length === 0 ? (
            <Typography color="text.secondary">
              {t('managedPropertiesView.list.empty')}
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {sortedProperties.map((property) => (
                <Grid item xs={12} md={6} lg={4} key={property.id}>
                  <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" gutterBottom>
                        {property.propertyName}
                      </Typography>
                      {property.owner && (
                        <Typography variant="body2" color="text.secondary">
                          {t('managedPropertiesView.list.owner', { name: property.owner })}
                        </Typography>
                      )}
                      {property.address && (
                        <Typography variant="body2" color="text.secondary">
                          {t('managedPropertiesView.list.address', { value: property.address })}
                        </Typography>
                      )}
                      {formatYen(property.managementFee) && (
                        <Typography variant="body2" color="text.secondary">
                          {t('managedPropertiesView.list.managementFee', {
                            value: formatYen(property.managementFee),
                          })}
                        </Typography>
                      )}
                      {formatSquareMeters(property.buildingArea) && (
                        <Typography variant="body2" color="text.secondary">
                          {t('managedPropertiesView.list.buildingArea', {
                            value: formatSquareMeters(property.buildingArea),
                          })}
                        </Typography>
                      )}
                      {formatSquareMeters(property.lotArea) && (
                        <Typography variant="body2" color="text.secondary">
                          {t('managedPropertiesView.list.lotArea', {
                            value: formatSquareMeters(property.lotArea),
                          })}
                        </Typography>
                      )}
                      {property.dwellingType && (
                        <Typography variant="body2" color="text.secondary">
                          {t('managedPropertiesView.list.dwellingType', {
                            value: t(
                              `managedPropertiesView.dwellingTypes.${property.dwellingType}`,
                              property.dwellingType,
                            ),
                          })}
                        </Typography>
                      )}
                      {property.memo && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          {property.memo}
                        </Typography>
                      )}
                      {property.photos?.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Chip
                            size="small"
                            label={t('managedPropertiesView.photos.count', { count: property.photos.length })}
                          />
                          <ImageList cols={2} gap={6} sx={{ mt: 1 }}>
                            {property.photos.slice(0, 4).map((photo) => {
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
                                      </Stack>
                                    }
                                  />
                                </ImageListItem>
                              );
                            })}
                          </ImageList>
                        </Box>
                      )}
                    </CardContent>
                    <CardActions sx={{ justifyContent: 'flex-end' }}>
                      <Button
                        startIcon={<EditIcon />}
                        size="small"
                        onClick={() => handleOpenModal(property)}
                      >
                        {t('managedPropertiesView.actions.edit')}
                      </Button>
                      <IconButton color="error" onClick={() => handleDeleteProperty(property)}>
                        <DeleteIcon />
                      </IconButton>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Stack>
      </Paper>

      <ManagedPropertyDetailModal
        open={modalOpen}
        property={selectedProperty}
        onClose={handleModalClose}
        onSave={handleModalSave}
        saving={modalSaving}
      />
      <AttachmentPreviewDialog
        attachment={previewAttachment}
        open={Boolean(previewAttachment)}
        onClose={() => setPreviewAttachment(null)}
      />
    </Box>
  );
}
