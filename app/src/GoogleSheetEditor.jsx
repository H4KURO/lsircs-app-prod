import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Typography,
  Toolbar,
  Tooltip,
  Alert,
  Snackbar,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import axios from 'axios';

/**
 * Google Sheets の特定シートタブを編集できるコンポーネント
 * Props:
 *   spreadsheetId  - Google Spreadsheet の ID (URL の /d/{ID}/ 部分)
 *   sheetTab       - シートタブ名 (省略可: 省略時は最初のシート)
 */
export default function GoogleSheetEditor({ spreadsheetId, sheetTab }) {
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 編集ダイアログ
  const [editingRow, setEditingRow] = useState(null);      // 編集中の行 (null = 非表示)
  const [editFormData, setEditFormData] = useState({});

  // 追加ダイアログ
  const [addingRow, setAddingRow] = useState(false);
  const [newRowData, setNewRowData] = useState({});

  // 削除確認ダイアログ
  const [confirmDelete, setConfirmDelete] = useState(null); // 削除対象の行 (null = 非表示)

  // スナックバー
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const fetchData = useCallback(async () => {
    if (!spreadsheetId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ spreadsheetId });
      if (sheetTab) params.set('sheetTab', sheetTab);
      const response = await axios.get(`/api/GetSheetData?${params.toString()}`);
      setHeaders(response.data.headers || []);
      setRows(response.data.rows || []);
    } catch (error) {
      const msg = error.response?.data || error.message || 'データの取得に失敗しました';
      showSnackbar(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [spreadsheetId, sheetTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- 編集 ----
  const handleOpenEdit = (row) => {
    setEditingRow(row);
    const data = {};
    headers.forEach((h) => { data[h] = row[h] || ''; });
    setEditFormData(data);
  };

  const handleCloseEdit = () => {
    setEditingRow(null);
    setEditFormData({});
  };

  const handleSaveEdit = async () => {
    if (!editingRow) return;
    setSaving(true);
    try {
      const values = headers.map((h) => editFormData[h] ?? '');
      await axios.put('/api/UpdateSheetRow', {
        spreadsheetId,
        sheetTab: sheetTab || '',
        rowIndex: editingRow._rowIndex,
        values,
      });
      showSnackbar('更新しました', 'success');
      handleCloseEdit();
      await fetchData();
    } catch (error) {
      const msg = error.response?.data || error.message || '更新に失敗しました';
      showSnackbar(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ---- 追加 ----
  const handleOpenAdd = () => {
    const data = {};
    headers.forEach((h) => { data[h] = ''; });
    setNewRowData(data);
    setAddingRow(true);
  };

  const handleCloseAdd = () => {
    setAddingRow(false);
    setNewRowData({});
  };

  const handleSaveAdd = async () => {
    setSaving(true);
    try {
      const values = headers.map((h) => newRowData[h] ?? '');
      await axios.post('/api/AppendSheetRow', {
        spreadsheetId,
        sheetTab: sheetTab || '',
        values,
      });
      showSnackbar('行を追加しました', 'success');
      handleCloseAdd();
      await fetchData();
    } catch (error) {
      const msg = error.response?.data || error.message || '追加に失敗しました';
      showSnackbar(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ---- 削除 ----
  const handleOpenDelete = (row) => {
    setConfirmDelete(row);
  };

  const handleCloseDelete = () => {
    setConfirmDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setSaving(true);
    try {
      await axios.delete('/api/DeleteSheetRow', {
        data: {
          spreadsheetId,
          sheetTab: sheetTab || '',
          rowIndex: confirmDelete._rowIndex,
        },
      });
      showSnackbar('削除しました', 'success');
      handleCloseDelete();
      await fetchData();
    } catch (error) {
      const msg = error.response?.data || error.message || '削除に失敗しました';
      showSnackbar(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ---- レンダリング ----
  return (
    <Box>
      <Paper>
        {/* ツールバー */}
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="再読み込み">
              <span>
                <IconButton onClick={fetchData} disabled={loading}>
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenAdd}
              disabled={loading || headers.length === 0}
              size="small"
            >
              行を追加
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {loading ? '読み込み中...' : `${rows.length} 行`}
          </Typography>
        </Toolbar>

        {/* テーブル */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 'calc(100vh - 360px)', overflowX: 'auto' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {headers.map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                      {h}
                    </TableCell>
                  ))}
                  <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={headers.length + 1} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        データがありません
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row._rowIndex} hover>
                      {headers.map((h) => (
                        <TableCell
                          key={h}
                          sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={row[h]}
                        >
                          {row[h]}
                        </TableCell>
                      ))}
                      <TableCell>
                        <Tooltip title="編集">
                          <IconButton size="small" onClick={() => handleOpenEdit(row)} disabled={saving}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="削除">
                          <IconButton size="small" color="error" onClick={() => handleOpenDelete(row)} disabled={saving}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* 編集ダイアログ */}
      <Dialog open={!!editingRow} onClose={handleCloseEdit} maxWidth="sm" fullWidth>
        <DialogTitle>行を編集（行 {editingRow?._rowIndex}）</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            {headers.map((h) => (
              <TextField
                key={h}
                label={h}
                value={editFormData[h] ?? ''}
                onChange={(e) => setEditFormData({ ...editFormData, [h]: e.target.value })}
                fullWidth
                multiline={editFormData[h]?.length > 60}
                maxRows={4}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEdit} disabled={saving}>キャンセル</Button>
          <Button onClick={handleSaveEdit} variant="contained" disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 追加ダイアログ */}
      <Dialog open={addingRow} onClose={handleCloseAdd} maxWidth="sm" fullWidth>
        <DialogTitle>行を追加</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            {headers.map((h) => (
              <TextField
                key={h}
                label={h}
                value={newRowData[h] ?? ''}
                onChange={(e) => setNewRowData({ ...newRowData, [h]: e.target.value })}
                fullWidth
                multiline={newRowData[h]?.length > 60}
                maxRows={4}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAdd} disabled={saving}>キャンセル</Button>
          <Button onClick={handleSaveAdd} variant="contained" disabled={saving}>
            {saving ? '追加中...' : '追加'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={!!confirmDelete} onClose={handleCloseDelete}>
        <DialogTitle>行を削除しますか？</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            行 {confirmDelete?._rowIndex} を削除します。この操作は元に戻せません。
          </Typography>
          {confirmDelete && headers.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {headers[0]}: {confirmDelete[headers[0]]}
                {headers[1] ? ` / ${headers[1]}: ${confirmDelete[headers[1]]}` : ''}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDelete} disabled={saving}>キャンセル</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained" disabled={saving}>
            {saving ? '削除中...' : '削除'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* スナックバー */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
