import axios from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
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
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import RefreshIcon from '@mui/icons-material/Refresh';
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
    ],
    [t],
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
            <Table size="small">
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell key={column.key}>{column.label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id}>
                        {columns.map((column) => {
                          const value = record[column.key];
                          const formatter = column.formatter || ((val) => (val == null || val === '' ? '—' : val));
                          return <TableCell key={column.key}>{formatter(value)}</TableCell>;
                        })}
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </>
        )}
      </Paper>
    </Box>
  );
}
