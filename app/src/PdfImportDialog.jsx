// app/src/PdfImportDialog.jsx
import { useState, useRef } from 'react';
import axios from 'axios';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, CircularProgress, Alert,
  FormControl, InputLabel, Select, MenuItem,
  TextField, Grid, Chip, Divider, LinearProgress,
  Card, CardContent, CardHeader, IconButton, Collapse,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DeleteIcon from '@mui/icons-material/Delete';

const API_URL = '/api';

const DOCUMENT_TYPES = [
  { id: 'APPOINTMENT_FORM', label: 'Appointment Request Form', labelJa: 'アポイントメント申請フォーム' },
  { id: 'PREFERENCE_FORM',  label: 'Residence Preference Form', labelJa: '居住希望フォーム' },
];

const STEP_SELECT  = 'select';
const STEP_EXTRACT = 'extract';
const STEP_CONFIRM = 'confirm';
const STEP_DONE    = 'done';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 1件分の確認カード
function ResultCard({ index, file, result, editedFields, onFieldChange, defaultExpanded }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasError = !!result.error;

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 1.5,
        borderColor: hasError ? 'error.main' : 'divider',
      }}
    >
      <CardHeader
        avatar={
          hasError
            ? <ErrorIcon color="error" />
            : <CheckCircleIcon color="success" />
        }
        title={
          <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 320 }}>
            {file.name}
          </Typography>
        }
        subheader={
          hasError
            ? <Typography variant="caption" color="error">{result.error}</Typography>
            : <Typography variant="caption" color="text.secondary">抽出済み — 編集可能</Typography>
        }
        action={
          !hasError && (
            <IconButton size="small" onClick={() => setExpanded((v) => !v)}>
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )
        }
        sx={{ pb: expanded ? 0 : 1 }}
      />
      {!hasError && (
        <Collapse in={expanded}>
          <CardContent sx={{ pt: 1 }}>
            <Grid container spacing={1.5}>
              {result.data.documentType.extractFields.map((fieldDef) => (
                <Grid item xs={12} sm={6} key={fieldDef.key}>
                  <TextField
                    fullWidth
                    size="small"
                    label={fieldDef.label}
                    value={editedFields[fieldDef.key] ?? ''}
                    onChange={(e) => onFieldChange(index, fieldDef.key, e.target.value)}
                    helperText={`→ 列 ${fieldDef.targetColumn}`}
                    multiline={fieldDef.key === 'additionalNotes' || fieldDef.key === 'notes'}
                    rows={fieldDef.key === 'additionalNotes' ? 2 : 1}
                  />
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Collapse>
      )}
    </Card>
  );
}

export function PdfImportDialog({ open, onClose, onImported }) {
  const [step, setStep]                   = useState(STEP_SELECT);
  const [documentTypeId, setDocumentTypeId] = useState('APPOINTMENT_FORM');
  const [files, setFiles]                 = useState([]);  // File[]
  const [extracting, setExtracting]       = useState(false);
  const [extractError, setExtractError]   = useState('');
  const [extractProgress, setExtractProgress] = useState({ current: 0, total: 0 });
  const [extractResults, setExtractResults]   = useState([]);  // [{file, data, error}]
  const [editedFieldsList, setEditedFieldsList] = useState([]); // per-file field maps
  const [submitting, setSubmitting]       = useState(false);
  const [submitError, setSubmitError]     = useState('');
  const [doneCount, setDoneCount]         = useState(0);
  const fileInputRef = useRef(null);

  const handleClose = () => {
    setStep(STEP_SELECT);
    setFiles([]);
    setExtractResults([]);
    setEditedFieldsList([]);
    setExtractError('');
    setSubmitError('');
    setExtractProgress({ current: 0, total: 0 });
    onClose();
  };

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []).filter(
      (f) => f.type === 'application/pdf',
    );
    if (selected.length === 0) {
      setExtractError('PDFファイルを選択してください。');
      return;
    }
    setFiles(selected);
    setExtractError('');
  };

  const handleRemoveFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleExtract = async () => {
    if (files.length === 0) { setExtractError('PDFファイルを選択してください。'); return; }
    setExtracting(true);
    setExtractError('');
    setExtractProgress({ current: 0, total: files.length });

    const results = [];
    for (let i = 0; i < files.length; i++) {
      setExtractProgress({ current: i + 1, total: files.length });
      try {
        const base64 = await fileToBase64(files[i]);
        const res = await axios.post(`${API_URL}/PdfExtract`, { base64, documentTypeId });
        results.push({ file: files[i], data: res.data, error: null });
      } catch (err) {
        results.push({
          file: files[i],
          data: null,
          error: err.response?.data || err.message || 'PDF読み込みに失敗しました。',
        });
      }
    }

    // editedFieldsList を初期化
    const initialList = results.map((r) => {
      if (!r.data) return {};
      const init = {};
      r.data.documentType.extractFields.forEach((f) => {
        init[f.key] = r.data.fields[f.key] ?? '';
      });
      return init;
    });

    setExtractResults(results);
    setEditedFieldsList(initialList);
    setExtracting(false);
    setStep(STEP_CONFIRM);
  };

  const handleFieldChange = (fileIndex, key, value) => {
    setEditedFieldsList((prev) => {
      const next = [...prev];
      next[fileIndex] = { ...next[fileIndex], [key]: value };
      return next;
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');
    let count = 0;

    for (let i = 0; i < extractResults.length; i++) {
      const result = extractResults[i];
      if (!result.data) continue; // エラー件はスキップ

      try {
        const docType = result.data.documentType;
        const sourceLabel = DOCUMENT_TYPES.find((d) => d.id === docType.id)?.labelJa ?? docType.label;
        const payload = { source: sourceLabel, ...editedFieldsList[i] };
        await axios.post(`${API_URL}/CreateMahanaProspect`, payload);
        count++;
      } catch (err) {
        setSubmitError(
          (prev) => (prev ? prev + '\n' : '') +
            `${result.file.name}: ${err.response?.data || err.message}`,
        );
      }
    }

    setDoneCount(count);
    setSubmitting(false);
    if (count > 0) {
      setStep(STEP_DONE);
      onImported?.();
    }
  };

  // ── ステップ別レンダリング ─────────────────────────────────

  const renderSelectStep = () => {
    const successCount = files.length;
    return (
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

        {/* ドロップゾーン */}
        <Box
          onClick={() => fileInputRef.current?.click()}
          sx={{
            border: '2px dashed',
            borderColor: successCount > 0 ? 'success.main' : 'divider',
            borderRadius: 2,
            p: 3,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: successCount > 0 ? 'success.50' : 'background.default',
            '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
            transition: 'all 0.2s',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          {successCount > 0 ? (
            <>
              <PictureAsPdfIcon color="success" sx={{ fontSize: 40, mb: 0.5 }} />
              <Typography variant="body2" fontWeight={600} color="success.main">
                {successCount}件のPDFを選択済み — クリックで変更
              </Typography>
            </>
          ) : (
            <>
              <UploadFileIcon color="disabled" sx={{ fontSize: 40, mb: 0.5 }} />
              <Typography variant="body2" color="text.secondary">クリックしてPDFを選択（複数可）</Typography>
              <Typography variant="caption" color="text.secondary">対応形式: PDF（1ファイル最大20MB）</Typography>
            </>
          )}
        </Box>

        {/* 選択済みファイル一覧 */}
        {files.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            {files.map((f, i) => (
              <Box
                key={i}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  px: 1.5, py: 0.5, borderRadius: 1,
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <PictureAsPdfIcon fontSize="small" color="error" />
                <Typography variant="body2" sx={{ flexGrow: 1 }} noWrap>{f.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {(f.size / 1024).toFixed(0)} KB
                </Typography>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleRemoveFile(i); }}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}

        {extractError && <Alert severity="error" sx={{ mt: 2 }}>{extractError}</Alert>}

        {extracting && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              AI処理中（Claude PDF読み取り中）... {extractProgress.current}/{extractProgress.total}件
            </Typography>
            <LinearProgress
              variant="determinate"
              value={(extractProgress.current / extractProgress.total) * 100}
            />
          </Box>
        )}
      </Box>
    );
  };

  const renderConfirmStep = () => {
    const successCount = extractResults.filter((r) => !r.error).length;
    const errorCount   = extractResults.filter((r) => r.error).length;

    return (
      <Box sx={{ pt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {successCount > 0 && <Chip label={`${successCount}件 抽出成功`} color="success" size="small" />}
          {errorCount   > 0 && <Chip label={`${errorCount}件 エラー`}   color="error"   size="small" />}
          <Typography variant="caption" color="text.secondary">
            抽出結果を確認・編集してから登録してください
          </Typography>
        </Box>

        {extractResults.map((result, i) => (
          <ResultCard
            key={i}
            index={i}
            file={result.file}
            result={result}
            editedFields={editedFieldsList[i] || {}}
            onFieldChange={handleFieldChange}
            defaultExpanded={extractResults.length === 1}
          />
        ))}

        <Divider sx={{ my: 2 }} />
        <Box sx={{ bgcolor: 'info.50', borderRadius: 1, p: 1.5 }}>
          <Typography variant="caption" color="info.main">
            🔒 抽出された個人情報はこの画面にのみ表示されます。「登録」ボタンを押すまでGoogle Sheetsには保存されません。
          </Typography>
        </Box>

        {submitError && <Alert severity="error" sx={{ mt: 1, whiteSpace: 'pre-line' }}>{submitError}</Alert>}
      </Box>
    );
  };

  const renderDoneStep = () => (
    <Box sx={{ textAlign: 'center', py: 3 }}>
      <CheckCircleIcon color="success" sx={{ fontSize: 64, mb: 2 }} />
      <Typography variant="h6" gutterBottom>登録完了</Typography>
      <Typography variant="body2" color="text.secondary">
        {doneCount}件をMahana Prospectsに登録しました。
      </Typography>
    </Box>
  );

  const successCount = extractResults.filter((r) => !r.error).length;

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
              disabled={files.length === 0 || extracting}
              startIcon={extracting ? <CircularProgress size={16} /> : null}
            >
              {extracting
                ? `読み込み中... ${extractProgress.current}/${extractProgress.total}`
                : files.length > 1 ? `${files.length}件をAIで読み込む` : 'AIで読み込む'}
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
              disabled={submitting || successCount === 0}
              startIcon={submitting ? <CircularProgress size={16} /> : null}
            >
              {submitting
                ? '登録中...'
                : successCount > 1 ? `${successCount}件を一括登録` : 'Prospectsに登録'}
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
