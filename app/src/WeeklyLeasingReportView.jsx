import axios from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { useTranslation } from 'react-i18next';

const API_URL = '/api';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const extractErrorMessage = (error, fallback) => {
  if (error?.response?.data) {
    if (typeof error.response.data === 'string') {
      return error.response.data;
    }
    if (typeof error.response.data?.message === 'string') {
      return error.response.data.message;
    }
  }
  return fallback;
};

const formatCurrency = (value) => {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return currencyFormatter.format(value);
};

const formatDate = (value) => {
  if (!value) {
    return '—';
  }
  return value;
};

const EMPTY_ROW_TEMPLATE = {
  unit: '',
  lastRent: '',
  scheduledRent: '',
  newRent: '',
  lastMoveOut: '',
  availableOn: '',
  nextMoveIn: '',
  showing: '',
  inquiry: '',
  application: '',
  status: '',
  onMarketDate: '',
  memo: '',
};

export function WeeklyLeasingReportView() {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const [records, setRecords] = useState([]);
  const [availableReportDates, setAvailableReportDates] = useState([]);
  const [selectedReportDate, setSelectedReportDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadStatus, setUploadStatus] = useState(null);
  const [rowErrors, setRowErrors] = useState([]);
  const [editingRow, setEditingRow] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [activeFieldKey, setActiveFieldKey] = useState('');
  const [savingRowId, setSavingRowId] = useState(null);
  const [editError, setEditError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRowValues, setNewRowValues] = useState(() => ({ ...EMPTY_ROW_TEMPLATE }));
  const [addError, setAddError] = useState('');
  const [addingRow, setAddingRow] = useState(false);

  const columns = useMemo(
    () => [
      { key: 'unit', label: t('weeklyLeasingReports.table.unit') },
      { key: 'lastRent', label: t('weeklyLeasingReports.table.lastRent'), formatter: formatCurrency },
      { key: 'scheduledRent', label: t('weeklyLeasingReports.table.scheduledRent'), formatter: formatCurrency },
      { key: 'newRent', label: t('weeklyLeasingReports.table.newRent'), formatter: formatCurrency },
      { key: 'lastMoveOut', label: t('weeklyLeasingReports.table.lastMoveOut'), formatter: formatDate },
      { key: 'availableOn', label: t('weeklyLeasingReports.table.availableOn'), formatter: formatDate },
      { key: 'nextMoveIn', label: t('weeklyLeasingReports.table.nextMoveIn'), formatter: formatDate },
      { key: 'showing', label: t('weeklyLeasingReports.table.showing') },
      { key: 'inquiry', label: t('weeklyLeasingReports.table.inquiry') },
      { key: 'application', label: t('weeklyLeasingReports.table.application') },
      { key: 'status', label: t('weeklyLeasingReports.table.status') },
      { key: 'onMarketDate', label: t('weeklyLeasingReports.table.onMarketDate'), formatter: formatDate },
      { key: 'memo', label: t('weeklyLeasingReports.table.memo') },
    ],
    [t],
  );

  const editableFields = useMemo(
    () => [
      { key: 'lastRent', label: t('weeklyLeasingReports.table.lastRent'), type: 'number' },
      { key: 'scheduledRent', label: t('weeklyLeasingReports.table.scheduledRent'), type: 'number' },
      { key: 'newRent', label: t('weeklyLeasingReports.table.newRent'), type: 'number' },
      { key: 'lastMoveOut', label: t('weeklyLeasingReports.table.lastMoveOut'), type: 'date' },
      { key: 'availableOn', label: t('weeklyLeasingReports.table.availableOn'), type: 'date' },
      { key: 'nextMoveIn', label: t('weeklyLeasingReports.table.nextMoveIn'), type: 'date' },
      { key: 'showing', label: t('weeklyLeasingReports.table.showing') },
      { key: 'inquiry', label: t('weeklyLeasingReports.table.inquiry') },
      { key: 'application', label: t('weeklyLeasingReports.table.application') },
      { key: 'status', label: t('weeklyLeasingReports.table.status') },
      { key: 'onMarketDate', label: t('weeklyLeasingReports.table.onMarketDate'), type: 'date' },
      { key: 'memo', label: t('weeklyLeasingReports.table.memo'), multiline: true, rows: 3 },
    ],
    [t],
  );

  const editableFieldMap = useMemo(() => {
    const map = {};
    editableFields.forEach((field) => {
      map[field.key] = field;
    });
    return map;
  }, [editableFields]);

  const buildEditValues = (record) => ({
    lastRent: record?.lastRent ?? '',
    scheduledRent: record?.scheduledRent ?? '',
    newRent: record?.newRent ?? '',
    lastMoveOut: record?.lastMoveOut || '',
    availableOn: record?.availableOn || '',
    nextMoveIn: record?.nextMoveIn || '',
    showing: record?.showing || '',
    inquiry: record?.inquiry || '',
    application: record?.application || '',
    status: record?.status || '',
    onMarketDate: record?.onMarketDate || '',
    memo: record?.memo || '',
  });

  const addRowFields = useMemo(
    () => [{ key: 'unit', label: t('weeklyLeasingReports.table.unit'), required: true }, ...editableFields],
    [editableFields, t],
  );

  const fetchReports = async (targetDate) => {
    setLoading(true);
    setErrorMessage('');
    try {
      const config = targetDate ? { params: { reportDate: targetDate } } : {};
      const { data } = await axios.get(`${API_URL}/GetWeeklyLeasingReports`, config);
      setRecords(data?.records || []);
      setAvailableReportDates(data?.availableReportDates || []);
      setSelectedReportDate(data?.reportDate || '');
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, t('weeklyLeasingReports.fetchFailed')));
    } finally {
      setLoading(false);
    }
  };

  const beginEditingRow = (record, fieldKey) => {
    setEditingRow(record);
    setEditValues(buildEditValues(record));
    setActiveFieldKey(fieldKey || '');
    setEditError('');
  };

  const handleCellClick = (record, columnKey) => {
    if (!editableFieldMap[columnKey]) {
      return;
    }
    if (!editingRow || editingRow.id !== record.id) {
      beginEditingRow(record, columnKey);
      return;
    }
    setActiveFieldKey(columnKey);
  };

  const resetEditingState = () => {
    setEditingRow(null);
    setEditValues({});
    setActiveFieldKey('');
    setEditError('');
  };

  const handleEditFieldChange = (field, value) => {
    setEditValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleCancelEdit = () => {
    if (savingRowId) {
      return;
    }
    resetEditingState();
  };

  const handleSaveRow = async () => {
    if (!editingRow) {
      return;
    }
    setSavingRowId(editingRow.id);
    setEditError('');
    try {
      const payload = {
        reportDate: editingRow.reportDate,
        ...editValues,
      };
      const { data } = await axios.put(`${API_URL}/UpdateWeeklyLeasingReport/${editingRow.id}`, payload);
      setRecords((prev) => prev.map((item) => (item.id === data.id ? data : item)));
      setUploadStatus({
        severity: 'success',
        message: t('weeklyLeasingReports.edit.success', {
          unit: data.unit,
        }),
      });
      resetEditingState();
    } catch (error) {
      setEditError(extractErrorMessage(error, t('weeklyLeasingReports.edit.failed')));
    } finally {
      setSavingRowId(null);
    }
  };

  const resetNewRowForm = () => {
    setNewRowValues({ ...EMPTY_ROW_TEMPLATE });
    setAddError('');
  };

  const handleNewRowFieldChange = (field, value) => {
    setNewRowValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateRow = async () => {
    if (!selectedReportDate) {
      setAddError(t('weeklyLeasingReports.addRow.reportDateRequired'));
      return;
    }
    if (!newRowValues.unit.trim()) {
      setAddError(t('weeklyLeasingReports.addRow.unitRequired'));
      return;
    }
    setAddingRow(true);
    setAddError('');
    try {
      const payload = {
        reportDate: selectedReportDate,
        ...newRowValues,
      };
      const { data } = await axios.post(`${API_URL}/CreateWeeklyLeasingReport`, payload);
      setUploadStatus({
        severity: 'success',
        message: t('weeklyLeasingReports.addRow.success', { unit: data.unit }),
      });
      await fetchReports(data?.reportDate || selectedReportDate);
      resetNewRowForm();
      setShowAddForm(false);
    } catch (error) {
      setAddError(extractErrorMessage(error, t('weeklyLeasingReports.addRow.failed')));
    } finally {
      setAddingRow(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleReportDateChange = (event) => {
    const nextDate = event.target.value;
    setSelectedReportDate(nextDate);
    fetchReports(nextDate);
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setUploading(true);
    setUploadStatus(null);
    setRowErrors([]);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await axios.post(`${API_URL}/UploadWeeklyLeasingReport`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadStatus({
        severity: 'success',
        message: t('weeklyLeasingReports.upload.success', {
          reportDate: data?.reportDate,
          count: data?.processedCount ?? 0,
        }),
      });
      setRowErrors(data?.errors || []);
      await fetchReports(data?.reportDate);
    } catch (error) {
      setUploadStatus({
        severity: 'error',
        message: extractErrorMessage(error, t('weeklyLeasingReports.upload.failed')),
      });
      setRowErrors(error?.response?.data?.errors || []);
    } finally {
      setUploading(false);
      if (event.target) {
        // allow uploading the same file again
        event.target.value = '';
      }
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h4" component="h1">
        {t('weeklyLeasingReports.title')}
      </Typography>
      <Typography color="text.secondary">{t('weeklyLeasingReports.description')}</Typography>

      <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6">{t('weeklyLeasingReports.upload.title')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('weeklyLeasingReports.upload.helper')}
            </Typography>
          </Box>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <Button
            variant="contained"
            color="primary"
            startIcon={<CloudUploadIcon />}
            onClick={handleFileButtonClick}
            disabled={uploading}
          >
            {t('weeklyLeasingReports.upload.button')}
          </Button>
        </Stack>

        {uploading && <LinearProgress />}

        {uploadStatus && (
          <Alert severity={uploadStatus.severity} onClose={() => setUploadStatus(null)}>
            {uploadStatus.message}
          </Alert>
        )}

        {rowErrors.length > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {t('weeklyLeasingReports.upload.errors')}
            </Typography>
            <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto' }}>
              <List dense disablePadding>
                {rowErrors.map((errorItem, index) => (
                  <ListItem key={`${errorItem.rowNumber}-${index}`} divider>
                    <ListItemText
                      primary={t('weeklyLeasingReports.upload.rowError', {
                        row: errorItem.rowNumber,
                        message: errorItem.message,
                      })}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
          <FormControl sx={{ minWidth: 220 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('weeklyLeasingReports.filters.reportDate')}
            </Typography>
            <Select
              value={selectedReportDate}
              displayEmpty
              onChange={handleReportDateChange}
              disabled={!availableReportDates.length || loading}
            >
              {availableReportDates.length === 0 && (
                <MenuItem value="">
                  <em>{t('weeklyLeasingReports.filters.noReports')}</em>
                </MenuItem>
              )}
              {availableReportDates.map((date) => (
                <MenuItem key={date} value={date}>
                  {date}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label={selectedReportDate || t('weeklyLeasingReports.filters.noSelection')} color="default" />
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => fetchReports(selectedReportDate)}
              disabled={loading || !selectedReportDate}
            >
              {t('weeklyLeasingReports.actions.refresh')}
            </Button>
          </Stack>
        </Stack>

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
        >
          <Box>
            <Typography variant="subtitle1">{t('weeklyLeasingReports.addRow.title')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('weeklyLeasingReports.addRow.helper')}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => {
              setShowAddForm((prev) => !prev);
              setAddError('');
            }}
            disabled={!selectedReportDate}
          >
            {showAddForm ? t('weeklyLeasingReports.addRow.hide') : t('weeklyLeasingReports.addRow.button')}
          </Button>
        </Stack>

        {showAddForm && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Grid container spacing={2}>
              {addRowFields.map((field) => {
                const fieldType =
                  field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text';
                const gridColumns =
                  field.key === 'memo' ? 12 : field.type === 'date' || field.type === 'number' ? 6 : 12;
                return (
                  <Grid item xs={12} md={gridColumns} key={field.key}>
                    <TextField
                      label={field.label}
                      type={fieldType}
                      fullWidth
                      value={newRowValues[field.key] ?? ''}
                      onChange={(event) => handleNewRowFieldChange(field.key, event.target.value)}
                      InputLabelProps={field.type === 'date' ? { shrink: true } : undefined}
                      multiline={Boolean(field.multiline)}
                      minRows={field.rows}
                      required={Boolean(field.required)}
                      disabled={addingRow}
                    />
                  </Grid>
                );
              })}
            </Grid>
            {addError && (
              <Alert severity="error" sx={{ mt: 2 }} onClose={() => setAddError('')}>
                {addError}
              </Alert>
            )}
            <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
              <Button
                onClick={() => {
                  resetNewRowForm();
                  setShowAddForm(false);
                }}
                disabled={addingRow}
              >
                {t('common.cancel')}
              </Button>
              <Button variant="contained" onClick={handleCreateRow} disabled={addingRow}>
                {t('weeklyLeasingReports.addRow.submit')}
              </Button>
            </Stack>
          </Paper>
        )}

        {loading && <LinearProgress />}

        {errorMessage && (
          <Alert severity="error" onClose={() => setErrorMessage('')}>
            {errorMessage}
          </Alert>
        )}

        {!loading && !records.length && (
          <Typography color="text.secondary">{t('weeklyLeasingReports.empty')}</Typography>
        )}

        {records.length > 0 && (
          <>
            <Divider />
            <TableContainer sx={{ maxHeight: 600, overflowX: 'auto' }}>
              <Table size="small" stickyHeader sx={{ minWidth: 1000 }}>
                <TableHead>
                  <TableRow>
                    {columns.map((column) => (
                      <TableCell key={column.key} sx={{ whiteSpace: 'nowrap' }}>
                        {column.label}
                      </TableCell>
                    ))}
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {t('weeklyLeasingReports.table.actions')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {records.map((record) => {
                    const isEditing = editingRow?.id === record.id;
                    return (
                      <TableRow key={record.id}>
                        {columns.map((column) => {
                          const fieldConfig = editableFieldMap[column.key];
                          const isEditable = Boolean(fieldConfig);
                          const value = record[column.key];
                          const formatter = column.formatter || ((val) => (val == null || val === '' ? '—' : val));
                          return (
                            <TableCell
                              key={column.key}
                              onClick={() => handleCellClick(record, column.key)}
                              sx={{
                                cursor: isEditable ? 'text' : 'default',
                                minWidth: 150,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {isEditing && isEditable ? (
                                <TextField
                                  value={editValues[column.key] ?? ''}
                                  onChange={(event) => handleEditFieldChange(column.key, event.target.value)}
                                  type={fieldConfig.type === 'date' ? 'date' : fieldConfig.type === 'number' ? 'number' : 'text'}
                                  size="small"
                                  fullWidth
                                  autoFocus={activeFieldKey === column.key}
                                  InputLabelProps={fieldConfig.type === 'date' ? { shrink: true } : undefined}
                                  multiline={Boolean(fieldConfig.multiline)}
                                  minRows={fieldConfig.rows}
                                  inputProps={fieldConfig.type === 'number' ? { inputMode: 'decimal', step: '0.01' } : undefined}
                                />
                              ) : (
                                formatter(value)
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          {isEditing ? (
                            <Stack spacing={1} alignItems="flex-end">
                              <Stack direction="row" spacing={1}>
                                <Button size="small" onClick={handleCancelEdit} disabled={savingRowId === record.id}>
                                  {t('common.cancel')}
                                </Button>
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={handleSaveRow}
                                  disabled={savingRowId === record.id}
                                >
                                  {t('common.save')}
                                </Button>
                              </Stack>
                              {editError && (
                                <Typography variant="caption" color="error">
                                  {editError}
                                </Typography>
                              )}
                            </Stack>
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              {t('weeklyLeasingReports.table.clickToEdit')}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Paper>
    </Box>
  );
}
