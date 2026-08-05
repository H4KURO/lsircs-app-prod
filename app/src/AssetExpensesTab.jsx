// app/src/AssetExpensesTab.jsx
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

const API_URL = '/api';

const CATEGORIES = [
  { value: 'repair', label: '修繕費' },
  { value: 'management_fee', label: '管理委託手数料' },
  { value: 'insurance', label: '保険料' },
  { value: 'tax', label: '固定資産税' },
  { value: 'other', label: 'その他' },
];

const EMPTY_FORM = {
  propertyId: '',
  category: 'repair',
  yearMonth: '',
  amount: '',
  paidDate: '',
  vendor: '',
  notes: '',
};

function categoryLabel(value) {
  return CATEGORIES.find((c) => c.value === value)?.label || value || '—';
}

function formatCurrency(value) {
  if (value === undefined || value === null || value === '') return '—';
  return `¥${Number(value).toLocaleString('ja-JP')}`;
}

export function AssetExpensesTab({ properties, onExpensesChange }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/GetAssetExpenses`);
      setExpenses(res.data || []);
      onExpensesChange?.(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data || err.message || '支出データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [onExpensesChange]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const propertyName = (propertyId) => properties.find((p) => p.id === propertyId)?.name || '不明な物件';

  const handleOpenNew = () => {
    setEditingExpense(null);
    setForm(EMPTY_FORM);
    setSaveError('');
    setDialogOpen(true);
  };

  const handleOpenEdit = (expense) => {
    setEditingExpense(expense);
    setForm({
      propertyId: expense.propertyId ?? '',
      category: expense.category ?? 'repair',
      yearMonth: expense.yearMonth ?? '',
      amount: expense.amount ?? '',
      paidDate: expense.paidDate ?? '',
      vendor: expense.vendor ?? '',
      notes: expense.notes ?? '',
    });
    setSaveError('');
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    if (saving) return;
    setDialogOpen(false);
    setEditingExpense(null);
    setForm(EMPTY_FORM);
    setSaveError('');
  };

  const handleFormChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async () => {
    if (!form.propertyId) {
      setSaveError('物件を選択してください');
      return;
    }
    if (!form.yearMonth) {
      setSaveError('対象年月は必須です');
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        ...form,
        amount: form.amount === '' ? 0 : Number(form.amount),
      };
      if (editingExpense) {
        await axios.post(`${API_URL}/UpdateAssetExpense`, { id: editingExpense.id, ...payload });
      } else {
        await axios.post(`${API_URL}/CreateAssetExpense`, payload);
      }
      setDialogOpen(false);
      fetchExpenses();
    } catch (err) {
      setSaveError(err.response?.data?.message || err.response?.data || err.message || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expense) => {
    if (!window.confirm(`${expense.yearMonth}分の${categoryLabel(expense.category)}を削除しますか？`)) return;
    try {
      await axios.post(`${API_URL}/DeleteAssetExpense`, { id: expense.id });
      fetchExpenses();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data || err.message || '削除に失敗しました');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <Typography variant="h6" fontWeight={700}>支出一覧</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenNew} disabled={properties.length === 0}>
          支出追加
        </Button>
      </Box>

      {properties.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>先に「物件」タブで物件を登録してください。</Alert>
      )}

      <Paper elevation={2} sx={{ p: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchExpenses}>再試行</Button>}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 'calc(100vh - 340px)' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>対象年月</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>物件</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>科目</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>金額</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>支払日</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>支払先</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {expenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                      支出が登録されていません
                    </TableCell>
                  </TableRow>
                ) : (
                  expenses.map((expense) => (
                    <TableRow key={expense.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                      <TableCell sx={{ fontWeight: 500 }}>{expense.yearMonth}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{propertyName(expense.propertyId)}</TableCell>
                      <TableCell>
                        <Chip label={categoryLabel(expense.category)} size="small" />
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{formatCurrency(expense.amount)}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{expense.paidDate || '—'}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{expense.vendor || '—'}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleOpenEdit(expense)} aria-label="編集">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(expense)} aria-label="削除">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={handleDialogClose} fullWidth maxWidth="sm">
        <DialogTitle>{editingExpense ? '支出編集' : '支出追加'}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {saveError && <Alert severity="error">{saveError}</Alert>}
            <FormControl fullWidth size="small" required>
              <InputLabel>物件</InputLabel>
              <Select value={form.propertyId} label="物件" onChange={handleFormChange('propertyId')}>
                {properties.map((property) => (
                  <MenuItem key={property.id} value={property.id}>{property.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>科目</InputLabel>
              <Select value={form.category} label="科目" onChange={handleFormChange('category')}>
                {CATEGORIES.map((c) => (
                  <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="対象年月"
              type="month"
              value={form.yearMonth}
              onChange={handleFormChange('yearMonth')}
              required
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
            <TextField label="金額（円）" type="number" value={form.amount} onChange={handleFormChange('amount')} fullWidth size="small" inputProps={{ min: 0 }} />
            <TextField label="支払日" type="date" value={form.paidDate} onChange={handleFormChange('paidDate')} fullWidth size="small" InputLabelProps={{ shrink: true }} />
            <TextField label="支払先" value={form.vendor} onChange={handleFormChange('vendor')} fullWidth size="small" />
            <TextField label="備考" value={form.notes} onChange={handleFormChange('notes')} fullWidth size="small" multiline minRows={2} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} disabled={saving}>キャンセル</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : '保存'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AssetExpensesTab;
