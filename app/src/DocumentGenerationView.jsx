import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Box, Typography, Paper, Stack, Button, Select, MenuItem, FormControl,
  InputLabel, TextField, Divider, CircularProgress, Chip, Accordion,
  AccordionSummary, AccordionDetails, Alert, Autocomplete,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DownloadIcon from '@mui/icons-material/Download';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import ArticleIcon from '@mui/icons-material/Article';
import EmailIcon from '@mui/icons-material/Email';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import UploadFileIcon from '@mui/icons-material/UploadFile';

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

function emptySettings() {
  return {
    columnMapping: {},
    pdfFieldMapping: {},
    propertyName: '',
    propertyAddress: '',
    escrowRemarkSuffix: '',
    recipientName: '',
    recipientAddress: '',
    recipientPhone: '',
    bankName: '',
    bankBranch: '',
    bankBranchAddress: '',
    accountType: 'Checking Account',
    accountNo: '',
    abaNo: '',
    swiftCode: '',
    bankRegisteredAddress: '',
    currency: 'USドル',
  };
}

export function DocumentGenerationView() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [tab, setTab] = useState('generate'); // 'generate' | 'settings'
  const [depositRound, setDepositRound] = useState(1);
  const [generatingExcel, setGeneratingExcel] = useState(false);
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadPdfMsg, setUploadPdfMsg] = useState('');
  const [settings, setSettings] = useState(emptySettings());
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [columns, setColumns] = useState([]);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [generateError, setGenerateError] = useState('');

  useEffect(() => {
    axios.get(`${API}/GetProjects`).then(r => {
      const active = (r.data || []).filter(p => p.status !== 'inactive');
      setProjects(active);
      if (active.length > 0) setSelectedProjectId(active[0].id);
    }).catch(() => {});
  }, []);

  // When project changes, load its settings and BL columns
  useEffect(() => {
    if (!selectedProjectId) return;
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return;

    const ds = project.documentSettings;
    setSettings(ds ? { ...emptySettings(), ...ds, columnMapping: { ...(ds.columnMapping || {}) } } : emptySettings());

    setColumnsLoading(true);
    setColumns([]);
    axios.get(`${API}/GetBuyerListColumns?projectId=${selectedProjectId}`)
      .then(r => setColumns(r.data || []))
      .catch(() => setColumns([]))
      .finally(() => setColumnsLoading(false));
  }, [selectedProjectId, projects]);

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const hasSettings = selectedProject?.documentSettings?.columnMapping?.ownerNameEn;

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
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateExcel = async () => {
    setGenerateError('');
    setGeneratingExcel(true);
    try {
      const r = await axios.post(
        `${API}/GenerateRemittanceExcel`,
        { projectId: selectedProjectId, depositRound },
        { responseType: 'blob' },
      );
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
      const r = await axios.post(
        `${API}/GenerateRemittanceEmail`,
        { projectId: selectedProjectId, depositRound },
        { responseType: 'blob' },
      );
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

  const setColMap = useCallback((key, letter) => {
    setSettings(prev => ({
      ...prev,
      columnMapping: { ...prev.columnMapping, [key]: letter },
    }));
  }, []);

  const setPdfFieldMap = useCallback((fieldName, letter) => {
    setSettings(prev => ({
      ...prev,
      pdfFieldMapping: { ...prev.pdfFieldMapping, [fieldName]: letter },
    }));
  }, []);

  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProjectId) return;
    setUploadingPdf(true);
    setUploadPdfMsg('');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const r = await axios.post(`${API}/UploadPdfTemplate`, { projectId: selectedProjectId, pdfBase64 });
      const { fieldNames } = r.data;
      setUploadPdfMsg(`アップロード完了。フォームフィールド ${fieldNames.length} 件を検出しました。`);
      // プロジェクト一覧を更新してフィールド名を反映
      const res = await axios.get(`${API}/GetProjects`);
      const active = (res.data || []).filter(p => p.status !== 'inactive');
      setProjects(active);
    } catch (err) {
      setUploadPdfMsg(`エラー: ${err.response?.data || err.message}`);
    } finally {
      setUploadingPdf(false);
      e.target.value = '';
    }
  };

  const handleGeneratePdf = async () => {
    setGenerateError('');
    setGeneratingPdf(true);
    try {
      const r = await axios.post(
        `${API}/GenerateRemittancePdf`,
        { projectId: selectedProjectId, depositRound },
        { responseType: 'blob' },
      );
      const propName = selectedProject?.documentSettings?.propertyName || selectedProject?.name || 'Property';
      const roundLabel = ['', '第一次', '第二次', '第三次'][depositRound];
      downloadBlob(new Blob([r.data], { type: 'application/zip' }), `${propName}_${roundLabel}手付金送金案内_PDF.zip`);
    } catch (err) {
      const msg = err.response?.data
        ? (typeof err.response.data === 'string' ? err.response.data : await err.response.data.text?.())
        : err.message;
      setGenerateError(String(msg || 'PDF生成に失敗しました。'));
    } finally {
      setGeneratingPdf(false);
    }
  };

  const setField = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const columnOptions = columns.map(c => ({
    label: `${c.letter}  -  ${c.name.length > 50 ? c.name.substring(0, 50) + '…' : c.name}`,
    letter: c.letter,
    name: c.name,
  }));

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
        文書生成
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        バイヤーリストの情報を差し込んで送金案内Excelを一括生成します。
      </Typography>

      {/* Project selector */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 280 }}>
          <InputLabel>プロジェクト</InputLabel>
          <Select
            value={selectedProjectId}
            label="プロジェクト"
            onChange={e => setSelectedProjectId(e.target.value)}
          >
            {projects.map(p => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {/* Tabs */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button
          variant={tab === 'generate' ? 'contained' : 'outlined'}
          startIcon={<ArticleIcon />}
          onClick={() => setTab('generate')}
          size="small"
        >
          書類生成
        </Button>
        <Button
          variant={tab === 'settings' ? 'contained' : 'outlined'}
          startIcon={<SettingsIcon />}
          onClick={() => setTab('settings')}
          size="small"
        >
          プロジェクト設定
        </Button>
      </Box>

      {/* ── 書類生成タブ ── */}
      {tab === 'generate' && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            送金案内 Excel 生成
          </Typography>

          {!selectedProjectId && (
            <Alert severity="info">プロジェクトを選択してください。</Alert>
          )}

          {selectedProjectId && !hasSettings && (
            <Alert severity="warning" action={
              <Button size="small" onClick={() => setTab('settings')}>設定へ</Button>
            }>
              列マッピングが未設定です。「プロジェクト設定」から設定してください。
            </Alert>
          )}

          {selectedProjectId && hasSettings && (
            <Stack spacing={3}>
              <FormControl size="small" sx={{ maxWidth: 480 }}>
                <InputLabel>送金回数</InputLabel>
                <Select
                  value={depositRound}
                  label="送金回数"
                  onChange={e => setDepositRound(e.target.value)}
                >
                  {DEPOSIT_ROUNDS.map(r => (
                    <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {generateError && (
                <Alert severity="error">{generateError}</Alert>
              )}

              <Stack spacing={2}>
                <Box>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={generatingExcel ? <CircularProgress size={18} color="inherit" /> : <DownloadIcon />}
                    onClick={handleGenerateExcel}
                    disabled={generatingExcel || generatingEmail}
                  >
                    {generatingExcel ? '生成中...' : 'Excel を生成してダウンロード'}
                  </Button>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    バイヤーリスト全員分を1ファイル（オーナー別シート）で出力します
                  </Typography>
                </Box>

                <Divider />

                <Box>
                  <Button
                    variant="outlined"
                    size="large"
                    startIcon={generatingEmail ? <CircularProgress size={18} color="inherit" /> : <EmailIcon />}
                    onClick={handleGenerateEmail}
                    disabled={generatingExcel || generatingEmail || generatingPdf}
                  >
                    {generatingEmail ? '生成中...' : 'メール（.eml）を一括生成してダウンロード'}
                  </Button>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    バイヤー1人につき1つの .eml ファイルをZIPでまとめてダウンロードします。Outlookで開けます。
                  </Typography>
                </Box>

                {selectedProject?.documentSettings?.pdfTemplateBlobName && (
                  <>
                    <Divider />
                    <Box>
                      <Button
                        variant="outlined"
                        size="large"
                        color="error"
                        startIcon={generatingPdf ? <CircularProgress size={18} color="inherit" /> : <PictureAsPdfIcon />}
                        onClick={handleGeneratePdf}
                        disabled={generatingExcel || generatingEmail || generatingPdf}
                      >
                        {generatingPdf ? '生成中...' : 'PDF を一括生成してダウンロード'}
                      </Button>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        アップロード済みテンプレートにバイヤー情報を差し込んだPDFをZIPでダウンロードします。
                      </Typography>
                    </Box>
                  </>
                )}
              </Stack>
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
                  <FormControl key={key} size="small">
                    <Autocomplete
                      size="small"
                      options={columnOptions}
                      value={columnOptions.find(o => o.letter === settings.columnMapping[key]) || null}
                      onChange={(_, v) => setColMap(key, v?.letter || '')}
                      getOptionLabel={o => o.label}
                      isOptionEqualToValue={(o, v) => o.letter === v.letter}
                      renderInput={params => <TextField {...params} label={label} />}
                      loading={columnsLoading}
                      noOptionsText="列が見つかりません"
                    />
                  </FormControl>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* Property & Bank info */}
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
                  <TextField
                    key={key}
                    label={label}
                    value={settings[key] || ''}
                    onChange={e => setField(key, e.target.value)}
                    placeholder={placeholder || ''}
                    size="small"
                    fullWidth
                  />
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* PDF template */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={600}>PDFテンプレート</Typography>
              <Chip
                label={selectedProject?.documentSettings?.pdfTemplateBlobName ? 'アップロード済み' : '未設定'}
                size="small"
                color={selectedProject?.documentSettings?.pdfTemplateBlobName ? 'success' : 'default'}
                sx={{ ml: 1.5 }}
              />
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  AcroFormフィールドを含むPDFをアップロードしてください。フィールド名とBL列を対応づけることで差し込み印刷が可能になります。
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Button
                    component="label"
                    variant="outlined"
                    startIcon={uploadingPdf ? <CircularProgress size={16} /> : <UploadFileIcon />}
                    disabled={uploadingPdf || !selectedProjectId}
                    size="small"
                  >
                    {uploadingPdf ? 'アップロード中...' : 'PDFを選択してアップロード'}
                    <input type="file" accept="application/pdf" hidden onChange={handlePdfUpload} />
                  </Button>
                  {selectedProject?.documentSettings?.pdfTemplateBlobName && (
                    <Chip label="テンプレート設定済み" color="success" size="small" />
                  )}
                </Box>

                {uploadPdfMsg && (
                  <Alert severity={uploadPdfMsg.startsWith('エラー') ? 'error' : 'success'} sx={{ py: 0.5 }}>
                    {uploadPdfMsg}
                  </Alert>
                )}

                {/* フィールドマッピング */}
                {(selectedProject?.documentSettings?.pdfFieldNames || []).length > 0 && (
                  <>
                    <Typography variant="body2" fontWeight={600} sx={{ mt: 1 }}>
                      フィールドとBL列の対応
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      PDFの各フォームフィールドに差し込むBL列を選択してください。
                    </Typography>
                    <Stack spacing={1.5}>
                      {(selectedProject.documentSettings.pdfFieldNames).map(fieldName => (
                        <Autocomplete
                          key={fieldName}
                          size="small"
                          options={columnOptions}
                          value={columnOptions.find(o => o.letter === (settings.pdfFieldMapping || {})[fieldName]) || null}
                          onChange={(_, v) => setPdfFieldMap(fieldName, v?.letter || '')}
                          getOptionLabel={o => o.label}
                          isOptionEqualToValue={(o, v) => o.letter === v.letter}
                          renderInput={params => <TextField {...params} label={`PDF: ${fieldName}`} />}
                          loading={columnsLoading}
                          noOptionsText="列が見つかりません"
                        />
                      ))}
                    </Stack>
                  </>
                )}
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* Save button */}
          <Box>
            {saveOk && (
              <Alert severity="success" sx={{ mb: 1.5 }}>設定を保存しました。</Alert>
            )}
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
              onClick={handleSaveSettings}
              disabled={saving || !selectedProjectId}
            >
              {saving ? '保存中...' : '設定を保存'}
            </Button>
          </Box>
        </Stack>
      )}
    </Box>
  );
}
