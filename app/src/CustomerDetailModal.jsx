// app/src/CustomerDetailModal.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Box,
  Button,
  CircularProgress,
  Alert,
  Typography,
} from '@mui/material';

const API_URL = '/api';

const STATUS_OPTIONS = ['Lead', '商談中', '契約済み', 'フォローアップ', '見送り'];
const SOURCE_OPTIONS = ['ZOHO', 'Appfolio', 'WP', 'Qドライブ', '手動入力'];

const BLANK_FORM = {
  name: '',
  email: '',
  phone: '',
  company: '',
  country: '',
  region: '',
  status: 'Lead',
  source: '',
  assignedTo: '',
  propertyInterest: '',
  preferredBedrooms: '',
  budget: '',
  lastContactedAt: '',
  nextFollowUpAt: '',
  notes: '',
};

export function CustomerDetailModal({ open, onClose, customer, onSaved, onDeleted }) {
  const isEdit = customer != null;
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      if (isEdit) {
        setForm({
          name: customer.name ?? '',
          email: customer.email ?? '',
          phone: customer.phone ?? '',
          company: customer.company ?? '',
          country: customer.country ?? '',
          region: customer.region ?? '',
          status: customer.status ?? 'Lead',
          source: customer.source ?? '',
          assignedTo: customer.assignedTo ?? '',
          propertyInterest: customer.propertyInterest ?? '',
          preferredBedrooms: customer.preferredBedrooms ?? '',
          budget: customer.budget ?? '',
          lastContactedAt: customer.lastContactedAt ?? '',
          nextFollowUpAt: customer.nextFollowUpAt ?? '',
          notes: customer.notes ?? '',
        });
      } else {
        setForm(BLANK_FORM);
      }
      setError('');
    }
  }, [open, customer, isEdit]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('氏名は必須項目です');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const endpoint = isEdit ? 'UpdateCustomer' : 'CreateCustomer';
      const body = isEdit ? { id: customer.id, ...form } : form;
      const res = await axios.post(`${API_URL}/${endpoint}`, body);
      onSaved(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data || err.message || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('この顧客を削除しますか？')) return;
    setSaving(true);
    setError('');
    try {
      await axios.post(`${API_URL}/DeleteCustomer`, { id: customer.id });
      onDeleted();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data || err.message || '削除に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle>
        <Typography variant="h6" component="span">
          {isEdit ? customer.name : '新規顧客'}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2}>
          {/* 氏名 */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="氏名"
              value={form.name}
              onChange={handleChange('name')}
              required
              fullWidth
              size="small"
            />
          </Grid>

          {/* メール */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="メール"
              type="email"
              value={form.email}
              onChange={handleChange('email')}
              fullWidth
              size="small"
            />
          </Grid>

          {/* 電話番号 */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="電話番号"
              value={form.phone}
              onChange={handleChange('phone')}
              fullWidth
              size="small"
            />
          </Grid>

          {/* 会社名 */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="会社名"
              value={form.company}
              onChange={handleChange('company')}
              fullWidth
              size="small"
            />
          </Grid>

          {/* 国 */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="国"
              value={form.country}
              onChange={handleChange('country')}
              fullWidth
              size="small"
            />
          </Grid>

          {/* 地域 */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="地域"
              value={form.region}
              onChange={handleChange('region')}
              fullWidth
              size="small"
            />
          </Grid>

          {/* ステータス */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>ステータス</InputLabel>
              <Select
                label="ステータス"
                value={form.status}
                onChange={handleChange('status')}
              >
                {STATUS_OPTIONS.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* 情報ソース */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>情報ソース</InputLabel>
              <Select
                label="情報ソース"
                value={form.source}
                onChange={handleChange('source')}
              >
                <MenuItem value="">
                  <em>なし</em>
                </MenuItem>
                {SOURCE_OPTIONS.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* 担当者 */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="担当者"
              value={form.assignedTo}
              onChange={handleChange('assignedTo')}
              fullWidth
              size="small"
            />
          </Grid>

          {/* 希望物件 */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="希望物件"
              value={form.propertyInterest}
              onChange={handleChange('propertyInterest')}
              fullWidth
              size="small"
            />
          </Grid>

          {/* 希望間取り */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="希望間取り"
              value={form.preferredBedrooms}
              onChange={handleChange('preferredBedrooms')}
              fullWidth
              size="small"
            />
          </Grid>

          {/* 予算 */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="予算"
              value={form.budget}
              onChange={handleChange('budget')}
              fullWidth
              size="small"
            />
          </Grid>

          {/* 最終接触日 */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="最終接触日"
              type="date"
              value={form.lastContactedAt}
              onChange={handleChange('lastContactedAt')}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          {/* 次回フォロー日 */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="次回フォロー日"
              type="date"
              value={form.nextFollowUpAt}
              onChange={handleChange('nextFollowUpAt')}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          {/* 備考 */}
          <Grid item xs={12}>
            <TextField
              label="備考"
              value={form.notes}
              onChange={handleChange('notes')}
              fullWidth
              multiline
              rows={3}
              size="small"
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        {isEdit && (
          <Button
            color="error"
            onClick={handleDelete}
            disabled={saving}
            sx={{ mr: 'auto' }}
          >
            削除
          </Button>
        )}
        <Button onClick={onClose} disabled={saving}>
          キャンセル
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {isEdit ? '保存' : '作成'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CustomerDetailModal;
