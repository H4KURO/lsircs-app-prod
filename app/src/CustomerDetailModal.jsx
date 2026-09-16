// app/src/CustomerDetailModal.jsx
import { useState, useEffect, useMemo } from 'react';
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
  Chip,
  Divider,
  Tooltip,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ApartmentIcon from '@mui/icons-material/Apartment';
import FolderIcon from '@mui/icons-material/Folder';
import AddIcon from '@mui/icons-material/Add';
import { BuyerSearchDialog } from './BuyerSearchDialog';

const MGMT_COLORS = {
  PM:    { bg: '#F0FDFB', text: '#0D9488', bar: '#0D9488' },
  'PCS A': { bg: '#F0FDF4', text: '#16A34A', bar: '#16A34A' },
  'PCS B': { bg: '#FFFBEB', text: '#D97706', bar: '#D97706' },
};
function getMgmtStyle(type) { return MGMT_COLORS[type] || { bg: '#F1F5F9', text: '#64748B', bar: '#94A3B8' }; }

const API_URL = '/api';

function toBoxEmbedUrl(url) {
  if (!url) return '';
  return url.replace('app.box.com/s/', 'app.box.com/embed/s/');
}

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

export function CustomerDetailModal({ open, onClose, customer, onSaved, onDeleted, onNavigateToTask, onNavigateToBuyer }) {
  const isEdit = customer != null;
  const [form, setForm] = useState(BLANK_FORM);
  const [buyerLinks, setBuyerLinks] = useState([]);
  const [buyerSearchOpen, setBuyerSearchOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [allTasks, setAllTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [linkedProperties, setLinkedProperties] = useState([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [boxFolders, setBoxFolders] = useState([]);
  const [selectedFolderIdx, setSelectedFolderIdx] = useState(0);
  const [boxView, setBoxView] = useState('preview');
  const [addFolderOpen, setAddFolderOpen] = useState(false);
  const [newFolderLabel, setNewFolderLabel] = useState('');
  const [newFolderUrl, setNewFolderUrl] = useState('');

  const linkedTasks = useMemo(
    () => (customer ? allTasks.filter((t) => t.customerId === customer.id) : []),
    [allTasks, customer],
  );

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
        const links = Array.isArray(customer.buyerLinks)
          ? customer.buyerLinks
          : (customer.buyerLink ? [customer.buyerLink] : []);
        setBuyerLinks(links);
        setBoxFolders(Array.isArray(customer.boxFolders) ? customer.boxFolders : []);
        setSelectedFolderIdx(0);
        setBoxView('preview');
        setAddFolderOpen(false);
      } else {
        setForm(BLANK_FORM);
        setBuyerLinks([]);
        setBoxFolders([]);
      }
      setError('');
      if (isEdit) {
        setLoadingTasks(true);
        axios
          .get(`${API_URL}/GetTasks`)
          .then((res) => setAllTasks(Array.isArray(res.data) ? res.data : []))
          .catch(() => {})
          .finally(() => setLoadingTasks(false));

        const names = customer.linkedPropertyNames;
        if (Array.isArray(names) && names.length > 0) {
          setLoadingProperties(true);
          axios
            .get(`${API_URL}/GetProperties`)
            .then((res) => {
              const all = Array.isArray(res.data) ? res.data : [];
              setLinkedProperties(all.filter((p) => names.includes(p.propertyName)));
            })
            .catch(() => {})
            .finally(() => setLoadingProperties(false));
        } else {
          setLinkedProperties([]);
        }
      } else {
        setAllTasks([]);
        setLinkedProperties([]);
      }
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
      const body = isEdit
        ? { id: customer.id, ...form, buyerLinks, buyerLink: buyerLinks[0] ?? null, boxFolders }
        : { ...form, buyerLinks, buyerLink: buyerLinks[0] ?? null };
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

          {/* 関連タスク */}
          {isEdit && (
            <Grid item xs={12}>
              <Divider sx={{ my: 0.5 }} />
              <Box sx={{ mt: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <TaskAltIcon fontSize="small" color="action" />
                  <Typography variant="body2" fontWeight={600}>
                    関連タスク
                  </Typography>
                  {linkedTasks.length > 0 && (
                    <Chip label={linkedTasks.length} size="small" />
                  )}
                </Box>
                {loadingTasks ? (
                  <CircularProgress size={20} />
                ) : linkedTasks.length === 0 ? (
                  <Typography variant="body2" color="text.disabled" sx={{ pl: 0.5 }}>
                    紐づいているタスクはありません
                  </Typography>
                ) : (
                  <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem' }}>タイトル</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem' }}>ステータス</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem' }}>担当者</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem' }}>期限</TableCell>
                          <TableCell sx={{ width: 32 }} />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {linkedTasks.map((task) => (
                          <TableRow key={task.id}>
                            <TableCell sx={{ fontSize: '0.8rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {task.title}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={task.status}
                                size="small"
                                color={
                                  task.status === 'Done' ? 'success'
                                  : task.status === 'Inprogress' ? 'warning'
                                  : 'default'
                                }
                                sx={{ fontSize: '0.65rem', height: 18 }}
                              />
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                              {Array.isArray(task.assignees) && task.assignees.length > 0
                                ? task.assignees.join(', ')
                                : task.assignee ?? '—'}
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                              {task.deadline ? task.deadline.split('T')[0] : '—'}
                            </TableCell>
                            <TableCell padding="none">
                              <Tooltip title="タスクを開く">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    onClose();
                                    if (onNavigateToTask) {
                                      onNavigateToTask(task.id);
                                    }
                                  }}
                                >
                                  <OpenInNewIcon sx={{ fontSize: '0.9rem' }} />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            </Grid>
          )}

          {/* Buyers List 紐づけ */}
          <Grid item xs={12}>
            <Divider sx={{ my: 0.5 }} />
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Buyers List 紐づけ
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                {buyerLinks.map((lnk, i) => (
                  <Chip
                    key={i}
                    icon={<LinkIcon sx={{ fontSize: '0.9rem' }} />}
                    label={lnk.displayName}
                    color="info"
                    size="small"
                    variant="outlined"
                    onClick={onNavigateToBuyer ? () => {
                      onClose();
                      onNavigateToBuyer({ projectId: lnk.projectId, rowIndex: lnk.rowIndex });
                    } : undefined}
                    onDelete={() => setBuyerLinks((prev) => prev.filter((_, idx) => idx !== i))}
                    deleteIcon={
                      <Tooltip title="紐づけを解除">
                        <LinkOffIcon sx={{ fontSize: '0.85rem' }} />
                      </Tooltip>
                    }
                    sx={{ cursor: onNavigateToBuyer ? 'pointer' : 'default' }}
                  />
                ))}
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<LinkIcon />}
                  onClick={() => setBuyerSearchOpen(true)}
                  sx={{ fontSize: '0.75rem', py: 0.25 }}
                >
                  {buyerLinks.length > 0 ? '追加' : 'バイヤーと紐づける'}
                </Button>
              </Box>
            </Box>
          </Grid>

          {/* 所有物件 */}
          {isEdit && (
            <Grid item xs={12}>
              <Divider sx={{ my: 0.5 }} />
              <Box sx={{ mt: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <ApartmentIcon fontSize="small" color="action" />
                  <Typography variant="body2" fontWeight={600}>所有物件</Typography>
                  {linkedProperties.length > 0 && <Chip label={linkedProperties.length} size="small" />}
                </Box>
                {loadingProperties ? (
                  <CircularProgress size={20} />
                ) : linkedProperties.length === 0 ? (
                  <Typography variant="body2" color="text.disabled" sx={{ pl: 0.5 }}>
                    紐づいている物件はありません（CRM同期後に表示されます）
                  </Typography>
                ) : (() => {
                  const totalRent = linkedProperties.reduce((s, p) => s + (Number(p.monthlyRent) || 0), 0);
                  const mgmtCounts = linkedProperties.reduce((acc, p) => {
                    if (p.managementType) acc[p.managementType] = (acc[p.managementType] || 0) + 1;
                    return acc;
                  }, {});
                  return (
                    <Box>
                      {/* サマリーバー */}
                      <Box sx={{
                        display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
                        p: 1.5, mb: 1.5, borderRadius: 1, bgcolor: 'action.hover',
                        border: '1px solid', borderColor: 'divider',
                      }}>
                        <Box>
                          <Typography variant="h6" fontWeight={700} lineHeight={1}>{linkedProperties.length}</Typography>
                          <Typography variant="caption" color="text.secondary">物件</Typography>
                        </Box>
                        <Divider orientation="vertical" flexItem />
                        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                          {Object.entries(mgmtCounts).map(([type, count]) => {
                            const s = getMgmtStyle(type);
                            return (
                              <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: s.bar }} />
                                <Typography variant="caption" color="text.secondary">{type}</Typography>
                                <Typography variant="caption" fontWeight={700}>{count}</Typography>
                              </Box>
                            );
                          })}
                        </Box>
                        {totalRent > 0 && (
                          <>
                            <Divider orientation="vertical" flexItem />
                            <Box>
                              <Typography variant="body2" fontWeight={700} color="success.main" fontVariantNumeric="tabular-nums">
                                ${totalRent.toLocaleString()}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">月額合計</Typography>
                            </Box>
                          </>
                        )}
                      </Box>
                      {/* 物件リスト */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {linkedProperties.map((p) => {
                          const s = getMgmtStyle(p.managementType);
                          const isCurrent = p.tenantStatus === 'Current';
                          const isNotice = p.tenantStatus === 'Notice';
                          return (
                            <Box key={p.id} sx={{
                              display: 'flex', alignItems: 'center', gap: 1.5,
                              px: 1.5, py: 1, borderRadius: 1,
                              '&:hover': { bgcolor: 'action.hover' },
                            }}>
                              <Box sx={{ width: 3, height: 36, borderRadius: 1, bgcolor: s.bar, flexShrink: 0 }} />
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" fontWeight={500} noWrap>{p.propertyName}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {p.managementType || '—'}
                                  {p.leaseStart && p.leaseEnd ? ` · ${p.leaseStart} 〜 ${p.leaseEnd}` : ''}
                                </Typography>
                              </Box>
                              <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                                {p.monthlyRent && (
                                  <Typography variant="body2" fontWeight={600} fontVariantNumeric="tabular-nums">
                                    ${Number(p.monthlyRent).toLocaleString()}
                                  </Typography>
                                )}
                                {p.tenantStatus && (
                                  <Typography variant="caption" fontWeight={600}
                                    sx={{ color: isCurrent ? 'success.main' : isNotice ? 'warning.main' : 'text.secondary' }}>
                                    {p.tenantStatus}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  );
                })()}
              </Box>
            </Grid>
          )}

          {/* ドキュメント (Box) */}
          {isEdit && (
            <Grid item xs={12}>
              <Divider sx={{ my: 0.5 }} />
              <Box sx={{ mt: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <FolderIcon fontSize="small" color="action" />
                  <Typography variant="body2" fontWeight={600}>ドキュメント</Typography>
                  {boxFolders.length > 0 && <Chip label={boxFolders.length} size="small" />}
                </Box>

                {boxFolders.length > 0 && (
                  <Box>
                    {/* フォルダ選択 */}
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
                      {boxFolders.map((f, i) => (
                        <Chip
                          key={i}
                          icon={<FolderIcon />}
                          label={f.label || 'フォルダ'}
                          size="small"
                          variant={selectedFolderIdx === i ? 'filled' : 'outlined'}
                          color={selectedFolderIdx === i ? 'primary' : 'default'}
                          onClick={() => setSelectedFolderIdx(i)}
                          onDelete={() => {
                            setBoxFolders(prev => prev.filter((_, idx) => idx !== i));
                            setSelectedFolderIdx(prev => Math.max(0, prev >= i ? prev - 1 : prev));
                          }}
                        />
                      ))}
                    </Box>

                    {/* 表示切替 + 外部リンク */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Box sx={{ display: 'flex', border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                        <Button
                          size="small" disableElevation
                          variant={boxView === 'preview' ? 'contained' : 'text'}
                          onClick={() => setBoxView('preview')}
                          sx={{ borderRadius: 0, minWidth: 80, fontSize: '0.75rem' }}
                        >プレビュー</Button>
                        <Button
                          size="small" disableElevation
                          variant={boxView === 'list' ? 'contained' : 'text'}
                          onClick={() => setBoxView('list')}
                          sx={{ borderRadius: 0, minWidth: 80, fontSize: '0.75rem' }}
                        >リンク一覧</Button>
                      </Box>
                      <Button
                        size="small" variant="outlined" endIcon={<OpenInNewIcon />}
                        component="a" href={boxFolders[selectedFolderIdx]?.url}
                        target="_blank" rel="noopener noreferrer"
                        sx={{ fontSize: '0.75rem' }}
                      >Boxで開く</Button>
                    </Box>

                    {/* iframe プレビュー */}
                    {boxView === 'preview' && (
                      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', height: 320 }}>
                        <iframe
                          key={boxFolders[selectedFolderIdx]?.url}
                          src={toBoxEmbedUrl(boxFolders[selectedFolderIdx]?.url)}
                          width="100%" height="100%"
                          style={{ border: 'none', display: 'block' }}
                          title="Box preview"
                        />
                      </Box>
                    )}

                    {/* リンク一覧 */}
                    {boxView === 'list' && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {boxFolders.map((f, i) => (
                          <Box key={i} sx={{
                            display: 'flex', alignItems: 'center', gap: 1.5,
                            px: 1.5, py: 1, borderRadius: 1,
                            border: '1px solid', borderColor: 'divider', bgcolor: 'action.hover',
                          }}>
                            <FolderIcon sx={{ color: 'primary.main', fontSize: 18, flexShrink: 0 }} />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body2" fontWeight={500} noWrap>{f.label || 'フォルダ'}</Typography>
                              <Typography variant="caption" color="text.secondary" noWrap>{f.url}</Typography>
                            </Box>
                            <Button
                              size="small" component="a" href={f.url}
                              target="_blank" rel="noopener noreferrer"
                              endIcon={<OpenInNewIcon />} sx={{ fontSize: '0.72rem', flexShrink: 0 }}
                            >開く</Button>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                )}

                {/* フォルダ追加フォーム */}
                {addFolderOpen ? (
                  <Box sx={{ mt: 1.5, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <TextField
                      size="small" label="フォルダ名" value={newFolderLabel}
                      onChange={e => setNewFolderLabel(e.target.value)}
                      fullWidth placeholder="例: 契約書類"
                    />
                    <TextField
                      size="small" label="Box URL" value={newFolderUrl}
                      onChange={e => setNewFolderUrl(e.target.value)}
                      fullWidth placeholder="https://app.box.com/s/..."
                    />
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small" variant="contained" disableElevation
                        disabled={!newFolderUrl.trim()}
                        onClick={() => {
                          const next = [...boxFolders, { label: newFolderLabel.trim() || 'フォルダ', url: newFolderUrl.trim() }];
                          setBoxFolders(next);
                          setSelectedFolderIdx(next.length - 1);
                          setNewFolderLabel('');
                          setNewFolderUrl('');
                          setAddFolderOpen(false);
                        }}
                      >追加</Button>
                      <Button size="small" onClick={() => { setAddFolderOpen(false); setNewFolderLabel(''); setNewFolderUrl(''); }}>キャンセル</Button>
                    </Box>
                  </Box>
                ) : (
                  <Button
                    size="small" startIcon={<AddIcon />}
                    onClick={() => setAddFolderOpen(true)}
                    sx={{ mt: boxFolders.length > 0 ? 1.5 : 0, fontSize: '0.75rem' }}
                  >
                    {boxFolders.length === 0 ? 'Box フォルダを紐づける' : 'フォルダを追加'}
                  </Button>
                )}
              </Box>
            </Grid>
          )}

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

      <BuyerSearchDialog
        open={buyerSearchOpen}
        onClose={() => setBuyerSearchOpen(false)}
        onSelect={(link) => setBuyerLinks((prev) => {
          const dup = prev.findIndex((l) => l.projectId === link.projectId && l.rowIndex === link.rowIndex);
          if (dup >= 0) { const next = [...prev]; next[dup] = link; return next; }
          return [...prev, link];
        })}
      />
    </Dialog>
  );
}

export default CustomerDetailModal;
