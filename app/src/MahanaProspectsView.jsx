// app/src/MahanaProspectsView.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  Box, Paper, Typography, CircularProgress, Alert, Button,
  IconButton, Tooltip, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, Select, MenuItem, FormControl, InputLabel, Snackbar,
  Divider,
} from '@mui/material';
import RefreshIcon    from '@mui/icons-material/Refresh';
import SearchIcon     from '@mui/icons-material/Search';
import EditIcon       from '@mui/icons-material/Edit';
import SaveIcon       from '@mui/icons-material/Save';
import CloseIcon      from '@mui/icons-material/Close';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TransferWithinAStationIcon from '@mui/icons-material/TransferWithinAStation';
import OpenInNewIcon  from '@mui/icons-material/OpenInNew';
import { PdfImportDialog } from './PdfImportDialog';

const API_URL = '/api';
const SHEETS_URL = 'https://docs.google.com/spreadsheets/d/1-gTbb5a1oA9ecY159KQMWA5gGr0gDvoa_UO8tlv4whs/edit#gid=0';

// 列定義（A〜W = 23列）
const COLUMNS = [
  { key: 'no',               label: 'No.',          col: 'A', width: 60 },
  { key: 'registrationDate', label: '登録日',        col: 'B', width: 100 },
  { key: 'source',           label: 'ソース',        col: 'C', width: 140 },
  { key: 'status',           label: 'ステータス',    col: 'D', width: 120 },
  { key: 'name',             label: '氏名',          col: 'E', width: 140 },
  { key: 'email',            label: 'Email',         col: 'F', width: 180 },
  { key: 'phone',            label: '電話番号',      col: 'G', width: 130 },
  { key: 'country',          label: '国',            col: 'H', width: 80  },
  { key: 'state',            label: '地域',          col: 'I', width: 100 },
  { key: 'buildingPref',     label: '希望物件',      col: 'J', width: 120 },
  { key: 'bedrooms',         label: '希望間取り',    col: 'K', width: 100 },
  { key: 'stacks',           label: '希望スタック',  col: 'L', width: 120 },
  { key: 'floorRange',       label: '希望フロア帯',  col: 'M', width: 120 },
  { key: 'tourType',         label: 'ツアー種別',    col: 'N', width: 120 },
  { key: 'appointmentDate',  label: 'アポイント日',  col: 'O', width: 110 },
  { key: 'firstAppt',        label: '初回',          col: 'P', width: 70  },
  { key: 'howHeard',         label: '情報源',        col: 'Q', width: 120 },
  { key: 'brokerName',       label: 'ブローカー名',  col: 'R', width: 130 },
  { key: 'brokerEmail',      label: 'ブローカーEmail',col:'S', width: 180 },
  { key: 'brokerPhone',      label: 'ブローカー電話',col: 'T', width: 130 },
  { key: 'brokerCompany',    label: 'ブローカー会社',col: 'U', width: 150 },
  { key: 'salesExec',        label: '担当セールス',  col: 'V', width: 120 },
  { key: 'notes',            label: '備考',          col: 'W', width: 200 },
];

const STATUS_OPTIONS = ['Lead', 'Tour済', 'Preference提出', '検討中', '契約', '見送り', '移行済'];
const SUMMARY_COLS = 7; // 一覧で表示する列数（No.〜氏名+Email+Phone+Status）

const statusColor = (status) => {
  const map = {
    'Lead': 'default', 'Tour済': 'info', 'Preference提出': 'primary',
    '検討中': 'warning', '契約': 'success', '見送り': 'error', '移行済': 'secondary',
  };
  return map[status] ?? 'default';
};

function rowToObj(row) {
  const obj = {};
  COLUMNS.forEach((col, i) => { obj[col.key] = row[i] ?? ''; });
  return obj;
}

function objToRow(obj) {
  return COLUMNS.map((col) => obj[col.key] ?? '');
}

// ── 編集ダイアログ ──────────────────────────────────────────────
function EditDialog({ open, rowIndex, rowData, onClose, onSaved }) {
  const [values, setValues] = useState({});
  const [saving, setSaving]  = useState(false);
  const [error, setError]    = useState('');

  useEffect(() => {
    if (rowData) setValues({ ...rowData });
  }, [rowData]);

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await axios.post(`${API_URL}/UpdateMahanaProspect`, {
        rowIndex,
        values: objToRow(values),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e.response?.data || e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!rowData) return null;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        編集 — {rowData.name || `No.${rowData.no}`}
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          {COLUMNS.map((col) => (
            col.key === 'no' || col.key === 'registrationDate' ? null : (
              <Grid item xs={12} sm={col.key === 'notes' ? 12 : 6} key={col.key}>
                {col.key === 'status' ? (
                  <FormControl fullWidth size="small">
                    <InputLabel>ステータス</InputLabel>
                    <Select
                      value={values.status ?? ''}
                      label="ステータス"
                      onChange={(e) => setValues((p) => ({ ...p, status: e.target.value }))}
                    >
                      {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </Select>
                  </FormControl>
                ) : (
                  <TextField
                    fullWidth size="small"
                    label={col.label}
                    value={values[col.key] ?? ''}
                    onChange={(e) => setValues((p) => ({ ...p, [col.key]: e.target.value }))}
                    multiline={col.key === 'notes'}
                    rows={col.key === 'notes' ? 3 : 1}
                  />
                )}
              </Grid>
            )
          ))}
        </Grid>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} startIcon={<CloseIcon />}>キャンセル</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}>
          {saving ? '保存中...' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── バイヤーリスト移行ダイアログ ────────────────────────────────
function ConvertToBuyerDialog({ open, rowData, rowIndex, onClose, onConverted }) {
  const [converting, setConverting] = useState(false);

  const handleConvert = async () => {
    setConverting(true);
    try {
      // ステータスを「移行済」に更新
      const updated = { ...rowData, status: '移行済' };
      await axios.post(`${API_URL}/UpdateMahanaProspect`, {
        rowIndex,
        values: objToRow(updated),
      });
      onConverted();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setConverting(false);
    }
  };

  if (!rowData) return null;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>🏠 Mahana Buyers Listへ移行</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>
            <strong>{rowData.name}</strong> をProspectsから移行します。
          </Typography>
          <Typography variant="caption">
            現在このProspectのステータスを「移行済」に変更します。
            Mahana Buyers List（次プロジェクト用シート）が作成された際に、
            このデータを自動で連携できるよう設計されています。
          </Typography>
        </Alert>

        <Box sx={{ bgcolor: 'grey.50', borderRadius: 1, p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>移行する顧客情報</Typography>
          <Grid container spacing={1}>
            {[
              ['氏名', rowData.name], ['Email', rowData.email], ['電話', rowData.phone],
              ['国', rowData.country], ['希望物件', rowData.buildingPref],
              ['希望間取り', rowData.bedrooms], ['希望スタック', rowData.stacks],
            ].map(([label, value]) => value ? (
              <Grid item xs={6} key={label}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography variant="body2">{value}</Typography>
              </Grid>
            ) : null)}
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button variant="contained" color="success" onClick={handleConvert} disabled={converting}
          startIcon={converting ? <CircularProgress size={16} /> : <TransferWithinAStationIcon />}>
          {converting ? '処理中...' : '移行済にする'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── メインビュー ────────────────────────────────────────────────
export function MahanaProspectsView() {
  const [rows, setRows]             = useState([]);
  const [headers, setHeaders]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pdfDialogOpen, setPdfDialogOpen]   = useState(false);
  const [editTarget, setEditTarget]         = useState(null); // { rowIndex, rowData }
  const [convertTarget, setConvertTarget]   = useState(null);
  const [snackbar, setSnackbar]             = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await axios.get(`${API_URL}/GetMahanaProspects`);
      setHeaders(res.data.headers ?? []);
      setRows(res.data.rows ?? []);
    } catch (e) {
      setError(e.response?.data || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const prospectRows = useMemo(() => {
    return rows
      .map((row, i) => ({ ...rowToObj(row), _rowIndex: i }))
      .filter((p) => {
        const matchSearch = !searchText ||
          Object.values(p).some((v) => String(v).toLowerCase().includes(searchText.toLowerCase()));
        const matchStatus = !statusFilter || p.status === statusFilter;
        return matchSearch && matchStatus;
      });
  }, [rows, searchText, statusFilter]);

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          🏠 Mahana Prospects
          {rows.length > 0 && (
            <Chip label={`${rows.length}件`} size="small" sx={{ ml: 1 }} />
          )}
        </Typography>

        <Button
          variant="contained"
          startIcon={<PictureAsPdfIcon />}
          onClick={() => setPdfDialogOpen(true)}
          size="small"
        >
          PDFから登録
        </Button>

        <Tooltip title="Google Sheetsで開く">
          <IconButton size="small" onClick={() => window.open(SHEETS_URL, '_blank')}>
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="更新">
          <IconButton size="small" onClick={fetchData} disabled={loading}>
            {loading ? <CircularProgress size={20} /> : <RefreshIcon />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* フィルター */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="氏名・Email・ブローカー名で検索..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ minWidth: 260 }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>ステータス</InputLabel>
          <Select value={statusFilter} label="ステータス" onChange={(e) => setStatusFilter(e.target.value)}>
            <MenuItem value="">すべて</MenuItem>
            {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* テーブル */}
      <Paper elevation={2}>
        <TableContainer sx={{ maxHeight: 'calc(100vh - 260px)', overflowX: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {COLUMNS.slice(0, SUMMARY_COLS).map((col) => (
                  <TableCell key={col.key} sx={{ fontWeight: 700, minWidth: col.width, whiteSpace: 'nowrap' }}>
                    {col.label}
                  </TableCell>
                ))}
                <TableCell sx={{ fontWeight: 700, minWidth: 80 }}>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={SUMMARY_COLS + 1} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              )}
              {!loading && prospectRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={SUMMARY_COLS + 1} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">データがありません</Typography>
                  </TableCell>
                </TableRow>
              )}
              {prospectRows.map((p) => (
                <TableRow key={p._rowIndex} hover sx={{ opacity: p.status === '移行済' ? 0.6 : 1 }}>
                  <TableCell>{p.no}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{p.registrationDate}</TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>{p.source}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={p.status || 'Lead'} size="small" color={statusColor(p.status)} />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 500 }}>{p.name}</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem' }}>{p.email}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{p.phone}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="編集">
                        <IconButton size="small" onClick={() => setEditTarget({ rowIndex: p._rowIndex, rowData: p })}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {p.status !== '移行済' && (
                        <Tooltip title="Buyers Listへ移行">
                          <IconButton size="small" color="success"
                            onClick={() => setConvertTarget({ rowIndex: p._rowIndex, rowData: p })}>
                            <TransferWithinAStationIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* PDF読み込みダイアログ */}
      <PdfImportDialog
        open={pdfDialogOpen}
        onClose={() => setPdfDialogOpen(false)}
        onImported={() => { fetchData(); setSnackbar('Prospectsに登録しました！'); }}
      />

      {/* 編集ダイアログ */}
      <EditDialog
        open={!!editTarget}
        rowIndex={editTarget?.rowIndex}
        rowData={editTarget?.rowData}
        onClose={() => setEditTarget(null)}
        onSaved={() => { fetchData(); setSnackbar('保存しました！'); }}
      />

      {/* 移行ダイアログ */}
      <ConvertToBuyerDialog
        open={!!convertTarget}
        rowIndex={convertTarget?.rowIndex}
        rowData={convertTarget?.rowData}
        onClose={() => setConvertTarget(null)}
        onConverted={() => { fetchData(); setSnackbar('移行済に変更しました！'); }}
      />

      <Snackbar
        open={!!snackbar} autoHideDuration={3000}
        onClose={() => setSnackbar('')} message={snackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
