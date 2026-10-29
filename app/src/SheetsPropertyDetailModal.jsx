import { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, TextField, Tabs, Tab, Chip,
  IconButton, Tooltip, CircularProgress, Alert,
  Select, MenuItem, FormControl, InputLabel, Divider,
  LinearProgress, Paper,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import SendIcon from '@mui/icons-material/Send';
import LinkIcon from '@mui/icons-material/Link';

const API = '/api';

const PAYMENT_STATUSES = ['未対応', '案内済み', '支払い済み'];
const STATUS_COLORS = {
  '未対応': 'default',
  '案内済み': 'warning',
  '支払い済み': 'success',
};

// Avatar initials from display name
function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : name[0];
}

// Format ISO date string → YYYY-MM-DD
function fmtDate(d) {
  if (!d) return '';
  return String(d).split('T')[0];
}

// Calculate due dates for all installments
function buildSchedule(existingSchedule, paymentStartDate, paymentDueDay, paymentCount, paymentBaseAmount) {
  const count = Number(paymentCount) || 0;
  const baseAmt = Number(paymentBaseAmount) || 0;
  const day = Number(paymentDueDay) || 1;

  const result = [];
  for (let i = 0; i < count; i++) {
    const existing = existingSchedule?.[i];
    let dueDate = existing?.dueDate || '';
    if (paymentStartDate && day) {
      const d = new Date(paymentStartDate);
      d.setMonth(d.getMonth() + i);
      d.setDate(day);
      dueDate = d.toISOString().split('T')[0];
    }
    result.push({
      no: i + 1,
      dueDate,
      amount: existing?.amount ?? baseAmt,
      status: existing?.status ?? '未対応',
      taskId: existing?.taskId ?? null,
      paidDate: existing?.paidDate ?? null,
    });
  }
  return result;
}

// ── Summary helpers ──────────────────────────────────────────────
function calcResidual(purchasePrice, downPayment, schedule) {
  const paid = (schedule || [])
    .filter((s) => s.status === '支払い済み')
    .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  return (Number(purchasePrice) || 0) - (Number(downPayment) || 0) - paid;
}

function fmtCurrency(n) {
  if (!n && n !== 0) return '—';
  return '¥' + Number(n).toLocaleString('ja-JP');
}

// ── PaymentScheduleTab ──────────────────────────────────────────
const VISIBLE_LIMIT = 10;

function PaymentScheduleTab({ property, schedule, onScheduleChange, onTaskCreate, saving }) {
  const [showAllOld, setShowAllOld] = useState(false);
  const [showAllNew, setShowAllNew] = useState(false);
  const [bulkCreating, setBulkCreating] = useState(false);

  const now = new Date();
  const twoMonthsAgo = new Date(now);
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  const oldPaid = schedule.filter(
    (s) => s.status === '支払い済み' && s.dueDate && new Date(s.dueDate) < twoMonthsAgo,
  );
  const recent = schedule.filter(
    (s) => !(s.status === '支払い済み' && s.dueDate && new Date(s.dueDate) < twoMonthsAgo),
  );

  const visibleRecent = showAllNew ? recent : recent.slice(0, VISIBLE_LIMIT);
  const hiddenRecent = recent.length - VISIBLE_LIMIT;

  const paidCount = schedule.filter((s) => s.status === '支払い済み').length;
  const totalCount = schedule.length;
  const progress = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;

  const nextDue = schedule.find((s) => s.status !== '支払い済み');

  const paidTotal = schedule
    .filter((s) => s.status === '支払い済み')
    .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  const handleStatusChange = (idx, status) => {
    const updated = schedule.map((s, i) =>
      i === idx ? { ...s, status, paidDate: status === '支払い済み' ? new Date().toISOString().split('T')[0] : s.paidDate } : s,
    );
    onScheduleChange(updated);
  };

  const handleAmountChange = (idx, val) => {
    const updated = schedule.map((s, i) => i === idx ? { ...s, amount: Number(val) || 0 } : s);
    onScheduleChange(updated);
  };

  const handleBulkCreate = async () => {
    setBulkCreating(true);
    const pending = schedule.filter((s) => !s.taskId && s.status !== '支払い済み');
    const updatedSchedule = [...schedule];
    for (const item of pending) {
      try {
        const res = await axios.post(`${API}/CreateTask`, {
          title: `[中間金] ${property.propertyName || property.sheetTab} - 第${item.no}回 ${item.dueDate ? `(${item.dueDate})` : ''}`,
          description: `物件: ${property.propertyName || property.sheetTab}\n部屋: ${property.roomNumber || ''}\n第${item.no}回 中間金\n金額: ${fmtCurrency(item.amount)}\n支払い期日: ${item.dueDate || ''}`,
          dueDate: item.dueDate || undefined,
          propertyId: property.id,
        });
        const schedIdx = updatedSchedule.findIndex((s) => s.no === item.no);
        if (schedIdx >= 0) updatedSchedule[schedIdx] = { ...updatedSchedule[schedIdx], taskId: res.data.id };
      } catch {
        // skip failed
      }
    }
    onScheduleChange(updatedSchedule);
    setBulkCreating(false);
  };

  if (schedule.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
        <Typography>基本情報タブでスケジュールを生成してください。</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Summary */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mb: 2 }}>
        {[
          { label: '支払い進捗', value: `${paidCount} / ${totalCount}回`, color: 'primary.main' },
          { label: '支払い済み合計', value: fmtCurrency(paidTotal), color: 'success.main' },
          { label: '次回期日', value: nextDue?.dueDate || '完了', color: 'warning.main' },
        ].map(({ label, value, color }) => (
          <Paper key={label} variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
            <Typography variant="body2" fontWeight={700} color={color}>{value}</Typography>
          </Paper>
        ))}
      </Box>

      {/* Progress bar */}
      <Box sx={{ mb: 2 }}>
        <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">{paidCount}回支払い済み</Typography>
          <Typography variant="caption" color="text.secondary">残{totalCount - paidCount}回 / 全{totalCount}回</Typography>
        </Box>
      </Box>

      {/* Bulk task button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
        <Button
          size="small" variant="outlined" startIcon={<AutorenewIcon />}
          onClick={handleBulkCreate}
          disabled={bulkCreating || schedule.every((s) => s.taskId || s.status === '支払い済み')}
        >
          {bulkCreating ? '作成中...' : '未対応タスクを一括作成'}
        </Button>
      </Box>

      {/* Old paid — collapsed */}
      {oldPaid.length > 0 && (
        <Box sx={{ mb: 1 }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1, bgcolor: 'action.hover', cursor: 'pointer' }}
            onClick={() => setShowAllOld((v) => !v)}
          >
            {showAllOld ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            <Typography variant="body2" color="text.secondary">
              第1〜{oldPaid.length}回 支払い済み（2ヶ月以上前）
            </Typography>
            <Chip label={`${oldPaid.length}件`} size="small" color="success" sx={{ ml: 'auto' }} />
          </Box>
          {showAllOld && (
            <ScheduleRows
              items={oldPaid}
              allItems={schedule}
              onStatusChange={handleStatusChange}
              onAmountChange={handleAmountChange}
              onTaskCreate={onTaskCreate}
              property={property}
            />
          )}
        </Box>
      )}

      {/* Recent items */}
      <ScheduleRows
        items={visibleRecent}
        allItems={schedule}
        onStatusChange={handleStatusChange}
        onAmountChange={handleAmountChange}
        onTaskCreate={onTaskCreate}
        property={property}
      />

      {/* Expand button for overflow */}
      {!showAllNew && hiddenRecent > 0 && (
        <Button
          fullWidth size="small" variant="outlined" sx={{ mt: 1 }}
          startIcon={<ExpandMoreIcon />}
          onClick={() => setShowAllNew(true)}
        >
          残り{hiddenRecent}件を表示
        </Button>
      )}
      {showAllNew && recent.length > VISIBLE_LIMIT && (
        <Button
          fullWidth size="small" sx={{ mt: 1 }}
          startIcon={<ExpandLessIcon />}
          onClick={() => setShowAllNew(false)}
        >
          折りたたむ
        </Button>
      )}
    </Box>
  );
}

function ScheduleRows({ items, allItems, onStatusChange, onAmountChange, onTaskCreate, property }) {
  return (
    <Box>
      {items.map((item) => {
        const globalIdx = allItems.findIndex((s) => s.no === item.no);
        const isPaid = item.status === '支払い済み';
        const isNext = !isPaid && allItems.filter((s) => s.status !== '支払い済み')[0]?.no === item.no;
        return (
          <Box
            key={item.no}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1, py: 1,
              borderBottom: '1px solid', borderColor: 'divider',
              bgcolor: isNext ? 'warning.lighter' : 'transparent',
              flexWrap: 'wrap',
              opacity: isPaid ? 0.7 : 1,
            }}
          >
            <Typography variant="body2" sx={{ width: 28, flexShrink: 0, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
              {item.no}
            </Typography>
            <Typography variant="body2" sx={{ width: 90, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
              {item.dueDate || '—'}
            </Typography>
            <TextField
              size="small" type="number"
              value={item.amount || ''}
              onChange={(e) => onAmountChange(globalIdx, e.target.value)}
              sx={{ width: 110, '& input': { fontVariantNumeric: 'tabular-nums', fontSize: '0.8rem' } }}
              InputProps={{ startAdornment: <Typography variant="caption" sx={{ mr: 0.3, color: 'text.secondary' }}>¥</Typography> }}
              disabled={isPaid}
            />
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <Select
                value={item.status}
                onChange={(e) => onStatusChange(globalIdx, e.target.value)}
              >
                {PAYMENT_STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ ml: 'auto', flexShrink: 0 }}>
              {item.taskId ? (
                <Chip
                  icon={<LinkIcon />}
                  label="タスクあり"
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
              ) : (
                <Button
                  size="small" variant="outlined" startIcon={<AddIcon />}
                  onClick={() => onTaskCreate(globalIdx, item)}
                  sx={{ fontSize: '0.72rem', py: 0.3 }}
                >
                  タスク作成
                </Button>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// ── CommentsTab ─────────────────────────────────────────────────
function CommentsTab({ entityId, entityType, initialComments }) {
  const [comments, setComments] = useState(initialComments || []);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    setComments(initialComments || []);
  }, [initialComments]);

  const handlePost = async () => {
    if (!text.trim()) return;
    setPosting(true);
    try {
      const res = await axios.post(`${API}/AddEntityComment`, { entityType, entityId, text });
      setComments((prev) => [...prev, res.data]);
      setText('');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch {
      alert('コメントの送信に失敗しました');
    } finally {
      setPosting(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {comments.length === 0 && (
        <Typography variant="body2" color="text.disabled" sx={{ py: 2, textAlign: 'center' }}>
          コメントはまだありません。
        </Typography>
      )}
      {comments.map((c) => (
        <Box key={c.id} sx={{ display: 'flex', gap: 1.5 }}>
          <Box sx={{
            width: 32, height: 32, borderRadius: '50%', bgcolor: 'primary.light',
            color: 'primary.contrastText', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0,
          }}>
            {initials(c.authorDisplayName)}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary">
              <strong style={{ color: 'inherit', opacity: 0.9 }}>{c.authorDisplayName}</strong>
              &nbsp;·&nbsp;{fmtDate(c.createdAt)}
            </Typography>
            <Box sx={{ bgcolor: 'action.hover', borderRadius: '0 8px 8px 8px', p: '7px 10px', mt: 0.3, fontSize: '0.85rem', lineHeight: 1.55 }}>
              {c.text}
            </Box>
          </Box>
        </Box>
      ))}
      <div ref={bottomRef} />
      <Divider />
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
        <TextField
          multiline rows={2} size="small" fullWidth
          placeholder="コメントを入力…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handlePost(); }}
        />
        <Tooltip title="送信 (Ctrl+Enter)">
          <span>
            <IconButton
              color="primary" onClick={handlePost}
              disabled={posting || !text.trim()}
            >
              {posting ? <CircularProgress size={20} /> : <SendIcon />}
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
}

// ── Main Modal ──────────────────────────────────────────────────
export function SheetsPropertyDetailModal({ property, open, onClose, onSaved }) {
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState({});
  const [schedule, setSchedule] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!open || !property) return;
    setTab(0);
    setSaveError('');
    setForm({
      projectName: property.projectName || property.sheetTab || '',
      roomNumber: property.roomNumber || '',
      ownerName: property.ownerName || '',
      contractDate: property.contractDate || '',
      purchasePrice: property.purchasePrice || '',
      downPayment: property.downPayment || '',
      paymentDueDay: property.paymentDueDay || '',
      paymentCount: property.paymentCount || '',
      paymentBaseAmount: property.paymentBaseAmount || '',
      paymentStartDate: property.paymentStartDate || '',
    });
    setSchedule(property.paymentSchedule || []);
  }, [open, property]);

  const residual = useMemo(
    () => calcResidual(form.purchasePrice, form.downPayment, schedule),
    [form.purchasePrice, form.downPayment, schedule],
  );

  const paidCount = schedule.filter((s) => s.status === '支払い済み').length;

  const handleGenerateSchedule = () => {
    const generated = buildSchedule(
      schedule,
      form.paymentStartDate,
      form.paymentDueDay,
      form.paymentCount,
      form.paymentBaseAmount,
    );
    setSchedule(generated);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await axios.put(`${API}/UpdateProperty/${property.id}`, {
        ...form,
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
        downPayment: form.downPayment ? Number(form.downPayment) : null,
        paymentDueDay: form.paymentDueDay ? Number(form.paymentDueDay) : null,
        paymentCount: form.paymentCount ? Number(form.paymentCount) : null,
        paymentBaseAmount: form.paymentBaseAmount ? Number(form.paymentBaseAmount) : null,
        paymentSchedule: schedule,
      });
      onSaved(res.data);
    } catch (e) {
      setSaveError(e.response?.data || e.message || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleTaskCreate = async (idx, item) => {
    try {
      const res = await axios.post(`${API}/CreateTask`, {
        title: `[中間金] ${property.propertyName || property.sheetTab} - 第${item.no}回 ${item.dueDate ? `(${item.dueDate})` : ''}`,
        description: `物件: ${property.propertyName || property.sheetTab}\n部屋: ${form.roomNumber || ''}\n第${item.no}回 中間金\n金額: ${fmtCurrency(item.amount)}\n支払い期日: ${item.dueDate || ''}`,
        dueDate: item.dueDate || undefined,
        propertyId: property.id,
      });
      setSchedule((prev) => prev.map((s, i) => i === idx ? { ...s, taskId: res.data.id } : s));
    } catch {
      alert('タスクの作成に失敗しました');
    }
  };

  if (!property) return null;

  const canGenerate = form.paymentDueDay && form.paymentCount && form.paymentBaseAmount && form.paymentStartDate;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" color="text.secondary" fontSize={11}>アジア物件</Typography>
          <Typography variant="h6" fontWeight={700} noWrap>
            {form.projectName || property.sheetTab}
            {form.roomNumber && <span style={{ fontWeight: 400, color: 'text.secondary', marginLeft: 6 }}>#{form.roomNumber}</span>}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>

      {/* Summary strip */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', bgcolor: 'divider', mx: 3, mb: 1, borderRadius: 1, overflow: 'hidden' }}>
        {[
          { label: '残代金', value: fmtCurrency(residual), color: residual > 0 ? 'warning.main' : 'success.main' },
          { label: '支払い残回数', value: schedule.length > 0 ? `${schedule.length - paidCount} / ${schedule.length}` : '—', color: 'primary.main' },
          { label: '次回支払い期日', value: schedule.find((s) => s.status !== '支払い済み')?.dueDate || (schedule.length > 0 ? '完了' : '—'), color: 'text.primary' },
        ].map(({ label, value, color }) => (
          <Box key={label} sx={{ bgcolor: 'background.paper', p: 1.5 }}>
            <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
            <Typography variant="body2" fontWeight={700} color={color}>{value}</Typography>
          </Box>
        ))}
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="基本情報" />
        <Tab label={`支払いスケジュール${schedule.length > 0 ? ` (${schedule.length})` : ''}`} />
        <Tab label={`コメント${(property.comments?.length || 0) > 0 ? ` (${property.comments.length})` : ''}`} />
      </Tabs>

      <DialogContent sx={{ pt: 2 }}>
        {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}

        {/* ── Tab 0: 基本情報 ── */}
        {tab === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField size="small" label="プロジェクト名" value={form.projectName || ''} onChange={(e) => setForm((p) => ({ ...p, projectName: e.target.value }))} />
              <TextField size="small" label="部屋番号" value={form.roomNumber || ''} onChange={(e) => setForm((p) => ({ ...p, roomNumber: e.target.value }))} />
              <TextField size="small" label="契約日" type="date" value={form.contractDate || ''} onChange={(e) => setForm((p) => ({ ...p, contractDate: e.target.value }))} InputLabelProps={{ shrink: true }} />
              <TextField size="small" label="オーナー名" value={form.ownerName || ''} onChange={(e) => setForm((p) => ({ ...p, ownerName: e.target.value }))} />
            </Box>

            <Divider><Typography variant="caption" color="text.secondary">支払い設定</Typography></Divider>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField size="small" label="購入金額 (¥)" type="number" value={form.purchasePrice || ''} onChange={(e) => setForm((p) => ({ ...p, purchasePrice: e.target.value }))} />
              <TextField size="small" label="前払金 (¥)" type="number" value={form.downPayment || ''} onChange={(e) => setForm((p) => ({ ...p, downPayment: e.target.value }))} />
              <TextField size="small" label="中間金 毎月金額 (¥)" type="number" value={form.paymentBaseAmount || ''} onChange={(e) => setForm((p) => ({ ...p, paymentBaseAmount: e.target.value }))} />
              <TextField size="small" label="支払い回数" type="number" value={form.paymentCount || ''} onChange={(e) => setForm((p) => ({ ...p, paymentCount: e.target.value }))} inputProps={{ min: 1 }} />
              <TextField size="small" label="支払い期日（毎月何日）" type="number" value={form.paymentDueDay || ''} onChange={(e) => setForm((p) => ({ ...p, paymentDueDay: e.target.value }))} inputProps={{ min: 1, max: 31 }} />
              <TextField size="small" label="初回支払い日" type="date" value={form.paymentStartDate || ''} onChange={(e) => setForm((p) => ({ ...p, paymentStartDate: e.target.value }))} InputLabelProps={{ shrink: true }} />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                {schedule.length > 0
                  ? `スケジュール生成済み（${schedule.length}回）。再生成すると金額以外をリセットします。`
                  : '「スケジュール生成」を押すと中間金テーブルを自動作成します。'}
              </Typography>
              <Button
                size="small" variant="outlined" startIcon={<AutorenewIcon />}
                onClick={handleGenerateSchedule}
                disabled={!canGenerate}
              >
                {schedule.length > 0 ? '再生成' : 'スケジュール生成'}
              </Button>
            </Box>
          </Box>
        )}

        {/* ── Tab 1: 支払いスケジュール ── */}
        {tab === 1 && (
          <PaymentScheduleTab
            property={property}
            schedule={schedule}
            onScheduleChange={setSchedule}
            onTaskCreate={handleTaskCreate}
            saving={saving}
          />
        )}

        {/* ── Tab 2: コメント ── */}
        {tab === 2 && (
          <CommentsTab
            entityId={property.id}
            entityType="property"
            initialComments={property.comments}
          />
        )}
      </DialogContent>

      {tab !== 2 && (
        <DialogActions>
          <Button onClick={onClose}>キャンセル</Button>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
