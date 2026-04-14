// app/src/BuyersListView.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Typography,
  CircularProgress,
  Alert,
  Button,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Divider,
  Grid,
  Snackbar,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

const API_URL = '/api';
const SHEETS_URL = 'https://docs.google.com/spreadsheets/d/1-gTbb5a1oA9ecY159KQMWA5gGr0gDvoa_UO8tlv4whs/edit';

// ── ヘッダー行（3段）から列ラベルを生成 ──────────────────────
function buildColumnLabels(headers) {
  if (!headers || headers.length === 0) return [];
  const maxCols = Math.max(...headers.map((r) => r?.length ?? 0));
  const labels = [];
  for (let col = 0; col < maxCols; col++) {
    const parts = headers
      .map((row) => (row?.[col] != null && row[col] !== '' ? String(row[col]) : null))
      .filter(Boolean);
    // 重複を除去しつつ結合
    const unique = [...new Set(parts)];
    labels.push(unique.join(' / ') || `列${col + 1}`);
  }
  return labels;
}

// Commission sheet: 1段ヘッダー用
function buildSingleColumnLabels(headers) {
  if (!headers || headers.length === 0) return [];
  return (headers[0] || []).map((v, i) =>
    v != null && v !== '' ? String(v) : `列${i + 1}`
  );
}

// ── バイヤー編集ダイアログ ──────────────────────────────────
function BuyerEditDialog({ open, onClose, columnLabels, rowValues, rowIndex, apiEndpoint, onSaved }) {
  const [values, setValues] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      // rowValuesの長さをcolumnLabelsに合わせる
      const padded = [...(rowValues || [])];
      while (padded.length < columnLabels.length) padded.push('');
      setValues(padded);
      setError('');
    }
  }, [open, rowValues, columnLabels]);

  const handleChange = (colIdx, val) => {
    setValues((prev) => {
      const next = [...prev];
      next[colIdx] = val;
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await axios.put(`${API_URL}/${apiEndpoint}/${rowIndex}`, { values });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data || err.message || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <EditIcon fontSize="small" />
        バイヤー情報編集
        <Box sx={{ flexGrow: 1 }} />
        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Grid container spacing={2}>
          {columnLabels.map((label, idx) => (
            <Grid item xs={12} sm={6} md={4} key={idx}>
              <TextField
                label={label}
                value={values[idx] ?? ''}
                onChange={(e) => handleChange(idx, e.target.value)}
                size="small"
                fullWidth
                multiline={String(values[idx] ?? '').length > 50}
                maxRows={4}
              />
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          キャンセル
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={saving}
        >
          {saving ? '保存中...' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── データテーブル（一覧） ───────────────────────────────────
function BuyerDataTable({ columnLabels, rows, onEditRow, summaryColCount = 8 }) {
  const [searchText, setSearchText] = useState('');

  const filteredRows = useMemo(() => {
    if (!searchText.trim()) return rows;
    const q = searchText.toLowerCase();
    return rows.filter((row) =>
      row.some((cell) => String(cell ?? '').toLowerCase().includes(q))
    );
  }, [rows, searchText]);

  const summaryLabels = columnLabels.slice(0, summaryColCount);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, mt: 1 }}>
        <TextField
          placeholder="検索..."
          size="small"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ width: 280 }}
        />
        <Typography variant="body2" color="text.secondary">
          {filteredRows.length} 件
        </Typography>
      </Box>

      <TableContainer sx={{ maxHeight: 'calc(100vh - 340px)' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 48, fontWeight: 700 }}>#</TableCell>
              {summaryLabels.map((label, i) => (
                <TableCell key={i} sx={{ fontWeight: 700, whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                  {label}
                </TableCell>
              ))}
              <TableCell sx={{ fontWeight: 700, width: 60 }}>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={summaryColCount + 2} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                  {searchText ? '該当するデータが見つかりません' : 'データがありません'}
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row, rowIdx) => {
                const originalIdx = rows.indexOf(row);
                return (
                  <TableRow
                    key={rowIdx}
                    hover
                    sx={{ cursor: 'pointer', '&:last-child td': { border: 0 } }}
                    onClick={() => onEditRow(originalIdx, row)}
                  >
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                      {originalIdx + 1}
                    </TableCell>
                    {summaryLabels.map((_, colIdx) => (
                      <TableCell
                        key={colIdx}
                        sx={{
                          maxWidth: 160,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: '0.8rem',
                        }}
                      >
                        {row[colIdx] ?? ''}
                      </TableCell>
                    ))}
                    <TableCell>
                      <Tooltip title="編集">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditRow(originalIdx, row);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ── シートパネル（共通） ────────────────────────────────────
function SheetPanel({ fetchEndpoint, updateEndpoint, headerRowCount = 3, summaryColCount = 8 }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [columnLabels, setColumnLabels] = useState([]);
  const [rows, setRows] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editRowIndex, setEditRowIndex] = useState(null);
  const [editRowValues, setEditRowValues] = useState([]);
  const [snackMsg, setSnackMsg] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/${fetchEndpoint}`);
      const { headers, rows: dataRows } = res.data;
      const labels =
        headerRowCount === 1
          ? buildSingleColumnLabels(headers)
          : buildColumnLabels(headers);
      setColumnLabels(labels);
      setRows(dataRows || []);
    } catch (err) {
      setError(err.response?.data || err.message || 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [fetchEndpoint, headerRowCount]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEditRow = (rowIndex, rowValues) => {
    setEditRowIndex(rowIndex);
    setEditRowValues(rowValues);
    setEditOpen(true);
  };

  const handleSaved = () => {
    setSnackMsg('保存しました ✓');
    fetchData();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert
          severity="error"
          action={
            <Button size="small" onClick={fetchData}>
              再試行
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ px: 2, pb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1, mb: 0.5 }}>
        <Tooltip title="データを再読み込み">
          <IconButton size="small" onClick={fetchData}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <BuyerDataTable
        columnLabels={columnLabels}
        rows={rows}
        onEditRow={handleEditRow}
        summaryColCount={summaryColCount}
      />

      <BuyerEditDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        columnLabels={columnLabels}
        rowValues={editRowValues}
        rowIndex={editRowIndex}
        apiEndpoint={updateEndpoint}
        onSaved={handleSaved}
      />

      <Snackbar
        open={!!snackMsg}
        autoHideDuration={3000}
        onClose={() => setSnackMsg('')}
        message={snackMsg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}

// ── メインコンポーネント ────────────────────────────────────
export function BuyersListView() {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    {
      label: 'Buyers List（アクティブ）',
      fetchEndpoint: 'GetBuyers',
      updateEndpoint: 'UpdateBuyer',
      headerRowCount: 3,
      summaryColCount: 8,
    },
    {
      label: 'Xld（解約・取消）',
      fetchEndpoint: 'GetXldBuyers',
      updateEndpoint: 'UpdateXldBuyer',
      headerRowCount: 3,
      summaryColCount: 8,
    },
    {
      label: 'Commission & Referral',
      fetchEndpoint: 'GetCommissions',
      updateEndpoint: 'UpdateCommission',
      headerRowCount: 1,
      summaryColCount: 13,
    },
  ];

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>
          Buyers List
        </Typography>
        <Chip label="Google Sheets 連携" size="small" color="success" variant="outlined" />
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Google Sheetsで直接編集">
          <Button
            size="small"
            variant="outlined"
            startIcon={<OpenInNewIcon />}
            href={SHEETS_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Sheetsで開く
          </Button>
        </Tooltip>
      </Box>

      <Paper elevation={2} sx={{ overflow: 'hidden' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {tabs.map((tab, i) => (
              <Tab key={i} label={tab.label} />
            ))}
          </Tabs>
        </Box>

        {tabs.map((tab, i) =>
          activeTab === i ? (
            <SheetPanel
              key={tab.fetchEndpoint}
              fetchEndpoint={tab.fetchEndpoint}
              updateEndpoint={tab.updateEndpoint}
              headerRowCount={tab.headerRowCount}
              summaryColCount={tab.summaryColCount}
            />
          ) : null
        )}
      </Paper>

      <Box sx={{ mt: 1.5 }}>
        <Alert severity="info" sx={{ fontSize: '0.78rem' }}>
          <strong>編集方法：</strong> 行をクリックまたは編集アイコンをクリックして各フィールドを編集できます。
          保存するとGoogle Sheetsがリアルタイム更新され、5分以内にBoxのExcelファイルも自動更新されます。
        </Alert>
      </Box>
    </Box>
  );
}

export default BuyersListView;
