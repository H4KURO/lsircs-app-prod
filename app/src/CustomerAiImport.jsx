import { useMemo, useState } from 'react';
import axios from 'axios';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { AttachmentManager } from './AttachmentManager';
import { useTranslation } from 'react-i18next';

const API_URL = '/api';
const OWNER_FIELD = '�S����';

const INITIAL_FORM = {
  name: '',
  property: '',
  price: '',
  owner: '',
};

export function CustomerAiImport({ onCreated }) {
  const { t } = useTranslation();
  const [attachments, setAttachments] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [formValues, setFormValues] = useState(INITIAL_FORM);
  const [error, setError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const missingFields = useMemo(() => analysis?.missingFields || [], [analysis]);

  const handleAttachmentsChange = (next) => {
    setAttachments(next);
    if (next.length === 0) {
      setAnalysis(null);
      setFormValues(INITIAL_FORM);
    }
  };

  const handleAnalyze = async () => {
    if (!attachments.length) {
      setError(t('customerView.aiImport.validation.attachments'));
      return;
    }
    setIsAnalyzing(true);
    setError('');
    try {
      const { data } = await axios.post(`${API_URL}/AnalyzeCustomerDocument`, { attachments });
      setAnalysis(data);
      setFormValues({
        name: data?.extracted?.name || '',
        property: data?.extracted?.property || '',
        price:
          typeof data?.extracted?.price === 'number' && Number.isFinite(data.extracted.price)
            ? data.extracted.price
            : '',
        owner: data?.extracted?.owner || '',
      });
    } catch (err) {
      const message =
        err?.response?.data && typeof err.response.data === 'string'
          ? err.response.data
          : t('customerView.aiImport.errors.analyzeFailed');
      setError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreate = async () => {
    if (!formValues.name.trim()) {
      setError(t('customerView.aiImport.validation.name'));
      return;
    }
    setIsCreating(true);
    setError('');
    try {
      const payload = {
        name: formValues.name.trim(),
        property: formValues.property || '',
        price: Number(formValues.price) || 0,
        [OWNER_FIELD]: formValues.owner || '',
        attachments,
      };
      const { data } = await axios.post(`${API_URL}/CreateCustomer`, payload);
      onCreated?.(data);
      setAttachments([]);
      setAnalysis(null);
      setFormValues(INITIAL_FORM);
    } catch (err) {
      const message =
        err?.response?.data && typeof err.response.data === 'string'
          ? err.response.data
          : t('customerView.aiImport.errors.createFailed');
      setError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const renderSummary = () => {
    if (!analysis) {
      return null;
    }
    const severity = missingFields.length > 0 ? 'warning' : 'success';
    const summaryText =
      typeof analysis.summary === 'string' && analysis.summary.trim().length > 0
        ? analysis.summary
        : t('customerView.aiImport.summaryFallback');
    return (
      <Stack spacing={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle1">{t('customerView.aiImport.summaryTitle')}</Typography>
          {analysis?.model && <Chip size="small" label={t('customerView.aiImport.model', { model: analysis.model })} />}
        </Stack>
        <Alert severity={severity}>{summaryText}</Alert>
        {analysis.notes?.length > 0 && (
          <Stack spacing={0.5}>
            <Typography variant="subtitle2" color="text.secondary">
              {t('customerView.aiImport.notesTitle')}
            </Typography>
            <ul style={{ margin: 0, paddingInlineStart: 18 }}>
              {analysis.notes.map((note, index) => (
                <li key={index}>
                  <Typography variant="body2">{note}</Typography>
                </li>
              ))}
            </ul>
          </Stack>
        )}
        {missingFields.length > 0 && (
          <Alert severity="info" variant="outlined">
            {t('customerView.aiImport.missingFields', {
              fields: missingFields.join(', '),
            })}
          </Alert>
        )}
      </Stack>
    );
  };

  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <SmartToyIcon color="primary" />
        <Typography variant="h6">{t('customerView.aiImport.title')}</Typography>
        <Chip size="small" icon={<AutoAwesomeIcon fontSize="small" />} label="Gemini" />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('customerView.aiImport.description')}
      </Typography>

      <AttachmentManager value={attachments} onChange={handleAttachmentsChange} />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2 }}>
        <Button
          variant="contained"
          startIcon={isAnalyzing ? <CircularProgress size={16} /> : <SmartToyIcon />}
          onClick={handleAnalyze}
          disabled={isAnalyzing}
        >
          {t('customerView.aiImport.analyze')}
        </Button>
        <Button
          variant="outlined"
          color="success"
          startIcon={isCreating ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
          onClick={handleCreate}
          disabled={isCreating || !formValues.name.trim()}
        >
          {t('customerView.aiImport.create')}
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {analysis && (
        <Box sx={{ mt: 2 }}>
          <Divider sx={{ mb: 2 }} />
          {renderSummary()}
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            {t('customerView.aiImport.fieldsTitle')}
          </Typography>
          <Stack spacing={2}>
            <TextField
              label={t('customerView.aiImport.fields.name')}
              name="name"
              value={formValues.name}
              onChange={handleChange}
              fullWidth
              required
            />
            <TextField
              label={t('customerView.aiImport.fields.property')}
              name="property"
              value={formValues.property}
              onChange={handleChange}
              fullWidth
            />
            <TextField
              label={t('customerView.aiImport.fields.price')}
              name="price"
              type="number"
              value={formValues.price}
              onChange={handleChange}
              fullWidth
            />
            <TextField
              label={t('customerView.aiImport.fields.owner')}
              name="owner"
              value={formValues.owner}
              onChange={handleChange}
              fullWidth
            />
          </Stack>
        </Box>
      )}
    </Paper>
  );
}
