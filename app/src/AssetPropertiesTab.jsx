// app/src/AssetPropertiesTab.jsx
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

const PROPERTY_TYPES = [
  { value: 'apartment', label: 'マンション' },
  { value: 'house', label: '戸建' },
  { value: 'building', label: 'ビル・一棟' },
  { value: 'land', label: '土地' },
  { value: 'other', label: 'その他' },
];

const EMPTY_FORM = {
  name: '',
  address: '',
  propertyType: 'apartment',
  ownerId: '',
  unitCount: '',
  builtYear: '',
  status: 'active',
  notes: '',
};

function propertyTypeLabel(value) {
  return PROPERTY_TYPES.find((t) => t.value === value)?.label || value || '—';
}

export function AssetPropertiesTab({ owners, onPropertiesChange }) {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/GetAssetProperties`);
      setProperties(res.data || []);
      onPropertiesChange?.(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data || err.message || '物件データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [onPropertiesChange]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const ownerName = (ownerId) => owners.find((o) => o.id === ownerId)?.name || '未設定';

  const handleOpenNew = () => {
    setEditingProperty(null);
    setForm(EMPTY_FORM);
    setSaveError('');
    setDialogOpen(true);
  };

  const handleOpenEdit = (property) => {
    setEditingProperty(property);
    setForm({
      name: property.name ?? '',
      address: property.address ?? '',
      propertyType: property.propertyType ?? 'apartment',
      ownerId: property.ownerId ?? '',
      unitCount: property.unitCount ?? '',
      builtYear: property.builtYear ?? '',
      status: property.status ?? 'active',
      notes: property.notes ?? '',
    });
    setSaveError('');
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    if (saving) return;
    setDialogOpen(false);
    setEditingProperty(null);
    setForm(EMPTY_FORM);
    setSaveError('');
  };

  const handleFormChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setSaveError('物件名は必須です');
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        ...form,
        ownerId: form.ownerId || null,
        unitCount: form.unitCount === '' ? null : Number(form.unitCount),
        builtYear: form.builtYear === '' ? null : Number(form.builtYear),
      };
      if (editingProperty) {
        await axios.post(`${API_URL}/UpdateAssetProperty`, { id: editingProperty.id, ...payload });
      } else {
        await axios.post(`${API_URL}/CreateAssetProperty`, payload);
      }
      setDialogOpen(false);
      fetchProperties();
    } catch (err) {
      setSaveError(err.response?.data?.message || err.response?.data || err.message || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (property) => {
    if (!window.confirm(`物件「${property.name}」を削除しますか？`)) return;
    try {
      await axios.post(`${API_URL}/DeleteAssetProperty`, { id: property.id });
      fetchProperties();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data || err.message || '削除に失敗しました');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <Typography variant="h6" fontWeight={700}>物件一覧</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenNew}>
          物件追加
        </Button>
      </Box>

      <Paper elevation={2} sx={{ p: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchProperties}>再試行</Button>}>
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
                  <TableCell sx={{ fontWeight: 700 }}>物件名</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>種別</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>住所</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>オーナー</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>戸数</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>ステータス</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {properties.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                      物件が登録されていません
                    </TableCell>
                  </TableRow>
                ) : (
                  properties.map((property) => (
                    <TableRow key={property.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                      <TableCell sx={{ fontWeight: 500 }}>{property.name}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{propertyTypeLabel(property.propertyType)}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{property.address || '—'}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{ownerName(property.ownerId)}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{property.unitCount ?? '—'}</TableCell>
                      <TableCell>
                        <Chip
                          label={property.status === 'active' ? '稼働中' : '非稼働'}
                          color={property.status === 'active' ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleOpenEdit(property)} aria-label="編集">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(property)} aria-label="削除">
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
        <DialogTitle>{editingProperty ? '物件編集' : '物件追加'}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {saveError && <Alert severity="error">{saveError}</Alert>}
            <TextField label="物件名" value={form.name} onChange={handleFormChange('name')} required fullWidth size="small" />
            <TextField label="住所" value={form.address} onChange={handleFormChange('address')} fullWidth size="small" />
            <FormControl fullWidth size="small">
              <InputLabel>種別</InputLabel>
              <Select value={form.propertyType} label="種別" onChange={handleFormChange('propertyType')}>
                {PROPERTY_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>オーナー</InputLabel>
              <Select value={form.ownerId} label="オーナー" onChange={handleFormChange('ownerId')}>
                <MenuItem value="">未設定</MenuItem>
                {owners.map((owner) => (
                  <MenuItem key={owner.id} value={owner.id}>{owner.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="戸数" type="number" value={form.unitCount} onChange={handleFormChange('unitCount')} fullWidth size="small" inputProps={{ min: 0 }} />
            <TextField label="築年" type="number" value={form.builtYear} onChange={handleFormChange('builtYear')} fullWidth size="small" inputProps={{ min: 1900 }} />
            <FormControl fullWidth size="small">
              <InputLabel>ステータス</InputLabel>
              <Select value={form.status} label="ステータス" onChange={handleFormChange('status')}>
                <MenuItem value="active">稼働中</MenuItem>
                <MenuItem value="inactive">非稼働</MenuItem>
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

export default AssetPropertiesTab;
