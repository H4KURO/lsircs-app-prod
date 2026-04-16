// app/src/PdfImportDialog.jsx
import { useState, useRef } from 'react';
import axios from 'axios';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, CircularProgress, Alert,
  FormControl, InputLabel, Select, MenuItem,
  TextField, Grid, Chip, Divider, LinearProgress,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const API_URL = '/api';

const DOCUMENT_TYPES = [
  { id: 'APPOINTMENT_FORM', label: 'Appointment Request Form', labelJa: 'アポイントメント申請フォーム' },
  { id: 'PREFERENCE_FORM',  label: 'Residence Preference Form', labelJa: '居住希望フォーム' },
];

const STEP_SELECT   = 'select';
const STEP_EXTRACT  = 'extract';
const STEP_CONFIRM  = 'confirm';
const STEP_DONE     = 'done';

export function PdfImportDialog({ open, onClose, onImported }) {
  const [step, setStep]               = useState(STEP_SELECT);
  const [documentTypeId, setDocumentTypeId] = useState('APPOINTMENT_FORM');
  const [file, setFile]               = useState(null);
  const [extracting, setExtracting]   = useState(false);
  const [extractError, setExtractError] = useState('');
  const [extractedData, setExtractedData] = useState(null);  // { documentType, fields }
  const [editedFields, setEditedFields]   = useState({});
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState('');
  const fileInputRef = useRef(null);

  const handleClose = () => {
    setStep(STEP_SELECT);
    setFile(null);
    setExtractedData(null);
    setEditedFields({});
    setExtractError('');
    setSubmitError('');
    onClose();
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f && f.type === 'application/pdf') {
      setFile(f);
      setExtractError('');
    } else {
      setExtractError('PDFファイルを選択してください。');
    }
  };

  const handleExtract = async () => {
    if (!file) { setExtractError('PDFファイルを選択してください。'); return; }
    setExtracting(true);
    setExtractError('');
    try {
      // PDFをbase64に変換
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          // data:application/pdf;base64,XXXX → XXXXのみ取り出す
          const result = reader.result;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await axios.post(`${API_URL}/PdfExtract`, { base64, documentTypeId });
      const data = res.data;
      setExtractedData(data);
      // editedFields を初期化
      const initial = {};
      data.documentType.extractFields.forEach((f) => {
        initial[f.key] = data.fields[f.key] ?? '';
      });
      setEditedFields(initial);
      setStep(STEP_CONFIRM);
    } catch (err) {
      setExtractError(err.response?.data || err.message || 'PDF読み込みに失敗しました。');
    } finally {
      setExtracting(false);
    }
  };

  const handleFieldChange = (key, value) => {
    setEditedFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const docType = extractedData.documentType;
      const sourceLabel = DOCUMENT_TYPES.find((d) => d.id === docType.id)?.labelJa ?? docType.label;

      // フィールドキーをAPIの期待するキーにマッピング
      const payload = {
        source: sourceLabel,
        ...editedFields,
      };

      await axios.post(`${API_URL}/CreateMahanaProspect`, payload);
      setStep(STEP_DONE);
      onImported?.();
    } catch (err) {
      setSubmitError(err.response?.data || err.message || '登録に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  const renderSelectStep = () => (
    <Box sx={{ pt: 1 }}>
      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel>ドキュメント種別</InputLabel>
        <Select
          value={documentTypeId}
          label="ドキュメント種別"
          onChange={(e) => setDocumentTypeId(e.target.value)}
        >
          {DOCUMENT_TYPES.map((dt) => (
            <MenuItem key={dt.id} value={dt.id}>
              <Box>
                <Typography variant="body2">{dt.labelJa}</Typography>
                <Typography variant="caption" color="text.secondary">{dt.label}</Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box
        onClick={() => fileInputRef.current?.click()}
        sx={{
          border: '2px dashed',
          borderColor: file ? 'success.main' : 'divider',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          cursor: 'pointer',
          bgcolor: file ? 'success.50' : 'background.default',
          '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
          transition: 'all 0.2s',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        {file ? (
          <>
            <PictureAsPdfIcon color="success" sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="body1" fontWeight={600} color="success.main">{file.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {(file.size / 1024).toFixed(0)} KB — クリックで変更
            </Typography>
          </>
        ) : (
          <>
            <UploadFileIcon color="disabled" sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="body1" color="text.secondary">PDFをクリックして選択</Typography>
            <Typography variant="caption" color="text.secondary">対応形式: PDF（最大20MB）</Typography>
          </>
        )}
      </Box>

      {extractError && <Alert severity="error" sx={{ mt: 2 }}>{extractError}</Alert>}
      {extracting && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            AI処理中（Claude PDF読み取り中）...
          </Typography>
          <LinearProgress />
        </Box>
      )}
    </Box>
  );

  const renderConfirmStep = () => {
    if (!extractedData) return null;
    const { documentType, fields } = extractedData;
    const sourceLabel = DOCUMENT_TYPES.find((d) => d.id === documentType.id)?.labelJa ?? documentType.label;

    return (
      <Box sx={{ pt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Chip label={sourceLabel} color="primary" size="small" />
          <Typography variant="caption" color="text.secondary">
            抽出結果を確認・編集してから登録してください
          </Typography>
        </Box>

        <Grid container spacing={2}>
          {documentType.extractFields.map((fieldDef) => (
            <Grid item xs={12} sm={6} key={fieldDef.key}>
              <TextField
                fullWidth
                size="small"
                label={fieldDef.label}
                value={editedFields[fieldDef.key] ?? ''}
                onChange={(e) => handleFieldChange(fieldDef.key, e.target.value)}
                helperText={`→ 列 ${fieldDef.targetColumn}`}
                multiline={fieldDef.key === 'additionalNotes' || fieldDef.key === 'notes'}
                rows={fieldDef.key === 'additionalNotes' ? 2 : 1}
              />
            </Grid>
          ))}
        </Grid>

        <Divider sx={{ my: 2 }} />
        <Box sx={{ bgcolor: 'info.50', borderRadius: 1, p: 1.5 }}>
          <Typography variant="caption" color="info.main">
            🔒 抽出された個人情報はこの画面にのみ表示されます。「登録」ボタンを押すまでGoogle Sheetsには保存されません。
          </Typography>
        </Box>

        {submitError && <Alert severity="error" sx={{ mt: 1 }}>{submitError}</Alert>}
      </Box>
    );
  };

  const renderDoneStep = () => (
    <Box sx={{ textAlign: 'center', py: 3 }}>
      <CheckCircleIcon color="success" sx={{ fontSize: 64, mb: 2 }} />
      <Typography variant="h6" gutterBottom>登録完了</Typography>
      <Typography variant="body2" color="text.secondary">
        Mahana Prospectsに正常に登録されました。
      </Typography>
    </Box>
  );

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        📄 PDF読み込み → Mahana Prospects登録
      </DialogTitle>

      <DialogContent dividers>
        {step === STEP_SELECT  && renderSelectStep()}
        {step === STEP_CONFIRM && renderConfirmStep()}
        {step === STEP_DONE    && renderDoneStep()}
      </DialogContent>

      <DialogActions>
        {step === STEP_SELECT && (
          <>
            <Button onClick={handleClose}>キャンセル</Button>
            <Button
              variant="contained"
              onClick={handleExtract}
              disabled={!file || extracting}
              startIcon={extracting ? <CircularProgress size={16} /> : null}
            >
              {extracting ? '読み込み中...' : 'AIで読み込む'}
            </Button>
          </>
        )}
        {step === STEP_CONFIRM && (
          <>
            <Button onClick={() => setStep(STEP_SELECT)}>戻る</Button>
            <Button onClick={handleClose}>キャンセル</Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleSubmit}
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={16} /> : null}
            >
              {submitting ? '登録中...' : 'Prospectsに登録'}
            </Button>
          </>
        )}
        {step === STEP_DONE && (
          <Button variant="contained" onClick={handleClose}>閉じる</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
