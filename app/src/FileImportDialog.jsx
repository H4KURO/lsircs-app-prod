/**
 * Shared Excel/CSV import dialog component.
 * Uses SheetJS (xlsx) to parse files in the browser, then POSTs rows to an API endpoint.
 */
import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Alert, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody,
  TextField, Chip, Divider,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

/**
 * Parse an uploaded Excel or CSV file into an array of row objects.
 * Returns { headers, rows } where each row is a plain object keyed by header name.
 */
function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (rawRows.length === 0) { resolve({ headers: [], rows: [] }); return; }
        const headers = Object.keys(rawRows[0]);
        // Normalize cell values: Date objects → YYYY-MM-DD string
        const rows = rawRows.map((r) => {
          const out = {};
          for (const [k, v] of Object.entries(r)) {
            if (v instanceof Date) {
              out[k] = v.toISOString().split('T')[0];
            } else {
              out[k] = v === null || v === undefined ? '' : String(v);
            }
          }
          return out;
        });
        resolve({ headers, rows });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Props:
 *  open, onClose, onImported — standard dialog props
 *  title — dialog heading
 *  apiEndpoint — POST endpoint URL (e.g. '/api/ImportPropertiesFromFile')
 *  extraPayload — extra fields merged into the POST body (e.g. { sheetTab: 'シート1' })
 *  columnGuide — JSX or string shown as column name reference
 *  extraFields — array of { label, stateKey, placeholder } for extra inputs before import
 *  buildExtraPayload — (extraState) => object merged into POST body
 */
export function FileImportDialog({
  open, onClose, onImported,
  title,
  apiEndpoint,
  columnGuide,
  extraFields = [],
  buildExtraPayload,
}) {
  const [parsed, setParsed] = useState(null); // { headers, rows }
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [extraState, setExtraState] = useState({});
  const fileRef = useRef();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');
    setImportResult(null);
    setParsed(null);
    setFileName(file.name);
    try {
      const result = await parseFile(file);
      if (result.rows.length === 0) {
        setParseError('データ行が見つかりませんでした。ヘッダー行の次から1行以上のデータが必要です。');
        return;
      }
      setParsed(result);
    } catch (err) {
      setParseError(err.message || 'ファイルの解析に失敗しました');
    }
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!parsed) return;
    setImporting(true);
    setImportResult(null);
    try {
      const extra = buildExtraPayload ? buildExtraPayload(extraState) : {};
      const res = await axios.post(apiEndpoint, { rows: parsed.rows, ...extra });
      setImportResult(res.data);
      if (res.data?.success) onImported?.();
    } catch (e) {
      setImportResult({ success: false, error: e.response?.data || e.message || 'インポートに失敗しました' });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setParsed(null);
    setFileName('');
    setParseError('');
    setImportResult(null);
    setExtraState({});
    onClose();
  };

  const previewRows = parsed?.rows.slice(0, 5) || [];
  const previewHeaders = parsed?.headers.slice(0, 8) || [];

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>

        {/* Extra fields (e.g. タブ名) */}
        {extraFields.map((f) => (
          <TextField
            key={f.stateKey}
            size="small"
            label={f.label}
            placeholder={f.placeholder || ''}
            value={extraState[f.stateKey] || ''}
            onChange={(e) => setExtraState((prev) => ({ ...prev, [f.stateKey]: e.target.value }))}
          />
        ))}

        {/* File picker */}
        <Box
          sx={{
            border: '2px dashed', borderColor: 'divider', borderRadius: 2,
            p: 3, textAlign: 'center', cursor: 'pointer',
            '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
          }}
          onClick={() => fileRef.current?.click()}
        >
          <UploadFileIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            クリックしてファイルを選択（.xlsx / .csv）
          </Typography>
          {fileName && (
            <Chip label={fileName} size="small" sx={{ mt: 1 }} />
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </Box>

        {parseError && <Alert severity="error">{parseError}</Alert>}

        {/* Preview */}
        {parsed && (
          <Box>
            <Typography variant="body2" fontWeight={600} mb={0.5}>
              プレビュー（先頭 {Math.min(5, parsed.rows.length)} 行 / 全 {parsed.rows.length} 行）
            </Typography>
            <Box sx={{ overflowX: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {previewHeaders.map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 600, whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{h}</TableCell>
                    ))}
                    {parsed.headers.length > 8 && <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>…</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewRows.map((row, i) => (
                    <TableRow key={i}>
                      {previewHeaders.map((h) => (
                        <TableCell key={h} sx={{ fontSize: '0.75rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row[h]}
                        </TableCell>
                      ))}
                      {parsed.headers.length > 8 && <TableCell />}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Box>
        )}

        {importResult && (
          <Alert severity={importResult.success ? 'success' : 'error'}>
            {importResult.success
              ? `${importResult.imported} 件をインポートしました（スキップ: ${importResult.skipped} 件）`
              : (importResult.error || 'インポートに失敗しました')}
            {importResult.errors?.length > 0 && (
              <Box mt={0.5}>
                {importResult.errors.map((e, i) => <div key={i}>{e}</div>)}
              </Box>
            )}
          </Alert>
        )}

        {/* Column guide */}
        {columnGuide && (
          <>
            <Divider />
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.5}>
                使用できる列名
              </Typography>
              <Typography variant="caption" color="text.secondary" component="div">
                {columnGuide}
              </Typography>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>閉じる</Button>
        <Button
          variant="contained"
          startIcon={importing ? <CircularProgress size={16} color="inherit" /> : <CloudUploadIcon />}
          onClick={handleImport}
          disabled={importing || !parsed}
        >
          {importing ? 'インポート中...' : `インポート実行（${parsed?.rows.length ?? 0}件）`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
