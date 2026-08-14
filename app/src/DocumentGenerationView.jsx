import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Box, Typography, Paper, Stack, Button, Select, MenuItem, FormControl,
  InputLabel, TextField, Divider, CircularProgress, Chip, Accordion,
  AccordionSummary, AccordionDetails, Alert, Autocomplete, IconButton,
  Tooltip, List, ListItem, ListItemText, ListItemSecondaryAction, Collapse,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DownloadIcon from '@mui/icons-material/Download';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import ArticleIcon from '@mui/icons-material/Article';
import EmailIcon from '@mui/icons-material/Email';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

const API = '/api';

const DEPOSIT_ROUNDS = [
  { value: 1, label: '第1回　第一次手付金（購入価格×5%）' },
  { value: 2, label: '第2回　第二次手付金（購入価格×5%）' },
  { value: 3, label: '第3回　第三次手付金（購入価格×10%）' },
];

const COLUMN_FIELDS = [
  { key: 'ownerNameEn',   label: '契約者氏名（ローマ字）' },
  { key: 'titleName',     label: '登記名義（Title）' },
  { key: 'escrowNo',      label: 'Escrow #' },
  { key: 'unitNo',        label: 'Unit #' },
  { key: 'purchasePrice', label: '購入価格' },
  { key: 'deposit1Date',  label: '第1回デポジット 期日' },
  { key: 'deposit2Date',  label: '第2回デポジット 期日' },
  { key: 'deposit3Date',  label: '第3回デポジット 期日' },
  { key: 'buyerEmail',    label: 'バイヤーメールアドレス（To）' },
  { key: 'agentEmail',    label: '担当者メールアドレス（From）' },
];

const BANK_FIELDS = [
  { key: 'propertyName',          label: '物件名', placeholder: 'Mahana' },
  { key: 'propertyAddress',       label: '物件住所', placeholder: '423 Ward Ave, Honolulu, HI 96814' },
  { key: 'escrowRemarkSuffix',    label: '備考サフィックス', placeholder: '-JN (MAHANA WV)' },
  { key: 'recipientName',         label: '受取人名' },
  { key: 'recipientAddress',      label: '受取人住所' },
  { key: 'recipientPhone',        label: '電話番号' },
  { key: 'bankName',              label: '受取銀行名' },
  { key: 'bankBranch',            label: '支店' },
  { key: 'bankBranchAddress',     label: '支店住所' },
  { key: 'accountType',           label: '口座種類', placeholder: 'Checking Account' },
  { key: 'accountNo',             label: '口座番号' },
  { key: 'abaNo',                 label: 'USA ABA' },
  { key: 'swiftCode',             label: 'Swift Code' },
  { key: 'bankRegisteredAddress', label: '銀行登録住所' },
  { key: 'currency',              label: '送金通貨', placeholder: 'USドル' },
];

// 予約キー（BL列ではなく固定値）
const BUILTIN_OPTIONS = [
  { letter: '__ownerNameEn',    label: '【固定】契約者氏名（ローマ字）' },
  { letter: '__titleName',      label: '【固定】登記名義' },
  { letter: '__escrowNo',       label: '【固定】Escrow #' },
  { letter: '__unitNo',         label: '【固定】Unit #' },
  { letter: '__purchasePrice',  label: '【固定】購入価格（$形式）' },
  { letter: '__depositDate',    label: '【固定】デポジット期日' },
  { letter: '__depositAmount',  label: '【固定】送金額（$形式）' },
  { letter: '__depositRound',   label: '【固定】送金回（第一次/第二次/第三次）' },
  { letter: '__buyerEmail',     label: '【固定】バイヤーメール' },
  { letter: '__agentEmail',     label: '【固定】担当者メール' },
  { letter: '__propertyName',   label: '【固定】物件名' },
  { letter: '__propertyAddress',label: '【固定】物件住所' },
  { letter: '__recipientName',  label: '【固定】受取人名' },
  { letter: '__bankName',       label: '【固定】受取銀行名' },
  { letter: '__accountNo',      label: '【固定】口座番号' },
  { letter: '__abaNo',          label: '【固定】USA ABA' },
  { letter: '__swiftCode',      label: '【固定】Swift Code' },
  { letter: '__currency',       label: '【固定】送金通貨' },
];

function emptySettings() {
  return {
    columnMapping: {},
    propertyName: '', propertyAddress: '', escrowRemarkSuffix: '',
    recipientName: '', recipientAddress: '', recipientPhone: '',
    bankName: '', bankBranch: '', bankBranchAddress: '',
    accountType: 'Checking Account', accountNo: '', abaNo: '',
    swiftCode: '', bankRegisteredAddress: '', currency: 'USドル',
  };
}

// ── PDFテンプレート個別カード ──────────────────────────────────
function PdfTemplateCard({ template, projectId, columnOptions, onDeleted, onMappingSaved, onReuploaded }) {
  const [expanded, setExpanded] = useState(false);
  const [fieldMapping, setFieldMapping] = useState(template.fieldMapping || {});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef(null);

  const allOptions = [...BUILTIN_OPTIONS, ...columnOptions];

  const handleMappingChange = (fieldName, letter) => {
    setFieldMapping(prev => ({ ...prev, [fieldName]: letter }));
  };

  const handleSaveMapping = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      await axios.post(`${API}/UpdatePdfTemplateMapping`, {
        projectId, templateId: template.id, fieldMapping,
      });
      setSaveMsg('保存しました ✓');
      onMappingSaved(template.id, fieldMapping);
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveMsg(`エラー: ${err.response?.data || err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReupload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg('');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const r = await axios.post(`${API}/UploadPdfTemplate`, {
        projectId,
        templateName: template.name,
        pdfBase64,
        templateId: template.id,
      });
      setUploadMsg(`更新完了。フィールド ${r.data.fieldNames.length} 件`);
      onReuploaded();
    } catch (err) {
      setUploadMsg(`エラー: ${err.response?.data || err.message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`テンプレート「${template.name}」を削除しますか？`)) return;
    setDeleting(true);
    try {
      await axios.post(`${API}/DeletePdfTemplate`, { projectId, templateId: template.id });
      onDeleted(template.id);
    } catch (err) {
      alert(`削除エラー: ${err.response?.data || err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 0, overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.5, gap: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
        onClick={() => setExpanded(e => !e)}
      >
        <PictureAsPdfIcon fontSize="small" color="error" />
        <Typography fontWeight={600} sx={{ flexGrow: 1 }}>{template.name}</Typography>
        <Chip label={`${template.fieldNames?.length ?? 0} フィールド`} size="small" variant="outlined" />
        <Tooltip title="PDFを差し替え">
          <IconButton size="small" component="label" onClick={e => e.stopPropagation()} disabled={uploading}>
            {uploading ? <CircularProgress size={16} /> : <UploadFileIcon fontSize="small" />}
            <input type="file" accept="application/pdf" hidden ref={fileRef} onChange={handleReupload} />
          </IconButton>
        </Tooltip>
        <Tooltip title="削除">
          <IconButton size="small" color="error" onClick={e => { e.stopPropagation(); handleDelete(); }} disabled={deleting}>
            {deleting ? <CircularProgress size={16} /> : <DeleteIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </Box>

      {uploadMsg && (
        <Alert severity={uploadMsg.startsWith('エラー') ? 'error' : 'success'} sx={{ mx: 2, mb: 1, py: 0 }}>
          {uploadMsg}
        </Alert>
      )}

      {/* Field mapping */}
      <Collapse in={expanded}>
        <Divider />
        <Box sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
            各フォームフィールドに差し込む値を選択してください。「【固定】」はBL列ではなく計算済みの値です。
          </Typography>
          {(template.fieldNames || []).length === 0 ? (
            <Alert severity="info" sx={{ py: 0 }}>フィールドが見つかりません。AcroFormフィールド付きのPDFをアップロードしてください。</Alert>
          ) : (
            <Stack spacing={1.5}>
              {(template.fieldNames || []).map(fieldName => (
                <Autocomplete
                  key={fieldName}
                  size="small"
                  options={allOptions}
                  value={allOptions.find(o => o.letter === fieldMapping[fieldName]) || null}
                  onChange={(_, v) => handleMappingChange(fieldName, v?.letter || '')}
                  getOptionLabel={o => o.label}
                  isOptionEqualToValue={(o, v) => o.letter === v.letter}
                  renderInput={params => <TextField {...params} label={`PDF: ${fieldName}`} />}
                  noOptionsText="列が見つかりません"
                />
              ))}
            </Stack>
          )}
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              size="small"
              variant="contained"
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
              onClick={handleSaveMapping}
              disabled={saving}
            >
              {saving ? '保存中...' : 'マッピングを保存'}
            </Button>
            {saveMsg && (
              <Typography variant="caption" color={saveMsg.startsWith('エラー') ? 'error' : 'success.main'}>
                {saveMsg}
              </Typography>
            )}
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
}

// ── メインコンポーネント ────────────────────────────────────────
export function DocumentGenerationView() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [tab, setTab] = useState('generate');
  const [depositRound, setDepositRound] = useState(1);
  const [generatingExcel, setGeneratingExcel] = useState(false);
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [settings, setSettings] = useState(emptySettings());
  const [pdfTemplates, setPdfTemplates] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [columns, setColumns] = useState([]);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [generateError, setGenerateError] = useState('');
  // 新規テンプレート追加フォーム
  const [addingTemplate, setAddingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateFile, setNewTemplateFile] = useState(null);
  const [uploadingNew, setUploadingNew] = useState(false);
  const [uploadNewMsg, setUploadNewMsg] = useState('');

  const refreshProjects = useCallback(async () => {
    const res = await axios.get(`${API}/GetProjects`);
    const active = (res.data || []).filter(p => p.status !== 'inactive');
    setProjects(active);
    return active;
  }, []);

  useEffect(() => {
    refreshProjects().then(active => {
      if (active.length > 0) setSelectedProjectId(active[0].id);
    }).catch(() => {});
  }, [refreshProjects]);

  useEffect(() => {
    if (!selectedProjectId) return;
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return;

    const ds = project.documentSettings;
    setSettings(ds ? { ...emptySettings(), ...ds } : emptySettings());
    const templates = Array.isArray(ds?.pdfTemplates) ? ds.pdfTemplates : [];
    setPdfTemplates(templates);
    if (templates.length > 0 && !templates.find(t => t.id === selectedTemplateId)) {
      setSelectedTemplateId(templates[0].id);
    }

    setColumnsLoading(true);
    setColumns([]);
    axios.get(`${API}/GetBuyerListColumns?projectId=${selectedProjectId}`)
      .then(r => setColumns(r.data || []))
      .catch(() => setColumns([]))
      .finally(() => setColumnsLoading(false));
  }, [selectedProjectId, projects]);

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const hasSettings = selectedProject?.documentSettings?.columnMapping?.ownerNameEn;

  const columnOptions = columns.map(c => ({
    label: `${c.letter}  -  ${c.name.length > 50 ? c.name.substring(0, 50) + '…' : c.name}`,
    letter: c.letter,
    name: c.name,
  }));

  const handleSaveSettings = async () => {
    if (!selectedProjectId) return;
    setSaving(true);
    setSaveOk(false);
    try {
      const r = await axios.post(`${API}/UpdateProject`, {
        id: selectedProjectId,
        documentSettings: settings,
      });
      setProjects(prev => prev.map(p => p.id === selectedProjectId ? r.data : p));
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } catch {
      alert('設定の保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateExcel = async () => {
    setGenerateError('');
    setGeneratingExcel(true);
    try {
      const r = await axios.post(`${API}/GenerateRemittanceExcel`,
        { projectId: selectedProjectId, depositRound }, { responseType: 'blob' });
      const propName = selectedProject?.documentSettings?.propertyName || selectedProject?.name || 'Property';
      const roundLabel = ['', '第一次', '第二次', '第三次'][depositRound];
      downloadBlob(new Blob([r.data]), `${propName}_${roundLabel}手付金送金案内.xlsx`);
    } catch (err) {
      const msg = err.response?.data
        ? (typeof err.response.data === 'string' ? err.response.data : await err.response.data.text?.())
        : err.message;
      setGenerateError(String(msg || '生成に失敗しました。'));
    } finally {
      setGeneratingExcel(false);
    }
  };

  const handleGenerateEmail = async () => {
    setGenerateError('');
    setGeneratingEmail(true);
    try {
      const r = await axios.post(`${API}/GenerateRemittanceEmail`,
        { projectId: selectedProjectId, depositRound }, { responseType: 'blob' });
      const propName = selectedProject?.documentSettings?.propertyName || selectedProject?.name || 'Property';
      const roundLabel = ['', '第一次', '第二次', '第三次'][depositRound];
      downloadBlob(new Blob([r.data], { type: 'application/zip' }), `${propName}_${roundLabel}手付金送金案内_メール.zip`);
    } catch (err) {
      const msg = err.response?.data
        ? (typeof err.response.data === 'string' ? err.response.data : await err.response.data.text?.())
        : err.message;
      setGenerateError(String(msg || 'メール生成に失敗しました。'));
    } finally {
      setGeneratingEmail(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (!selectedTemplateId) return;
    setGenerateError('');
    setGeneratingPdf(true);
    try {
      const r = await axios.post(`${API}/GenerateRemittancePdf`,
        { projectId: selectedProjectId, depositRound, templateId: selectedTemplateId },
        { responseType: 'blob' });
      const propName = selectedProject?.documentSettings?.propertyName || selectedProject?.name || 'Property';
      const roundLabel = ['', '第一次', '第二次', '第三次'][depositRound];
      const tName = pdfTemplates.find(t => t.id === selectedTemplateId)?.name || 'PDF';
      downloadBlob(new Blob([r.data], { type: 'application/zip' }), `${propName}_${roundLabel}_${tName}.zip`);
    } catch (err) {
      const msg = err.response?.data
        ? (typeof err.response.data === 'string' ? err.response.data : await err.response.data.text?.())
        : err.message;
      setGenerateError(String(msg || 'PDF生成に失敗しました。'));
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleAddTemplate = async () => {
    if (!newTemplateName.trim() || !newTemplateFile || !selectedProjectId) return;
    setUploadingNew(true);
    setUploadNewMsg('');
    try {
      const arrayBuffer = await newTemplateFile.arrayBuffer();
      const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      await axios.post(`${API}/UploadPdfTemplate`, {
        projectId: selectedProjectId,
        templateName: newTemplateName.trim(),
        pdfBase64,
      });
      setUploadNewMsg('追加しました ✓');
      setNewTemplateName('');
      setNewTemplateFile(null);
      setAddingTemplate(false);
      const active = await refreshProjects();
      const proj = active.find(p => p.id === selectedProjectId);
      if (proj) {
        const templates = proj.documentSettings?.pdfTemplates || [];
        setPdfTemplates(templates);
        if (templates.length > 0) setSelectedTemplateId(templates[templates.length - 1].id);
      }
    } catch (err) {
      setUploadNewMsg(`エラー: ${err.response?.data || err.message}`);
    } finally {
      setUploadingNew(false);
    }
  };

  const handleTemplateDeleted = async (templateId) => {
    setPdfTemplates(prev => prev.filter(t => t.id !== templateId));
    await refreshProjects();
    setSelectedTemplateId(prev => prev === templateId ? '' : prev);
  };

  const handleMappingSaved = (templateId, fieldMapping) => {
    setPdfTemplates(prev => prev.map(t => t.id === templateId ? { ...t, fieldMapping } : t));
  };

  const handleReuploaded = async () => {
    const active = await refreshProjects();
    const proj = active.find(p => p.id === selectedProjectId);
    if (proj) setPdfTemplates(proj.documentSettings?.pdfTemplates || []);
  };

  const setColMap = useCallback((key, letter) => {
    setSettings(prev => ({ ...prev, columnMapping: { ...prev.columnMapping, [key]: letter } }));
  }, []);

  const setField = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const anyGenerating = generatingExcel || generatingEmail || generatingPdf;

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
        文書生成
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        バイヤーリストの情報を差し込んで送金案内を一括生成します。
      </Typography>

      {/* Project selector */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 280 }}>
          <InputLabel>プロジェクト</InputLabel>
          <Select value={selectedProjectId} label="プロジェクト" onChange={e => setSelectedProjectId(e.target.value)}>
            {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </Select>
        </FormControl>
      </Paper>

      {/* Tabs */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button variant={tab === 'generate' ? 'contained' : 'outlined'} startIcon={<ArticleIcon />}
          onClick={() => setTab('generate')} size="small">書類生成</Button>
        <Button variant={tab === 'settings' ? 'contained' : 'outlined'} startIcon={<SettingsIcon />}
          onClick={() => setTab('settings')} size="small">プロジェクト設定</Button>
      </Box>

      {/* ── 書類生成タブ ── */}
      {tab === 'generate' && (
        <Paper sx={{ p: 3 }}>
          {!selectedProjectId && <Alert severity="info">プロジェクトを選択してください。</Alert>}

          {selectedProjectId && !hasSettings && (
            <Alert severity="warning" action={<Button size="small" onClick={() => setTab('settings')}>設定へ</Button>}>
              列マッピングが未設定です。「プロジェクト設定」から設定してください。
            </Alert>
          )}

          {selectedProjectId && hasSettings && (
            <Stack spacing={3}>
              <FormControl size="small" sx={{ maxWidth: 480 }}>
                <InputLabel>送金回数</InputLabel>
                <Select value={depositRound} label="送金回数" onChange={e => setDepositRound(e.target.value)}>
                  {DEPOSIT_ROUNDS.map(r => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
                </Select>
              </FormControl>

              {generateError && <Alert severity="error">{generateError}</Alert>}

              {/* Excel */}
              <Box>
                <Button variant="contained" size="large" disabled={anyGenerating}
                  startIcon={generatingExcel ? <CircularProgress size={18} color="inherit" /> : <DownloadIcon />}
                  onClick={handleGenerateExcel}>
                  {generatingExcel ? '生成中...' : 'Excel を生成してダウンロード'}
                </Button>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  バイヤーリスト全員分を1ファイル（オーナー別シート）で出力します
                </Typography>
              </Box>

              <Divider />

              {/* Email */}
              <Box>
                <Button variant="outlined" size="large" disabled={anyGenerating}
                  startIcon={generatingEmail ? <CircularProgress size={18} color="inherit" /> : <EmailIcon />}
                  onClick={handleGenerateEmail}>
                  {generatingEmail ? '生成中...' : 'メール（.eml）を一括生成してダウンロード'}
                </Button>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  バイヤー1人につき1つの .eml ファイルをZIPでまとめてダウンロードします。Outlookで開けます。
                </Typography>
              </Box>

              {/* PDF */}
              {pdfTemplates.length > 0 && (
                <>
                  <Divider />
                  <Stack spacing={1.5}>
                    <FormControl size="small" sx={{ maxWidth: 380 }}>
                      <InputLabel>PDFテンプレート</InputLabel>
                      <Select value={selectedTemplateId} label="PDFテンプレート"
                        onChange={e => setSelectedTemplateId(e.target.value)}>
                        {pdfTemplates.map(t => (
                          <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Box>
                      <Button variant="outlined" size="large" color="error" disabled={anyGenerating || !selectedTemplateId}
                        startIcon={generatingPdf ? <CircularProgress size={18} color="inherit" /> : <PictureAsPdfIcon />}
                        onClick={handleGeneratePdf}>
                        {generatingPdf ? '生成中...' : 'PDF を一括生成してダウンロード'}
                      </Button>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        選択したテンプレートにバイヤー情報を差し込んだPDFをZIPでダウンロードします。
                      </Typography>
                    </Box>
                  </Stack>
                </>
              )}
            </Stack>
          )}
        </Paper>
      )}

      {/* ── 設定タブ ── */}
      {tab === 'settings' && (
        <Stack spacing={2}>

          {/* Column mapping */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={600}>BL列マッピング</Typography>
              <Chip label="必須" size="small" color="error" sx={{ ml: 1.5 }} />
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                バイヤーリストの各列を選択してください。
                {columnsLoading && <CircularProgress size={14} sx={{ ml: 1 }} />}
              </Typography>
              <Stack spacing={2}>
                {COLUMN_FIELDS.map(({ key, label }) => (
                  <Autocomplete key={key} size="small"
                    options={columnOptions}
                    value={columnOptions.find(o => o.letter === settings.columnMapping[key]) || null}
                    onChange={(_, v) => setColMap(key, v?.letter || '')}
                    getOptionLabel={o => o.label}
                    isOptionEqualToValue={(o, v) => o.letter === v.letter}
                    renderInput={params => <TextField {...params} label={label} />}
                    loading={columnsLoading} noOptionsText="列が見つかりません"
                  />
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* Bank info */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={600}>物件・口座情報</Typography>
              <Chip label="必須" size="small" color="error" sx={{ ml: 1.5 }} />
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                プロジェクトごとの固定情報です。一度設定すれば全バイヤー共通で使用されます。
              </Typography>
              <Stack spacing={2}>
                {BANK_FIELDS.map(({ key, label, placeholder }) => (
                  <TextField key={key} label={label} value={settings[key] || ''}
                    onChange={e => setField(key, e.target.value)}
                    placeholder={placeholder || ''} size="small" fullWidth />
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* PDF templates */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={600}>PDFテンプレート管理</Typography>
              <Chip label={`${pdfTemplates.length} 件`} size="small" variant="outlined" sx={{ ml: 1.5 }} />
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  AcroFormフィールドを含むPDFをアップロードしてください。プロジェクトごとに複数のテンプレートを登録できます。
                </Typography>

                {/* テンプレート一覧 */}
                {pdfTemplates.map(template => (
                  <PdfTemplateCard
                    key={template.id}
                    template={template}
                    projectId={selectedProjectId}
                    columnOptions={columnOptions}
                    onDeleted={handleTemplateDeleted}
                    onMappingSaved={handleMappingSaved}
                    onReuploaded={handleReuploaded}
                  />
                ))}

                {/* 追加フォーム */}
                {addingTemplate ? (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={1.5}>
                      <Typography variant="subtitle2">新規テンプレートを追加</Typography>
                      <TextField
                        label="テンプレート名"
                        value={newTemplateName}
                        onChange={e => setNewTemplateName(e.target.value)}
                        size="small"
                        placeholder="例：送金案内書、重要事項説明書"
                        fullWidth
                      />
                      <Button component="label" variant="outlined" size="small" startIcon={<UploadFileIcon />}>
                        {newTemplateFile ? newTemplateFile.name : 'PDFを選択'}
                        <input type="file" accept="application/pdf" hidden
                          onChange={e => setNewTemplateFile(e.target.files?.[0] || null)} />
                      </Button>
                      {uploadNewMsg && (
                        <Alert severity={uploadNewMsg.startsWith('エラー') ? 'error' : 'success'} sx={{ py: 0 }}>
                          {uploadNewMsg}
                        </Alert>
                      )}
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button variant="contained" size="small" onClick={handleAddTemplate}
                          disabled={!newTemplateName.trim() || !newTemplateFile || uploadingNew}
                          startIcon={uploadingNew ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}>
                          {uploadingNew ? 'アップロード中...' : '追加'}
                        </Button>
                        <Button size="small" onClick={() => { setAddingTemplate(false); setNewTemplateName(''); setNewTemplateFile(null); setUploadNewMsg(''); }}>
                          キャンセル
                        </Button>
                      </Box>
                    </Stack>
                  </Paper>
                ) : (
                  <Button variant="outlined" startIcon={<AddIcon />} size="small"
                    onClick={() => setAddingTemplate(true)} disabled={!selectedProjectId}>
                    テンプレートを追加
                  </Button>
                )}
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* Save */}
          <Box>
            {saveOk && <Alert severity="success" sx={{ mb: 1.5 }}>設定を保存しました。</Alert>}
            <Button variant="contained"
              startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
              onClick={handleSaveSettings} disabled={saving || !selectedProjectId}>
              {saving ? '保存中...' : '設定を保存'}
            </Button>
          </Box>
        </Stack>
      )}
    </Box>
  );
}
