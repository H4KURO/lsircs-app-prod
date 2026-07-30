// app/src/AssetOwnersTab.jsx
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

const API_URL = '/api';

const EMPTY_FORM = {
  name: '',
  kana: '',
  contactEmail: '',
  contactPhone: '',
  address: '',
  bankName: '',
  bankBranch: '',
  bankAccountType: '',
  bankAccountNumber: '',
  bankAccountHolder: '',
  notes: '',
};

export function AssetOwnersTab({ onOwnersChange }) {
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOwner, setEditingOwner] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const fetchOwners = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/GetAssetOwners`);
      setOwners(res.data || []);
      onOwnersChange?.(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data || err.message || 'オーナーデータの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [onOwnersChange]);

  useEffect(() => {
    fetchOwners();
  }, [fetchOwners]);

  const handleOpenNew = () => {
    setEditingOwner(null);
    setForm(EMPTY_FORM);
    setSaveError('');
    setDialogOpen(true);
  };

  const handleOpenEdit = (owner) => {
    setEditingOwner(owner);
    setForm({
      name: owner.name ?? '',
      kana: owner.kana ?? '',
      contactEmail: owner.contactEmail ?? '',
      contactPhone: owner.contactPhone ?? '',
      address: owner.address ?? '',
      bankName: owner.bankName ?? '',
      bankBranch: owner.bankBranch ?? '',
      bankAccountType: owner.bankAccountType ?? '',
      bankAccountNumber: owner.bankAccountNumber ?? '',
      bankAccountHolder: owner.bankAccountHolder ?? '',
      notes: owner.notes ?? '',
    });
    setSaveError('');
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    if (saving) return;
    setDialogOpen(false);
    setEditingOwner(null);
    setForm(EMPTY_FORM);
    setSaveError('');
  };

  const handleFormChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setSaveError('オーナー名は必須です');
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      if (editingOwner) {
        await axios.post(`${API_URL}/UpdateAssetOwner`, { id: editingOwner.id, ...form });
      } else {
        await axios.post(`${API_URL}/CreateAssetOwner`, form);
      }
      setDialogOpen(false);
      fetchOwners();
    } catch (err) {
      setSaveError(err.response?.data?.message || err.response?.data || err.message || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (owner) => {
    if (!window.confirm(`オーナー「${owner.name}」を削除しますか？`)) return;
    try {
      await axios.post(`${API_URL}/DeleteAssetOwner`, { id: owner.id });
      fetchOwners();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data || err.message || '削除に失敗しました');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <Typography variant="h6" fontWeight={700}>オーナー一覧</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenNew}>
          オーナー追加
        </Button>
      </Box>

      <Paper elevation={2} sx={{ p: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchOwners}>再試行</Button>}>
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
                  <TableCell sx={{ fontWeight: 700 }}>オーナー名</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>フリガナ</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>連絡先メール</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>電話番号</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>振込先銀行</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {owners.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                      オーナーが登録されていません
                    </TableCell>
                  </TableRow>
                ) : (
                  owners.map((owner) => (
                    <TableRow key={owner.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                      <TableCell sx={{ fontWeight: 500 }}>{owner.name}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{owner.kana || '—'}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{owner.contactEmail || '—'}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{owner.contactPhone || '—'}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        {owner.bankName ? `${owner.bankName} ${owner.bankBranch || ''}` : '—'}
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleOpenEdit(owner)} aria-label="編集">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(owner)} aria-label="削除">
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
        <DialogTitle>{editingOwner ? 'オーナー編集' : 'オーナー追加'}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {saveError && <Alert severity="error">{saveError}</Alert>}
            <TextField label="オーナー名" value={form.name} onChange={handleFormChange('name')} required fullWidth size="small" />
            <TextField label="フリガナ" value={form.kana} onChange={handleFormChange('kana')} fullWidth size="small" />
            <TextField label="連絡先メール" value={form.contactEmail} onChange={handleFormChange('contactEmail')} fullWidth size="small" />
            <TextField label="電話番号" value={form.contactPhone} onChange={handleFormChange('contactPhone')} fullWidth size="small" />
            <TextField label="住所" value={form.address} onChange={handleFormChange('address')} fullWidth size="small" />
            <TextField label="振込先銀行名" value={form.bankName} onChange={handleFormChange('bankName')} fullWidth size="small" />
            <TextField label="支店名" value={form.bankBranch} onChange={handleFormChange('bankBranch')} fullWidth size="small" />
            <TextField label="口座種別" value={form.bankAccountType} onChange={handleFormChange('bankAccountType')} fullWidth size="small" placeholder="普通 / 当座" />
            <TextField label="口座番号" value={form.bankAccountNumber} onChange={handleFormChange('bankAccountNumber')} fullWidth size="small" />
            <TextField label="口座名義" value={form.bankAccountHolder} onChange={handleFormChange('bankAccountHolder')} fullWidth size="small" />
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

export default AssetOwnersTab;
