// app/src/AssetRentTransactionsTab.jsx
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

const STATUS_OPTIONS = [
  { value: 'unpaid', label: '未入金', color: 'error' },
  { value: 'partial', label: '一部入金', color: 'warning' },
  { value: 'paid', label: '入金済み', color: 'success' },
];

const EMPTY_FORM = {
  contractId: '',
  yearMonth: '',
  expectedAmount: '',
  receivedAmount: '',
  receivedDate: '',
  ownerPayoutAmount: '',
  ownerPayoutDate: '',
  status: 'unpaid',
  notes: '',
};

function statusMeta(value) {
  return STATUS_OPTIONS.find((s) => s.value === value) || STATUS_OPTIONS[0];
}

function formatCurrency(value) {
  if (value === undefined || value === null || value === '') return '—';
  return `¥${Number(value).toLocaleString('ja-JP')}`;
}

export function AssetRentTransactionsTab({ contracts, properties }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/GetAssetRentTransactions`);
      setTransactions(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data || err.message || '入出金データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const contractLabel = (contractId) => {
    const contract = contracts.find((c) => c.id === contractId);
    if (!contract) return '不明な契約';
    const property = properties.find((p) => p.id === contract.propertyId);
    return `${property?.name || '不明な物件'} / ${contract.tenantName}`;
  };

  const handleOpenNew = () => {
    setEditingTransaction(null);
    setForm(EMPTY_FORM);
    setSaveError('');
    setDialogOpen(true);
  };

  const handleOpenEdit = (transaction) => {
    setEditingTransaction(transaction);
    setForm({
      contractId: transaction.contractId ?? '',
      yearMonth: transaction.yearMonth ?? '',
      expectedAmount: transaction.expectedAmount ?? '',
      receivedAmount: transaction.receivedAmount ?? '',
      receivedDate: transaction.receivedDate ?? '',
      ownerPayoutAmount: transaction.ownerPayoutAmount ?? '',
      ownerPayoutDate: transaction.ownerPayoutDate ?? '',
      status: transaction.status ?? 'unpaid',
      notes: transaction.notes ?? '',
    });
    setSaveError('');
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    if (saving) return;
    setDialogOpen(false);
    setEditingTransaction(null);
    setForm(EMPTY_FORM);
    setSaveError('');
  };

  const handleFormChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async () => {
    if (!form.contractId) {
      setSaveError('契約を選択してください');
      return;
    }
    if (!form.yearMonth) {
      setSaveError('対象年月は必須です');
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      const contract = contracts.find((c) => c.id === form.contractId);
      const payload = {
        ...form,
        propertyId: contract?.propertyId ?? null,
        expectedAmount: form.expectedAmount === '' ? 0 : Number(form.expectedAmount),
        receivedAmount: form.receivedAmount === '' ? 0 : Number(form.receivedAmount),
        ownerPayoutAmount: form.ownerPayoutAmount === '' ? 0 : Number(form.ownerPayoutAmount),
      };
      if (editingTransaction) {
        await axios.post(`${API_URL}/UpdateAssetRentTransaction`, { id: editingTransaction.id, ...payload });
      } else {
        await axios.post(`${API_URL}/CreateAssetRentTransaction`, payload);
      }
      setDialogOpen(false);
      fetchTransactions();
    } catch (err) {
      setSaveError(err.response?.data?.message || err.response?.data || err.message || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (transaction) => {
    if (!window.confirm(`${transaction.yearMonth}分の入出金記録を削除しますか？`)) return;
    try {
      await axios.post(`${API_URL}/DeleteAssetRentTransaction`, { id: transaction.id });
      fetchTransactions();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data || err.message || '削除に失敗しました');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <Typography variant="h6" fontWeight={700}>賃料入出金一覧</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenNew} disabled={contracts.length === 0}>
          入出金記録追加
        </Button>
      </Box>

      {contracts.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>先に「契約」タブで契約を登録してください。</Alert>
      )}

      <Paper elevation={2} sx={{ p: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchTransactions}>再試行</Button>}>
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
                  <TableCell sx={{ fontWeight: 700 }}>物件 / 入居者</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>入金予定額</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>入金額</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>オーナー送金予定額</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>ステータス</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                      入出金記録がありません
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((transaction) => (
                    <TableRow key={transaction.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                      <TableCell sx={{ fontWeight: 500 }}>{transaction.yearMonth}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{contractLabel(transaction.contractId)}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{formatCurrency(transaction.expectedAmount)}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{formatCurrency(transaction.receivedAmount)}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{formatCurrency(transaction.ownerPayoutAmount)}</TableCell>
                      <TableCell>
                        <Chip label={statusMeta(transaction.status).label} color={statusMeta(transaction.status).color} size="small" />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleOpenEdit(transaction)} aria-label="編集">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(transaction)} aria-label="削除">
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
        <DialogTitle>{editingTransaction ? '入出金記録編集' : '入出金記録追加'}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {saveError && <Alert severity="error">{saveError}</Alert>}
            <FormControl fullWidth size="small" required>
              <InputLabel>契約</InputLabel>
              <Select value={form.contractId} label="契約" onChange={handleFormChange('contractId')}>
                {contracts.map((contract) => (
                  <MenuItem key={contract.id} value={contract.id}>{contractLabel(contract.id)}</MenuItem>
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
            <TextField label="入金予定額（円）" type="number" value={form.expectedAmount} onChange={handleFormChange('expectedAmount')} fullWidth size="small" inputProps={{ min: 0 }} />
            <TextField label="入金額（円）" type="number" value={form.receivedAmount} onChange={handleFormChange('receivedAmount')} fullWidth size="small" inputProps={{ min: 0 }} />
            <TextField label="入金日" type="date" value={form.receivedDate} onChange={handleFormChange('receivedDate')} fullWidth size="small" InputLabelProps={{ shrink: true }} />
            <TextField label="オーナー送金予定額（円）" type="number" value={form.ownerPayoutAmount} onChange={handleFormChange('ownerPayoutAmount')} fullWidth size="small" inputProps={{ min: 0 }} />
            <TextField label="オーナー送金予定日" type="date" value={form.ownerPayoutDate} onChange={handleFormChange('ownerPayoutDate')} fullWidth size="small" InputLabelProps={{ shrink: true }} />
            <FormControl fullWidth size="small">
              <InputLabel>ステータス</InputLabel>
              <Select value={form.status} label="ステータス" onChange={handleFormChange('status')}>
                {STATUS_OPTIONS.map((s) => (
                  <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
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

export default AssetRentTransactionsTab;
