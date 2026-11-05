import { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, TextField, Tabs, Tab, Chip,
  IconButton, Tooltip, CircularProgress, Alert,
  Select, MenuItem, FormControl, InputLabel, Divider,
  LinearProgress, Paper, Autocomplete,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import SendIcon from '@mui/icons-material/Send';
import LinkIcon from '@mui/icons-material/Link';
import EmailIcon from '@mui/icons-material/Email';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

const API = '/api';

const PAYMENT_STATUSES = ['未対応', '案内済み', '支払い済み'];
const STATUS_COLORS = {
  '未対応': 'default',
  '案内済み': 'warning',
  '支払い済み': 'success',
};

const CURRENCIES = [
  { code: 'PHP', symbol: '₱', label: 'ペソ (PHP)' },
  { code: 'THB', symbol: '฿', label: 'バーツ (THB)' },
  { code: 'USD', symbol: '$', label: 'ドル (USD)' },
  { code: 'JPY', symbol: '¥', label: '円 (JPY)' },
];
const DEFAULT_CURRENCY = 'PHP';

function getCurrencySymbol(code) {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? '₱';
}

// ── Email template ──────────────────────────────────────────────
const DEFAULT_EMAIL_TEMPLATE = {
  subject: '【中間金送金のご案内】{{projectName}} {{roomNumber}} 第{{no}}回（{{dueDate}}）',
  body: `{{ownerName}} 様

いつもお世話になっております。

下記の通り、中間金のお支払い期日をご案内いたします。

■ 物件情報
プロジェクト名：{{projectName}}
部屋番号：{{roomNumber}}

■ お支払い情報
回数：第{{no}}回
支払い期日：{{dueDate}}
金額：{{currencySymbol}}{{amount}}
送金額：{{currencySymbol}}{{remittanceAmount}}

ご不明な点がございましたらお気軽にお申し付けください。

よろしくお願いいたします。`,
};

function renderTemplate(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] ?? `{{${key}}}`));
}

function buildTemplateVars(property, form, item) {
  const sym = getCurrencySymbol(form.currency || DEFAULT_CURRENCY);
  const diff = item.remittanceAmount != null && item.amount != null
    ? item.remittanceAmount - item.amount : null;
  return {
    ownerName: form.ownerName || '',
    projectName: form.projectName || property.sheetTab || '',
    roomNumber: form.roomNumber || '',
    no: String(item.no),
    dueDate: item.dueDate || '',
    amount: item.amount != null ? Number(item.amount).toLocaleString('ja-JP') : '',
    amountRaw: String(item.amount ?? ''),
    remittanceAmount: item.remittanceAmount != null ? Number(item.remittanceAmount).toLocaleString('ja-JP') : '（未入力）',
    diff: diff != null ? (diff >= 0 ? `+${Number(diff).toLocaleString('ja-JP')}` : Number(diff).toLocaleString('ja-JP')) : '',
    currency: form.currency || DEFAULT_CURRENCY,
    currencySymbol: sym,
    purchasePrice: form.purchasePrice != null ? Number(form.purchasePrice).toLocaleString('ja-JP') : '',
    downPayment: form.downPayment != null ? Number(form.downPayment).toLocaleString('ja-JP') : '',
    paymentCount: String(form.paymentCount || ''),
  };
}

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
      remittanceAmount: existing?.remittanceAmount ?? null,
      remittanceDate: existing?.remittanceDate ?? null,
    });
  }
  return result;
}

// ── Sheet data parsers ───────────────────────────────────────────
// Strip currency symbols/commas and return numeric string: "₱1,234.56" → "1234.56"
function parseAmount(val) {
  if (val === null || val === undefined || val === '') return '';
  const n = Number(String(val).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? '' : n;
}

// Extract integer from ordinal or plain string: "17th" / "17" → 17
function parseDayOrdinal(val) {
  if (!val) return '';
  const n = parseInt(String(val).replace(/\D/g, ''), 10);
  return isNaN(n) ? '' : n;
}

// Normalize date: "2023/05/17" or "2023-05-17" → "2023-05-17"
function parseSheetDate(val) {
  if (!val) return '';
  return String(val).replace(/\//g, '-').split('T')[0];
}

// ── Summary helpers ──────────────────────────────────────────────
function calcResidual(purchasePrice, downPayment, schedule) {
  const paid = (schedule || [])
    .filter((s) => s.status === '支払い済み')
    .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  return (Number(purchasePrice) || 0) - (Number(downPayment) || 0) - paid;
}

function fmtCurrency(n, currencyCode) {
  if (!n && n !== 0) return '—';
  const sym = getCurrencySymbol(currencyCode || DEFAULT_CURRENCY);
  return sym + Number(n).toLocaleString('ja-JP');
}

// ── PaymentScheduleTab ──────────────────────────────────────────
const VISIBLE_LIMIT = 10;

function PaymentScheduleTab({ property, schedule, onScheduleChange, onTaskCreate, onMailCreate, saving, currency }) {
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

  const handleRemittanceAmountChange = (idx, val) => {
    const updated = schedule.map((s, i) => i === idx ? { ...s, remittanceAmount: val === '' ? null : Number(val) } : s);
    onScheduleChange(updated);
  };

  const handleRemittanceDateChange = (idx, val) => {
    const updated = schedule.map((s, i) => i === idx ? { ...s, remittanceDate: val || null } : s);
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
          description: `物件: ${property.propertyName || property.sheetTab}\n部屋: ${property.roomNumber || ''}\n第${item.no}回 中間金\n金額: ${fmtCurrency(item.amount, currency)}\n支払い期日: ${item.dueDate || ''}`,
          deadline: item.dueDate || null,
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
          { label: '支払い済み合計', value: fmtCurrency(paidTotal, currency), color: 'success.main' },
          { label: '次回期日', value: nextDue?.dueDate || '完了', color: 'warning.main' },
        ].map(({ label, value, color }) => (
          <Paper key={label} variant="outlined" sx={{ p: 1.5, minWidth: 0, overflow: 'hidden' }}>
            <Typography variant="caption" color="text.secondary" display="block" noWrap>{label}</Typography>
            <Typography variant="body2" fontWeight={700} color={color} noWrap sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</Typography>
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
              onRemittanceAmountChange={handleRemittanceAmountChange}
              onRemittanceDateChange={handleRemittanceDateChange}
              onTaskCreate={onTaskCreate}
              onMailCreate={onMailCreate}
              property={property}
              currency={currency}
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
        onRemittanceAmountChange={handleRemittanceAmountChange}
        onRemittanceDateChange={handleRemittanceDateChange}
        onTaskCreate={onTaskCreate}
        onMailCreate={onMailCreate}
        property={property}
        currency={currency}
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

function ScheduleRows({ items, allItems, onStatusChange, onAmountChange, onRemittanceAmountChange, onRemittanceDateChange, onTaskCreate, onMailCreate, property, currency }) {
  return (
    <Box>
      {items.map((item) => {
        const globalIdx = allItems.findIndex((s) => s.no === item.no);
        const isPaid = item.status === '支払い済み';
        const isNext = !isPaid && allItems.filter((s) => s.status !== '支払い済み')[0]?.no === item.no;
        const diff = item.remittanceAmount != null && item.amount != null
          ? item.remittanceAmount - item.amount : null;
        const sym = getCurrencySymbol(currency);
        return (
          <Box
            key={item.no}
            sx={{
              py: 1.5,
              borderBottom: '1px solid', borderColor: 'divider',
              bgcolor: isNext ? 'warning.lighter' : 'transparent',
              opacity: isPaid ? 0.75 : 1,
            }}
          >
            {/* Row 1: No / 期日 / 金額 / ステータス / タスク / メール */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="body2" sx={{ width: 28, flexShrink: 0, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                {item.no}
              </Typography>
              <Typography variant="body2" sx={{ width: 90, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {item.dueDate || '—'}
              </Typography>
              <TextField
                size="small" type="number"
                label="支払い金額"
                value={item.amount || ''}
                onChange={(e) => onAmountChange(globalIdx, e.target.value)}
                sx={{ width: 130, '& input': { fontVariantNumeric: 'tabular-nums', fontSize: '0.8rem' } }}
                InputProps={{ startAdornment: <Typography variant="caption" sx={{ mr: 0.3, color: 'text.secondary' }}>{sym}</Typography> }}
                disabled={isPaid}
              />
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <Select value={item.status} onChange={(e) => onStatusChange(globalIdx, e.target.value)}>
                  {PAYMENT_STATUSES.map((s) => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box sx={{ ml: 'auto', flexShrink: 0, display: 'flex', gap: 0.5, alignItems: 'center' }}>
                <Tooltip title="送金案内メールを作成">
                  <IconButton size="small" color="primary" onClick={() => onMailCreate(item)}>
                    <EmailIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {item.taskId ? (
                  <Chip icon={<LinkIcon />} label="タスクあり" size="small" color="success" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                ) : (
                  <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => onTaskCreate(globalIdx, item)} sx={{ fontSize: '0.72rem', py: 0.3 }}>
                    タスク作成
                  </Button>
                )}
              </Box>
            </Box>

            {/* Row 2: 送金額 / 送金日 / 差異 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, pl: 4.5, flexWrap: 'wrap' }}>
              <TextField
                size="small" type="number"
                label="送金額"
                value={item.remittanceAmount ?? ''}
                onChange={(e) => onRemittanceAmountChange(globalIdx, e.target.value)}
                sx={{ width: 130, '& input': { fontVariantNumeric: 'tabular-nums', fontSize: '0.8rem' } }}
                InputProps={{ startAdornment: <Typography variant="caption" sx={{ mr: 0.3, color: 'text.secondary' }}>{sym}</Typography> }}
              />
              <TextField
                size="small" type="date"
                label="送金日"
                value={item.remittanceDate || ''}
                onChange={(e) => onRemittanceDateChange(globalIdx, e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ width: 160 }}
              />
              {diff != null && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">差異:</Typography>
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color={diff === 0 ? 'success.main' : diff > 0 ? 'primary.main' : 'error.main'}
                    sx={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {diff >= 0 ? '+' : ''}{sym}{Number(diff).toLocaleString('ja-JP')}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// ── EmailComposeDialog ───────────────────────────────────────────
function EmailComposeDialog({ open, onClose, subject, body, toEmail }) {
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);

  const copy = async (text, setCopied) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  };

  const mailtoHref = `mailto:${encodeURIComponent(toEmail || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <EmailIcon fontSize="small" />
        送金案内メール作成
        <IconButton size="small" onClick={onClose} sx={{ ml: 'auto' }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>

        {/* To */}
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.5}>宛先</Typography>
          {toEmail ? (
            <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon fontSize="small" sx={{ color: 'primary.main' }} />
              <Typography variant="body2" fontWeight={600}>{toEmail}</Typography>
            </Box>
          ) : (
            <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary" fontSize="0.8rem">
                顧客レコードにメールアドレスが未登録です。メールアプリで手動入力してください。
              </Typography>
            </Box>
          )}
        </Box>

        {/* Subject */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>件名</Typography>
            <Tooltip title={copiedSubject ? 'コピーしました' : '件名をコピー'}>
              <IconButton size="small" onClick={() => copy(subject, setCopiedSubject)}>
                <ContentCopyIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1, fontSize: '0.875rem' }}>
            {subject}
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>本文</Typography>
            <Tooltip title={copiedBody ? 'コピーしました' : '本文をコピー'}>
              <IconButton size="small" onClick={() => copy(body, setCopiedBody)}>
                <ContentCopyIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{
            p: 1.5, bgcolor: 'action.hover', borderRadius: 1,
            fontSize: '0.875rem', whiteSpace: 'pre-wrap', lineHeight: 1.7,
            maxHeight: 300, overflowY: 'auto',
          }}>
            {body}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
        <Button
          variant="contained" startIcon={<EmailIcon />}
          component="a" href={mailtoHref}
          onClick={onClose}
        >
          メールアプリで開く
        </Button>
      </DialogActions>
    </Dialog>
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
  const [customers, setCustomers] = useState([]);
  const [linkedCustomer, setLinkedCustomer] = useState(null);
  const [emailCompose, setEmailCompose] = useState(null); // { subject, body }

  useEffect(() => {
    if (!open) return;
    axios.get(`${API}/GetCustomers`).then((r) => setCustomers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open || !property) return;
    setTab(0);
    setSaveError('');
    setForm({
      projectName: property.projectName || property.sheetTab || '',
      roomNumber: property.roomNumber || '',
      ownerName: property.ownerName || '',
      contractDate: parseSheetDate(property.contractDate),
      purchasePrice: parseAmount(property.purchasePrice),
      downPayment: parseAmount(property.downPayment),
      paymentDueDay: parseDayOrdinal(property.paymentDueDay),
      paymentCount: parseDayOrdinal(property.paymentCount),
      paymentBaseAmount: parseAmount(property.paymentBaseAmount),
      paymentStartDate: parseSheetDate(property.paymentStartDate),
      currency: property.currency || DEFAULT_CURRENCY,
      linkedCustomerId: property.linkedCustomerId || null,
      linkedCustomerName: property.linkedCustomerName || '',
      emailTemplate: property.emailTemplate || DEFAULT_EMAIL_TEMPLATE,
    });
    setSchedule(property.paymentSchedule || []);
  }, [open, property]);

  useEffect(() => {
    if (!open || !property?.linkedCustomerId || customers.length === 0) {
      setLinkedCustomer(null);
      return;
    }
    setLinkedCustomer(customers.find((c) => c.id === property.linkedCustomerId) || null);
  }, [open, property, customers]);

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
        emailTemplate: form.emailTemplate,
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
        description: `物件: ${property.propertyName || property.sheetTab}\n部屋: ${form.roomNumber || ''}\n第${item.no}回 中間金\n金額: ${fmtCurrency(item.amount, form.currency)}\n支払い期日: ${item.dueDate || ''}`,
        deadline: item.dueDate || null,
        propertyId: property.id,
      });
      setSchedule((prev) => prev.map((s, i) => i === idx ? { ...s, taskId: res.data.id } : s));
    } catch {
      alert('タスクの作成に失敗しました');
    }
  };

  const handleMailCreate = (item) => {
    const tpl = form.emailTemplate || DEFAULT_EMAIL_TEMPLATE;
    const vars = buildTemplateVars(property, form, item);
    setEmailCompose({
      subject: renderTemplate(tpl.subject || '', vars),
      body: renderTemplate(tpl.body || '', vars),
      toEmail: linkedCustomer?.email || '',
    });
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
      <Box sx={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        border: '1px solid', borderColor: 'divider',
        borderRadius: 1, mx: 3, mb: 1,
      }}>
        {[
          { label: '残代金', value: fmtCurrency(residual, form.currency), color: residual > 0 ? 'warning.main' : 'success.main' },
          { label: '支払い残回数', value: schedule.length > 0 ? `${schedule.length - paidCount} / ${schedule.length}` : '—', color: 'primary.main' },
          { label: '次回支払い期日', value: schedule.find((s) => s.status !== '支払い済み')?.dueDate || (schedule.length > 0 ? '完了' : '—'), color: 'text.primary' },
        ].map(({ label, value, color }, i, arr) => (
          <Box key={label} sx={{
            p: 1.5, minWidth: 0,
            borderRight: i < arr.length - 1 ? '1px solid' : 'none',
            borderColor: 'divider',
          }}>
            <Typography variant="caption" color="text.secondary" display="block" noWrap>{label}</Typography>
            <Typography variant="body2" fontWeight={700} color={color} noWrap sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</Typography>
          </Box>
        ))}
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="基本情報" />
        <Tab label={`支払いスケジュール${schedule.length > 0 ? ` (${schedule.length})` : ''}`} />
        <Tab label={`コメント${(property.comments?.length || 0) > 0 ? ` (${property.comments.length})` : ''}`} />
        <Tab label="メール設定" />
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

            <Divider><Typography variant="caption" color="text.secondary">オーナー紐づけ</Typography></Divider>

            <Autocomplete
              size="small"
              options={customers}
              getOptionLabel={(c) => `${c.name || ''}${c.nameKana ? `（${c.nameKana}）` : ''}`}
              value={linkedCustomer}
              onChange={(_, val) => {
                setLinkedCustomer(val);
                setForm((p) => ({
                  ...p,
                  linkedCustomerId: val?.id || null,
                  linkedCustomerName: val?.name || '',
                  ownerName: p.ownerName || val?.name || '',
                }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="顧客（オーナー）と紐づける"
                  placeholder="名前で検索..."
                  InputProps={{ ...params.InputProps, startAdornment: <PersonIcon fontSize="small" sx={{ mr: 0.5, color: 'action.active' }} /> }}
                />
              )}
              renderOption={(props, c) => (
                <li {...props} key={c.id}>
                  <Box>
                    <Typography variant="body2">{c.name}</Typography>
                    {c.nameKana && <Typography variant="caption" color="text.secondary">{c.nameKana}</Typography>}
                  </Box>
                </li>
              )}
              noOptionsText="顧客が見つかりません"
              clearOnEscape
              sx={{ gridColumn: '1 / -1' }}
            />
            {form.linkedCustomerId && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  icon={<PersonIcon />}
                  label={form.linkedCustomerName || form.linkedCustomerId}
                  size="small"
                  color="primary"
                  variant="outlined"
                  onDelete={() => {
                    setLinkedCustomer(null);
                    setForm((p) => ({ ...p, linkedCustomerId: null, linkedCustomerName: '' }));
                  }}
                />
                <Typography variant="caption" color="text.secondary">顧客レコードと紐づき済み</Typography>
              </Box>
            )}

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            </Box>

            <Divider><Typography variant="caption" color="text.secondary">支払い設定</Typography></Divider>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <FormControl size="small" sx={{ gridColumn: '1 / -1' }}>
                <InputLabel>通貨</InputLabel>
                <Select
                  label="通貨"
                  value={form.currency || DEFAULT_CURRENCY}
                  onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
                >
                  {CURRENCIES.map((c) => (
                    <MenuItem key={c.code} value={c.code}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ minWidth: 24, fontWeight: 700, color: 'primary.main' }}>{c.symbol}</Typography>
                        <Typography>{c.label}</Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField size="small" label={`購入金額 (${getCurrencySymbol(form.currency)})`} type="number" value={form.purchasePrice || ''} onChange={(e) => setForm((p) => ({ ...p, purchasePrice: e.target.value }))} />
              <TextField size="small" label={`前払金 (${getCurrencySymbol(form.currency)})`} type="number" value={form.downPayment || ''} onChange={(e) => setForm((p) => ({ ...p, downPayment: e.target.value }))} />
              <TextField size="small" label={`中間金 毎月金額 (${getCurrencySymbol(form.currency)})`} type="number" value={form.paymentBaseAmount || ''} onChange={(e) => setForm((p) => ({ ...p, paymentBaseAmount: e.target.value }))} />
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
            onMailCreate={handleMailCreate}
            saving={saving}
            currency={form.currency}
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

        {/* ── Tab 3: メール設定 ── */}
        {tab === 3 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
              テンプレートで使える変数：
              {' '}
              {[
                '{{ownerName}}', '{{projectName}}', '{{roomNumber}}',
                '{{no}}', '{{dueDate}}', '{{amount}}', '{{remittanceAmount}}',
                '{{diff}}', '{{currencySymbol}}', '{{currency}}',
                '{{purchasePrice}}', '{{downPayment}}', '{{paymentCount}}',
              ].map((v) => (
                <Chip key={v} label={v} size="small" variant="outlined" sx={{ mr: 0.5, mb: 0.5, fontSize: '0.72rem', fontFamily: 'monospace' }} />
              ))}
            </Alert>
            <TextField
              size="small"
              label="件名テンプレート"
              fullWidth
              value={form.emailTemplate?.subject || ''}
              onChange={(e) => setForm((p) => ({ ...p, emailTemplate: { ...p.emailTemplate, subject: e.target.value } }))}
            />
            <TextField
              label="本文テンプレート"
              fullWidth
              multiline
              rows={12}
              value={form.emailTemplate?.body || ''}
              onChange={(e) => setForm((p) => ({ ...p, emailTemplate: { ...p.emailTemplate, body: e.target.value } }))}
              sx={{ '& textarea': { fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: 1.6 } }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small" variant="outlined"
                onClick={() => setForm((p) => ({ ...p, emailTemplate: DEFAULT_EMAIL_TEMPLATE }))}
              >
                デフォルトに戻す
              </Button>
              {schedule.length > 0 && (
                <Button
                  size="small" variant="contained" startIcon={<EmailIcon />}
                  onClick={() => handleMailCreate(schedule[0])}
                >
                  第1回でプレビュー
                </Button>
              )}
            </Box>
          </Box>
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

      {emailCompose && (
        <EmailComposeDialog
          open={Boolean(emailCompose)}
          onClose={() => setEmailCompose(null)}
          subject={emailCompose.subject}
          body={emailCompose.body}
          toEmail={emailCompose.toEmail}
        />
      )}
    </Dialog>
  );
}
