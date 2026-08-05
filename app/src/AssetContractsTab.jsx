// app/src/AssetContractsTab.jsx
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
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

const API_URL = '/api';

const STATUS_OPTIONS = [
  { value: 'active', label: '契約中', color: 'success' },
  { value: 'pending', label: '契約準備中', color: 'warning' },
  { value: 'terminated', label: '解約済み', color: 'default' },
];

const EMPTY_FORM = {
  propertyId: '',
  unitNumber: '',
  tenantName: '',
  tenantContact: '',
  rentAmount: '',
  managementFeeAmount: '',
  depositAmount: '',
  startDate: '',
  endDate: '',
  status: 'active',
  notes: '',
  documentsFolderUrl: '',
};

function statusMeta(value) {
  return STATUS_OPTIONS.find((s) => s.value === value) || STATUS_OPTIONS[0];
}

function formatCurrency(value) {
  if (value === undefined || value === null || value === '') return '—';
  return `¥${Number(value).toLocaleString('ja-JP')}`;
}

export function AssetContractsTab({ properties, onContractsChange }) {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/GetAssetContracts`);
      setContracts(res.data || []);
      onContractsChange?.(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data || err.message || '契約データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [onContractsChange]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const propertyName = (propertyId) => properties.find((p) => p.id === propertyId)?.name || '不明な物件';

  const handleOpenNew = () => {
    setEditingContract(null);
    setForm(EMPTY_FORM);
    setSaveError('');
    setDialogOpen(true);
  };

  const handleOpenEdit = (contract) => {
    setEditingContract(contract);
    setForm({
      propertyId: contract.propertyId ?? '',
      unitNumber: contract.unitNumber ?? '',
      tenantName: contract.tenantName ?? '',
      tenantContact: contract.tenantContact ?? '',
      rentAmount: contract.rentAmount ?? '',
      managementFeeAmount: contract.managementFeeAmount ?? '',
      depositAmount: contract.depositAmount ?? '',
      startDate: contract.startDate ?? '',
      endDate: contract.endDate ?? '',
      status: contract.status ?? 'active',
      notes: contract.notes ?? '',
      documentsFolderUrl: contract.documentsFolderUrl ?? '',
    });
    setSaveError('');
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    if (saving) return;
    setDialogOpen(false);
    setEditingContract(null);
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
    if (!form.tenantName.trim()) {
      setSaveError('入居者名は必須です');
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        ...form,
        rentAmount: form.rentAmount === '' ? 0 : Number(form.rentAmount),
        managementFeeAmount: form.managementFeeAmount === '' ? 0 : Number(form.managementFeeAmount),
        depositAmount: form.depositAmount === '' ? 0 : Number(form.depositAmount),
      };
      if (editingContract) {
        await axios.post(`${API_URL}/UpdateAssetContract`, { id: editingContract.id, ...payload });
      } else {
        await axios.post(`${API_URL}/CreateAssetContract`, payload);
      }
      setDialogOpen(false);
      fetchContracts();
    } catch (err) {
      setSaveError(err.response?.data?.message || err.response?.data || err.message || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (contract) => {
    if (!window.confirm(`「${contract.tenantName}」の契約を削除しますか？`)) return;
    try {
      await axios.post(`${API_URL}/DeleteAssetContract`, { id: contract.id });
      fetchContracts();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data || err.message || '削除に失敗しました');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <Typography variant="h6" fontWeight={700}>賃貸契約一覧</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenNew} disabled={properties.length === 0}>
          契約追加
        </Button>
      </Box>

      {properties.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>先に「物件」タブで物件を登録してください。</Alert>
      )}

      <Paper elevation={2} sx={{ p: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchContracts}>再試行</Button>}>
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
                  <TableCell sx={{ fontWeight: 700 }}>物件</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>号室</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>入居者</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>賃料</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>管理費</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>契約期間</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>ステータス</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>書類</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {contracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                      契約が登録されていません
                    </TableCell>
                  </TableRow>
                ) : (
                  contracts.map((contract) => (
                    <TableRow key={contract.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                      <TableCell sx={{ fontWeight: 500 }}>{propertyName(contract.propertyId)}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{contract.unitNumber || '—'}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{contract.tenantName}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{formatCurrency(contract.rentAmount)}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{formatCurrency(contract.managementFeeAmount)}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        {contract.startDate || '—'} 〜 {contract.endDate || '未定'}
                      </TableCell>
                      <TableCell>
                        <Chip label={statusMeta(contract.status).label} color={statusMeta(contract.status).color} size="small" />
                      </TableCell>
                      <TableCell>
                        {contract.documentsFolderUrl ? (
                          <IconButton
                            size="small"
                            component="a"
                            href={contract.documentsFolderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="書類フォルダを開く"
                          >
                            <FolderOpenIcon fontSize="small" color="primary" />
                          </IconButton>
                        ) : (
                          <Typography variant="caption" color="text.secondary">未設定</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleOpenEdit(contract)} aria-label="編集">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(contract)} aria-label="削除">
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
        <DialogTitle>{editingContract ? '契約編集' : '契約追加'}</DialogTitle>
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
            <TextField label="号室" value={form.unitNumber} onChange={handleFormChange('unitNumber')} fullWidth size="small" />
            <TextField label="入居者名" value={form.tenantName} onChange={handleFormChange('tenantName')} required fullWidth size="small" />
            <TextField label="入居者連絡先" value={form.tenantContact} onChange={handleFormChange('tenantContact')} fullWidth size="small" />
            <TextField label="賃料（円）" type="number" value={form.rentAmount} onChange={handleFormChange('rentAmount')} fullWidth size="small" inputProps={{ min: 0 }} />
            <TextField label="管理費（円）" type="number" value={form.managementFeeAmount} onChange={handleFormChange('managementFeeAmount')} fullWidth size="small" inputProps={{ min: 0 }} />
            <TextField label="敷金（円）" type="number" value={form.depositAmount} onChange={handleFormChange('depositAmount')} fullWidth size="small" inputProps={{ min: 0 }} />
            <TextField label="契約開始日" type="date" value={form.startDate} onChange={handleFormChange('startDate')} fullWidth size="small" InputLabelProps={{ shrink: true }} />
            <TextField label="契約終了日" type="date" value={form.endDate} onChange={handleFormChange('endDate')} fullWidth size="small" InputLabelProps={{ shrink: true }} />
            <FormControl fullWidth size="small">
              <InputLabel>ステータス</InputLabel>
              <Select value={form.status} label="ステータス" onChange={handleFormChange('status')}>
                {STATUS_OPTIONS.map((s) => (
                  <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="書類フォルダURL（Box等）"
              value={form.documentsFolderUrl}
              onChange={handleFormChange('documentsFolderUrl')}
              fullWidth
              size="small"
              placeholder="https://app.box.com/s/..."
              helperText="契約書類・重要事項説明書等を格納したBox等の共有フォルダのURL（フォルダ作成・顧客への共有はBox側で行い、そのリンクをここに貼り付ける）"
            />
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

export default AssetContractsTab;
