import { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Chip, CircularProgress, Alert, Dialog, DialogTitle, DialogContent,
  DialogActions, LinearProgress, InputAdornment, IconButton, Tooltip,
  Divider, List, ListItem, ListItemText, RadioGroup, FormControlLabel, Radio,
  Tabs, Tab, Checkbox, Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import { SheetsPropertyDetailModal } from './SheetsPropertyDetailModal';
import { FileImportDialog } from './FileImportDialog';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ClearIcon from '@mui/icons-material/Clear';
import SyncIcon from '@mui/icons-material/Sync';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import AddIcon from '@mui/icons-material/Add';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const API = '/api';
const MGMT_TYPES = ['PM', 'PCS A', 'PCS B'];
const MGMT_COLORS = { PM: 'primary', 'PCS A': 'success', 'PCS B': 'warning' };

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ImportDialog({ open, onClose, onImported }) {
  const [files, setFiles] = useState({ property: null, propertyGroup: null, tenant: null, owner: null });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const fileLabels = [
    { key: 'property', label: 'Property Directory（必須）', accept: '.xlsx' },
    { key: 'propertyGroup', label: 'Property Group Directory', accept: '.xlsx' },
    { key: 'tenant', label: 'Tenant Directory', accept: '.xlsx' },
    { key: 'owner', label: 'Owner Directory', accept: '.xlsx' },
  ];

  const handleFile = (key, file) => setFiles(prev => ({ ...prev, [key]: file }));

  const handleImport = async () => {
    if (!files.property) return;
    setLoading(true);
    setResult(null);
    try {
      const body = { importSource: 'manual' };
      if (files.property) body.propertyFile = await fileToBase64(files.property);
      if (files.propertyGroup) body.propertyGroupFile = await fileToBase64(files.propertyGroup);
      if (files.tenant) body.tenantFile = await fileToBase64(files.tenant);
      if (files.owner) body.ownerFile = await fileToBase64(files.owner);

      const { data } = await axios.post(`${API}/AppfolioImport`, body);
      setResult(data);
      if (data.ok) onImported();
    } catch (e) {
      setResult({ ok: false, error: e.response?.data || e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFiles({ property: null, propertyGroup: null, tenant: null, owner: null });
    setResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Appfolio データインポート</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          AppfolioからエクスポートしたExcelファイルを選択してください。Property Directoryのみ必須です。
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {fileLabels.map(({ key, label }) => (
            <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Button
                variant="outlined"
                component="label"
                size="small"
                startIcon={<UploadFileIcon />}
                sx={{ minWidth: 140, flexShrink: 0 }}
              >
                選択
                <input type="file" accept=".xlsx" hidden onChange={e => handleFile(key, e.target.files[0])} />
              </Button>
              <Box>
                <Typography variant="caption" display="block" color="text.secondary">{label}</Typography>
                <Typography variant="body2">{files[key]?.name || '未選択'}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
        {loading && <LinearProgress sx={{ mt: 2 }} />}
        {result && (
          <Alert severity={result.ok ? 'success' : 'error'} sx={{ mt: 2 }}>
            {result.ok
              ? `完了: 新規 ${result.created}件、更新 ${result.updated}件、エラー ${result.errors}件（合計 ${result.total}件）`
              : `エラー: ${result.error}`}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>閉じる</Button>
        <Button
          variant="contained"
          onClick={handleImport}
          disabled={!files.property || loading}
        >
          インポート実行
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function EditDialog({ property, open, onClose, onSaved }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [propertyTasks, setPropertyTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState('Started');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [savingTask, setSavingTask] = useState(false);

  useEffect(() => {
    if (property) {
      setForm({
        buildingName: property.buildingName || (property.propertyName?.includes('#') ? property.propertyName.split('#')[0].trim() : property.propertyName) || '',
        managementType: property.managementType || '',
        ownerName: property.ownerName || '',
        ownerPhone: property.ownerPhone || '',
        registrationDate: property.registrationDate || '',
        purchasePrice: property.purchasePrice || '',
        tenantStatus: property.tenantStatus || '',
        leaseStart: property.leaseStart || '',
        leaseEnd: property.leaseEnd || '',
        monthlyRent: property.monthlyRent || '',
        notes: property.notes || '',
      });
      setPropertyTasks([]);
      setAddTaskOpen(false);
      setNewTaskTitle('');
      setNewTaskStatus('Started');
      setNewTaskDeadline('');
      setLoadingTasks(true);
      axios.get(`${API}/GetTasks?propertyId=${property.id}`)
        .then((res) => setPropertyTasks(Array.isArray(res.data) ? res.data : []))
        .catch(() => {})
        .finally(() => setLoadingTasks(false));
    }
  }, [property]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await axios.put(`${API}/UpdateProperty/${property.id}`, {
        ...form,
        monthlyRent: form.monthlyRent ? Number(form.monthlyRent) : null,
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
      });
      onSaved(data);
      onClose();
    } catch (e) {
      alert('保存に失敗しました: ' + (e.response?.data || e.message));
    } finally {
      setSaving(false);
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    setSavingTask(true);
    try {
      const res = await axios.post(`${API}/CreateTask`, {
        title: newTaskTitle.trim(),
        status: newTaskStatus,
        deadline: newTaskDeadline || null,
        propertyId: property.id,
      });
      setPropertyTasks((prev) => [...prev, res.data]);
      setNewTaskTitle('');
      setNewTaskStatus('Started');
      setNewTaskDeadline('');
      setAddTaskOpen(false);
    } catch {
      alert('タスクの作成に失敗しました。');
    } finally {
      setSavingTask(false);
    }
  };

  if (!property) return null;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography variant="subtitle1" fontWeight={700}>{property.propertyName}</Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField size="small" label="建物名" value={form.buildingName || ''} onChange={e => setForm(p => ({ ...p, buildingName: e.target.value }))} fullWidth helperText="物件名の # より前を自動取得。手動で修正可能" />
          <FormControl size="small" fullWidth>
            <InputLabel>管理形態</InputLabel>
            <Select value={form.managementType || ''} label="管理形態" onChange={e => setForm(p => ({ ...p, managementType: e.target.value }))}>
              <MenuItem value="">未設定</MenuItem>
              {MGMT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="オーナー名" value={form.ownerName || ''} onChange={e => setForm(p => ({ ...p, ownerName: e.target.value }))} fullWidth />
          <TextField size="small" label="オーナー電話" value={form.ownerPhone || ''} onChange={e => setForm(p => ({ ...p, ownerPhone: e.target.value }))} fullWidth />
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField size="small" label="登記日" type="date" value={form.registrationDate || ''} onChange={e => setForm(p => ({ ...p, registrationDate: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField size="small" label="購入価格 ($)" type="number" value={form.purchasePrice || ''} onChange={e => setForm(p => ({ ...p, purchasePrice: e.target.value }))} fullWidth />
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField size="small" label="賃貸開始日" type="date" value={form.leaseStart || ''} onChange={e => setForm(p => ({ ...p, leaseStart: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField size="small" label="賃貸終了日" type="date" value={form.leaseEnd || ''} onChange={e => setForm(p => ({ ...p, leaseEnd: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
          </Box>
          <TextField size="small" label="月額賃料 ($)" type="number" value={form.monthlyRent || ''} onChange={e => setForm(p => ({ ...p, monthlyRent: e.target.value }))} fullWidth />
          <TextField size="small" label="メモ" value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} multiline rows={3} fullWidth />

          {/* タスク */}
          <Box sx={{ pt: 0.5 }}>
            <Divider sx={{ mb: 1.5 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <TaskAltIcon fontSize="small" color="action" />
              <Typography variant="body2" fontWeight={600}>タスク</Typography>
              {propertyTasks.length > 0 && <Chip label={propertyTasks.length} size="small" />}
              <Box sx={{ flexGrow: 1 }} />
              <Tooltip title="タスクを追加">
                <IconButton size="small" onClick={() => setAddTaskOpen(true)}>
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            {addTaskOpen && (
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, mb: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <TextField
                  label="タスクタイトル" size="small" fullWidth
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  autoFocus
                />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>ステータス</InputLabel>
                    <Select label="ステータス" value={newTaskStatus} onChange={(e) => setNewTaskStatus(e.target.value)}>
                      {['Memo','Started','WaitingEstimate','Inprogress','WaitingOwnerApproval','WaitingCompletionReport','DoneWithoutReport','Done'].map((s) => (
                        <MenuItem key={s} value={s}>{s}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    label="期限" type="date" size="small"
                    value={newTaskDeadline}
                    onChange={(e) => setNewTaskDeadline(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ flex: 1 }}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                  <Button size="small" onClick={() => setAddTaskOpen(false)}>キャンセル</Button>
                  <Button size="small" variant="contained" onClick={handleAddTask} disabled={savingTask || !newTaskTitle.trim()}>
                    {savingTask ? '作成中…' : '追加'}
                  </Button>
                </Box>
              </Box>
            )}
            {loadingTasks ? (
              <CircularProgress size={20} />
            ) : propertyTasks.length === 0 ? (
              <Typography variant="body2" color="text.disabled">タスクはありません</Typography>
            ) : (
              <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem' }}>タイトル</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem' }}>ステータス</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem' }}>担当者</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem' }}>期限</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {propertyTasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell sx={{ fontSize: '0.8rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {task.title}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={task.status}
                            size="small"
                            color={task.status === 'Done' ? 'success' : task.status === 'Inprogress' ? 'warning' : 'default'}
                            sx={{ fontSize: '0.65rem', height: 18 }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                          {Array.isArray(task.assignees) && task.assignees.length > 0 ? task.assignees.join(', ') : '—'}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                          {task.deadline ? task.deadline.split('T')[0] : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>保存</Button>
      </DialogActions>
    </Dialog>
  );
}

function SyncToCRMDialog({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  // decisions: { ownerName → { action: 'link'|'create'|'skip', customerId? } }
  const [decisions, setDecisions] = useState({});
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data } = await axios.post(`${API}/SyncPropertiesToCRM`, { dryRun: true });
      setAnalysis(data.analysis);
      // Init decisions
      const init = {};
      for (const item of data.analysis) {
        if (item.type === 'exact') init[item.owner.ownerName] = { action: 'link', customerId: item.customer.id };
        else if (item.type === 'new') init[item.owner.ownerName] = { action: 'create' };
        else init[item.owner.ownerName] = { action: 'skip' }; // fuzzy: default skip until user picks
      }
      setDecisions(init);
    } catch (e) {
      setResult({ ok: false, error: e.response?.data || e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    setExecuting(true);
    try {
      const mappings = Object.entries(decisions).map(([ownerName, d]) => ({ ownerName, ...d }));
      const { data } = await axios.post(`${API}/SyncPropertiesToCRM`, { dryRun: false, mappings });
      setResult({ ok: true, results: data.results });
    } catch (e) {
      setResult({ ok: false, error: e.response?.data || e.message });
    } finally {
      setExecuting(false);
    }
  };

  const handleClose = () => {
    setAnalysis(null);
    setDecisions({});
    setResult(null);
    onClose();
  };

  const setDecision = (ownerName, action, customerId) =>
    setDecisions(prev => ({ ...prev, [ownerName]: { action, customerId } }));

  const exact = analysis?.filter(x => x.type === 'exact') || [];
  const fuzzy = analysis?.filter(x => x.type === 'fuzzy') || [];
  const newOnes = analysis?.filter(x => x.type === 'new') || [];

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>CRM同期 — オーナー情報をCRMに反映</DialogTitle>
      <DialogContent dividers>
        {!analysis && !loading && !result && (
          <Typography color="text.secondary">
            Appfolio物件データのオーナー情報とCRM顧客リストを照合します。
            「分析開始」を押してください。
          </Typography>
        )}
        {loading && <LinearProgress sx={{ my: 2 }} />}
        {result && !result.ok && <Alert severity="error">{result.error}</Alert>}
        {result?.ok && (
          <Alert severity="success">
            完了: {result.results.filter(r => r.action === 'created').length}件新規作成、
            {result.results.filter(r => r.action === 'linked').length}件リンク済み、
            {result.results.filter(r => r.action === 'skipped').length}件スキップ
          </Alert>
        )}

        {analysis && !result && (
          <Box>
            {/* 完全一致 */}
            {exact.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="success.main" sx={{ mb: 1 }}>
                  完全一致 ({exact.length}件) — 自動リンク
                </Typography>
                <List dense disablePadding>
                  {exact.map(item => (
                    <ListItem key={item.owner.ownerName} sx={{ pl: 0 }}>
                      <ListItemText
                        primary={item.owner.ownerName}
                        secondary={`CRM: ${item.customer.name} / 物件: ${item.owner.propertyNames.join(', ')}`}
                      />
                    </ListItem>
                  ))}
                </List>
                <Divider sx={{ mt: 1 }} />
              </Box>
            )}

            {/* 類似名（表記ゆれ候補） */}
            {fuzzy.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="warning.main" sx={{ mb: 1 }}>
                  類似名あり — 要確認 ({fuzzy.length}件)
                </Typography>
                {fuzzy.map(item => (
                  <Paper key={item.owner.ownerName} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                    <Typography variant="body2" fontWeight={600}>{item.owner.ownerName}</Typography>
                    <Typography variant="caption" color="text.secondary">物件: {item.owner.propertyNames.join(', ')}</Typography>
                    <RadioGroup
                      value={decisions[item.owner.ownerName]?.action === 'link'
                        ? decisions[item.owner.ownerName]?.customerId
                        : decisions[item.owner.ownerName]?.action || 'skip'}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === 'create') setDecision(item.owner.ownerName, 'create', null);
                        else if (val === 'skip') setDecision(item.owner.ownerName, 'skip', null);
                        else setDecision(item.owner.ownerName, 'link', val);
                      }}
                    >
                      {item.candidates.map(({ customer, score }) => (
                        <FormControlLabel
                          key={customer.id}
                          value={customer.id}
                          control={<Radio size="small" />}
                          label={`${customer.name} (類似度 ${Math.round(score * 100)}%)`}
                        />
                      ))}
                      <FormControlLabel value="create" control={<Radio size="small" />} label="新規顧客として作成" />
                      <FormControlLabel value="skip" control={<Radio size="small" />} label="スキップ" />
                    </RadioGroup>
                  </Paper>
                ))}
                <Divider sx={{ mt: 1 }} />
              </Box>
            )}

            {/* 新規 */}
            {newOnes.length > 0 && (
              <Box>
                <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
                  新規作成 ({newOnes.length}件)
                </Typography>
                <List dense disablePadding>
                  {newOnes.map(item => (
                    <ListItem key={item.owner.ownerName} sx={{ pl: 0 }}>
                      <ListItemText
                        primary={item.owner.ownerName}
                        secondary={`物件: ${item.owner.propertyNames.join(', ')}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>閉じる</Button>
        {!analysis && !result && (
          <Button variant="outlined" onClick={handleAnalyze} disabled={loading}>
            分析開始
          </Button>
        )}
        {analysis && !result && (
          <Button variant="contained" onClick={handleExecute} disabled={executing}>
            {executing ? '同期中...' : '同期実行'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

const SHEET_SYSTEM_FIELDS = new Set([
  'id', '_rowIndex', '_spreadsheetId', 'importSource', 'sheetTab',
  'propertyName', 'importedAt', 'updatedAt', '_etag', '_rid', '_self',
  '_attachments', '_ts',
  // 配列フィールド — テーブルセルに描画するとReactがクラッシュするため除外
  'paymentSchedule', 'comments',
]);

const PROPERTY_COLUMN_GUIDE = (
  <>
    物件コード（ID用・推奨）/ タブ名（グループ）/ プロジェクト名 / 部屋番号 / オーナー名<br />
    契約日（YYYY-MM-DD）/ 購入金額 / 前払金 / 毎月中間金 / 支払い回数 / 支払日 / 初回支払い日<br />
    通貨（PHP / THB / USD / JPY）
  </>
);

const CUSTOMER_COLUMN_GUIDE = (
  <>
    顧客コード（ID用・推奨）/ 名前（必須）/ 名前（カナ）/ メールアドレス / 電話番号<br />
    国 / 地域 / 担当者 / ステータス / メモ
  </>
);

function SheetsImportDialog({ open, onClose, onImported }) {
  return (
    <FileImportDialog
      open={open}
      onClose={onClose}
      onImported={onImported}
      title="Excel / CSV インポート（アジア物件）"
      apiEndpoint={`${API}/ImportPropertiesFromFile`}
      columnGuide={PROPERTY_COLUMN_GUIDE}
      extraFields={[{ label: 'タブ名（グループ名）', stateKey: 'sheetTab', placeholder: '例: フィリピン' }]}
      buildExtraPayload={(s) => ({ sheetTab: s.sheetTab || 'インポート' })}
    />
  );
}

function OwnerImportDialog({ open, onClose }) {
  return (
    <FileImportDialog
      open={open}
      onClose={onClose}
      onImported={() => {}}
      title="Excel / CSV インポート（オーナー / 顧客）"
      apiEndpoint={`${API}/ImportCustomersFromFile`}
      columnGuide={CUSTOMER_COLUMN_GUIDE}
    />
  );
}

// slugify matching the server-side safeSlug in ImportCustomersFromFile.js
function safeSlug(s) {
  return String(s || '').trim().replace(/[/\\#?&\s@.]/g, '_').slice(0, 100);
}

function RegisterOwnersDialog({ open, onClose, properties, onDone }) {
  const [step, setStep] = useState('preview'); // 'preview' | 'done'
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState(null);

  // Build unique owners from Asia properties that have ownerName
  const owners = useMemo(() => {
    const map = new Map(); // ownerName → { ownerName, props: Property[] }
    for (const p of properties) {
      if (!p.ownerName) continue;
      const key = p.ownerName.trim();
      if (!map.has(key)) map.set(key, { ownerName: key, props: [] });
      map.get(key).props.push(p);
    }
    return [...map.values()].sort((a, b) => a.ownerName.localeCompare(b.ownerName, 'ja'));
  }, [properties]);

  const unlinked = useMemo(
    () => owners.filter((o) => o.props.some((p) => !p.linkedCustomerId)),
    [owners],
  );

  useEffect(() => {
    if (open) { setStep('preview'); setResult(null); }
  }, [open]);

  const handleRegister = async () => {
    setWorking(true);
    try {
      // 1. Register all unique owners as customers with ASIA tag
      const rows = unlinked.map((o) => ({ 名前: o.ownerName, タグ: 'ASIA' }));
      await axios.post(`${API}/ImportCustomersFromFile`, { rows });

      // 2. Link each unlinked property to its customer
      const linkPromises = [];
      for (const o of unlinked) {
        const customerId = `customer-file-${safeSlug(o.ownerName)}`;
        for (const p of o.props) {
          if (!p.linkedCustomerId) {
            linkPromises.push(
              axios.put(`${API}/UpdateProperty/${p.id}`, {
                linkedCustomerId: customerId,
                linkedCustomerName: o.ownerName,
              }).then((res) => res.data)
            );
          }
        }
      }
      const updated = await Promise.all(linkPromises);
      setResult({ linked: updated.length, owners: unlinked.length });
      setStep('done');
      onDone(updated);
    } catch (e) {
      alert('登録に失敗しました: ' + (e.response?.data || e.message));
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>オーナーをCRMに一括登録</DialogTitle>
      <DialogContent>
        {step === 'preview' && (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              アジア物件のオーナー名から顧客レコードを作成し、物件と自動的に紐づけます。<br />
              対象: 未リンクのオーナー <strong>{unlinked.length}名</strong>（物件 {unlinked.reduce((n, o) => n + o.props.filter((p) => !p.linkedCustomerId).length, 0)}件）
            </Alert>
            {unlinked.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                すべての物件のオーナーがリンク済みです。
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>オーナー名</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>未リンク物件</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {unlinked.map((o) => (
                    <TableRow key={o.ownerName}>
                      <TableCell>{o.ownerName}</TableCell>
                      <TableCell>
                        {o.props.filter((p) => !p.linkedCustomerId).map((p) => (
                          <Chip
                            key={p.id}
                            size="small"
                            label={[p.projectName, p.towerName, p.roomNumber].filter(Boolean).join(' ')}
                            sx={{ mr: 0.5, mb: 0.3 }}
                          />
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
        {step === 'done' && result && (
          <Alert severity="success">
            {result.owners}名の顧客レコードを作成し、{result.linked}件の物件を紐づけました。
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{step === 'done' ? '閉じる' : 'キャンセル'}</Button>
        {step === 'preview' && unlinked.length > 0 && (
          <Button variant="contained" onClick={handleRegister} disabled={working}>
            {working ? '登録中...' : '登録してリンクする'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

const ASIA_COLUMNS = [
  { key: 'projectName', label: 'プロジェクト名', minWidth: 160 },
  { key: 'towerName', label: 'タワー名', minWidth: 100 },
  { key: 'roomNumber', label: '部屋番号', minWidth: 80 },
  { key: 'ownerName', label: 'オーナー名', minWidth: 140 },
  { key: 'contractDate', label: '契約日', minWidth: 100 },
  { key: 'currency', label: '通貨', minWidth: 60 },
  { key: 'purchasePrice', label: '購入金額', minWidth: 100 },
  { key: 'paymentCount', label: '支払い回数', minWidth: 90 },
];

function SheetsPropertiesTab({ properties, onImportOpen, onDelete, onRowClick }) {
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedTower, setSelectedTower] = useState('');
  const [search, setSearch] = useState('');

  const projects = useMemo(
    () => [...new Set(properties.map((p) => p.projectName).filter(Boolean))].sort(),
    [properties],
  );

  const towers = useMemo(() => {
    const src = selectedProject
      ? properties.filter((p) => p.projectName === selectedProject)
      : properties;
    return [...new Set(src.map((p) => p.towerName).filter(Boolean))].sort();
  }, [properties, selectedProject]);

  // reset tower when project changes
  useEffect(() => { setSelectedTower(''); }, [selectedProject]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return properties.filter((p) => {
      if (selectedProject && p.projectName !== selectedProject) return false;
      if (selectedTower && p.towerName !== selectedTower) return false;
      if (q) {
        return ASIA_COLUMNS.some((col) => String(p[col.key] ?? '').toLowerCase().includes(q));
      }
      return true;
    });
  }, [properties, selectedProject, selectedTower, search]);

  if (properties.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
        <Typography variant="body1">データがありません。</Typography>
        <Button variant="outlined" startIcon={<CloudDownloadIcon />} sx={{ mt: 2 }} onClick={onImportOpen}>
          ファイルからインポート
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>プロジェクト</InputLabel>
          <Select
            value={selectedProject}
            label="プロジェクト"
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            <MenuItem value="">すべて ({properties.length}件)</MenuItem>
            {projects.map((proj) => (
              <MenuItem key={proj} value={proj}>
                {proj} ({properties.filter((p) => p.projectName === proj).length}件)
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {towers.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>タワー</InputLabel>
            <Select
              value={selectedTower}
              label="タワー"
              onChange={(e) => setSelectedTower(e.target.value)}
            >
              <MenuItem value="">すべて</MenuItem>
              {towers.map((tw) => (
                <MenuItem key={tw} value={tw}>{tw}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <TextField
          size="small"
          placeholder="検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 200 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
            endAdornment: search && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearch('')}><ClearIcon fontSize="small" /></IconButton>
              </InputAdornment>
            ),
          }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
          {filtered.length} / {properties.length} 件
        </Typography>
      </Box>

      <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 320px)' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {ASIA_COLUMNS.map((col) => (
                <TableCell key={col.key} sx={{ fontWeight: 700, whiteSpace: 'nowrap', minWidth: col.minWidth }}>
                  {col.label}
                </TableCell>
              ))}
              <TableCell sx={{ fontWeight: 700, width: 60 }} align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={ASIA_COLUMNS.length + 1} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  条件に一致するデータがありません。
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow
                  key={p.id} hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => onRowClick && onRowClick(p)}
                >
                  {ASIA_COLUMNS.map((col) => (
                    <TableCell key={col.key} sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Tooltip title={String(p[col.key] ?? '')} placement="top">
                        <span>{p[col.key] || '—'}</span>
                      </Tooltip>
                    </TableCell>
                  ))}
                  <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                    <Tooltip title="削除">
                      <IconButton size="small" color="error" onClick={() => onDelete(p)}>
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
    </Box>
  );
}

export function PropertiesView() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMgmt, setFilterMgmt] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [activeView, setActiveView] = useState('appfolio');
  const [sheetsImportOpen, setSheetsImportOpen] = useState(false);
  const [sheetsEditTarget, setSheetsEditTarget] = useState(null);
  const [ownerImportOpen, setOwnerImportOpen] = useState(false);
  const [registerOwnersOpen, setRegisterOwnersOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/GetProperties`);
      setProperties(data);
    } catch (e) {
      console.error('GetProperties failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (p) => {
    if (!window.confirm(`「${p.propertyName}」を削除しますか？`)) return;
    await axios.delete(`${API}/DeleteProperty/${p.id}`);
    setProperties(prev => prev.filter(x => x.id !== p.id));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await axios.get(`${API}/ExportPropertiesExcel`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `properties_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('エクスポートに失敗しました');
    } finally {
      setExporting(false);
    }
  };

  const appfolioProperties = properties.filter((p) => p.importSource !== 'sheets' && p.importSource !== 'file');
  const sheetsProperties = properties.filter((p) => p.importSource === 'sheets' || p.importSource === 'file');

  const handleAsiaExport = () => {
    const FIELD_MAP = [
      ['タブ名', 'sheetTab'],
      ['プロジェクト名', 'projectName'],
      ['タワー名', 'towerName'],
      ['部屋番号', 'roomNumber'],
      ['オーナー名', 'ownerName'],
      ['契約日', 'contractDate'],
      ['購入金額', 'purchasePrice'],
      ['前払金', 'downPayment'],
      ['毎月中間金', 'paymentBaseAmount'],
      ['支払い回数', 'paymentCount'],
      ['支払日', 'paymentDueDay'],
      ['初回支払い日', 'paymentStartDate'],
      ['通貨', 'currency'],
    ];
    const rows = sheetsProperties.map((p) => {
      const row = {};
      for (const [ja, en] of FIELD_MAP) row[ja] = p[en] ?? '';
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'アジア物件');
    XLSX.writeFile(wb, `asia_properties_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const filtered = appfolioProperties.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || (p.propertyName || '').toLowerCase().includes(q) || (p.ownerName || '').toLowerCase().includes(q);
    const matchMgmt = !filterMgmt || p.managementType === filterMgmt;
    const matchStatus = !filterStatus || p.tenantStatus === filterStatus;
    return matchSearch && matchMgmt && matchStatus;
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Typography variant="h5" fontWeight={600}>物件管理</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {activeView === 'appfolio' && (
            <>
              <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setImportOpen(true)}>
                Appfolio インポート
              </Button>
              <Button variant="outlined" startIcon={<SyncIcon />} onClick={() => setSyncOpen(true)}>
                CRMに同期
              </Button>
              <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleExport} disabled={exporting}>
                {exporting ? 'エクスポート中...' : 'Excel エクスポート'}
              </Button>
            </>
          )}
          {activeView === 'sheets' && (
            <>
              <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleAsiaExport} disabled={sheetsProperties.length === 0}>
                Excel エクスポート
              </Button>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setOwnerImportOpen(true)}>
                顧客をインポート
              </Button>
              <Button variant="outlined" startIcon={<TaskAltIcon />} onClick={() => setRegisterOwnersOpen(true)} disabled={sheetsProperties.length === 0}>
                オーナーをCRMに登録
              </Button>
              <Button variant="contained" startIcon={<CloudDownloadIcon />} onClick={() => setSheetsImportOpen(true)}>
                ファイルからインポート
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* View tabs */}
      <Tabs value={activeView} onChange={(_, v) => setActiveView(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label={`ハワイ (${appfolioProperties.length}件)`} value="appfolio" />
        <Tab label={`アジア (${sheetsProperties.length}件)`} value="sheets" />
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : activeView === 'appfolio' ? (
        <>
          {/* Filters */}
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="物件名・オーナー名で検索"
              value={search}
              onChange={e => setSearch(e.target.value)}
              sx={{ minWidth: 240 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                endAdornment: search && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearch('')}><ClearIcon fontSize="small" /></IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>管理形態</InputLabel>
              <Select value={filterMgmt} label="管理形態" onChange={e => setFilterMgmt(e.target.value)}>
                <MenuItem value="">すべて</MenuItem>
                {MGMT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>テナント状況</InputLabel>
              <Select value={filterStatus} label="テナント状況" onChange={e => setFilterStatus(e.target.value)}>
                <MenuItem value="">すべて</MenuItem>
                <MenuItem value="Current">Current</MenuItem>
                <MenuItem value="Notice">Notice</MenuItem>
              </Select>
            </FormControl>
            <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
              {filtered.length} / {appfolioProperties.length} 件
            </Typography>
          </Box>

          <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 320px)' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, minWidth: 220 }}>物件名</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 90 }}>管理形態</TableCell>
                  <TableCell sx={{ fontWeight: 700, minWidth: 180 }}>オーナー名</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 100 }}>テナント</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 110 }}>賃貸終了日</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 100 }} align="right">月額賃料</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 70 }} align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      {appfolioProperties.length === 0 ? 'データがありません。Appfolioからインポートしてください。' : '条件に一致する物件がありません。'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(p => (
                    <TableRow key={p.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{p.propertyName}</Typography>
                        {p.notes && <Typography variant="caption" color="text.secondary">{p.notes}</Typography>}
                      </TableCell>
                      <TableCell>
                        {p.managementType && (
                          <Chip label={p.managementType} size="small" color={MGMT_COLORS[p.managementType] || 'default'} />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{p.ownerName}</Typography>
                        {p.ownerPhone && <Typography variant="caption" color="text.secondary">{p.ownerPhone}</Typography>}
                      </TableCell>
                      <TableCell>
                        {p.tenantStatus && (
                          <Chip label={p.tenantStatus} size="small"
                            color={p.tenantStatus === 'Current' ? 'success' : 'warning'} variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{p.leaseEnd || '—'}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {p.monthlyRent ? `$${Number(p.monthlyRent).toLocaleString()}` : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="編集">
                          <IconButton size="small" onClick={() => setEditTarget(p)}><EditIcon fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title="削除">
                          <IconButton size="small" color="error" onClick={() => handleDelete(p)}><DeleteIcon fontSize="small" /></IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      ) : (
        <SheetsPropertiesTab
          properties={sheetsProperties}
          onImportOpen={() => setSheetsImportOpen(true)}
          onDelete={handleDelete}
          onRowClick={(p) => setSheetsEditTarget(p)}
        />
      )}

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={load}
      />
      <SyncToCRMDialog
        open={syncOpen}
        onClose={() => setSyncOpen(false)}
      />
      <EditDialog
        property={editTarget}
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={updated => setProperties(prev => prev.map(p => p.id === updated.id ? updated : p))}
      />
      <SheetsImportDialog
        open={sheetsImportOpen}
        onClose={() => setSheetsImportOpen(false)}
        onImported={() => { load(); setSheetsImportOpen(false); }}
      />
      <OwnerImportDialog
        open={ownerImportOpen}
        onClose={() => setOwnerImportOpen(false)}
      />
      <RegisterOwnersDialog
        open={registerOwnersOpen}
        onClose={() => setRegisterOwnersOpen(false)}
        properties={sheetsProperties}
        onDone={(updated) => {
          setProperties((prev) => {
            const map = new Map(updated.map((p) => [p.id, p]));
            return prev.map((p) => map.has(p.id) ? map.get(p.id) : p);
          });
          setRegisterOwnersOpen(false);
        }}
      />
      <SheetsPropertyDetailModal
        property={sheetsEditTarget}
        open={!!sheetsEditTarget}
        onClose={() => setSheetsEditTarget(null)}
        onSaved={(updated) => {
          setProperties((prev) => prev.map((p) => p.id === updated.id ? updated : p));
          setSheetsEditTarget(updated);
        }}
      />
    </Box>
  );
}
