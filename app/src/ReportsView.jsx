import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Button,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Snackbar,
  Stack,
  Chip,
  Tabs,
  Tab,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Settings as SettingsIcon,
  OpenInNew as OpenInNewIcon,
  CloudUpload as CloudUploadIcon,
  CloudDownload as CloudDownloadIcon,
} from '@mui/icons-material';
import axios from 'axios';
import GoogleSheetEditor from './GoogleSheetEditor';

const API = '/api';

const REPORT_TYPES = [
  {
    key: 'vacancy',
    label: '空室管理レポート',
    defaultHeaderRow: 4,
    description: 'Weekly Vacancy Report: Property, Unit, Showing, Inquiry, Application, Status, MO Date, On Market Date, MI Date, MLS, Approved Rent, Description/Proposal, Owner\'s Name',
    syncToDesc: '空室物件（Status ≠ Current）のデータをシートに反映します',
    syncFromDesc: 'シートのStatus・MO Date・Approved Rentなどをアプリに取り込みます',
  },
  {
    key: 'leaseRenewal',
    label: 'Lease Renewal Report',
    defaultHeaderRow: 2,
    description: 'Lease Renewal: Property, Tenant, Lease Expires, Current Rent, New Rent, Owner\'s decision, Tenant\'s Decision, Signed agreement, New Lease Term, Memo',
    syncToDesc: '12ヶ月以内に契約満了の物件データをシートに反映します',
    syncFromDesc: 'シートのNew Rent・Owner\'s decision・Tenant\'s Decisionなどをアプリに取り込みます',
  },
];

function ReportTab({ reportMeta }) {
  // 保存済み設定（SpreadsheetId + HeaderRow のみ保存対象）
  const [savedConfig, setSavedConfig] = useState({ spreadsheetId: '', headerRow: reportMeta.defaultHeaderRow });
  // 設定フォームの一時的な入力値
  const [formConfig, setFormConfig] = useState({ spreadsheetId: '', headerRow: reportMeta.defaultHeaderRow });

  // タブ一覧（設定保存後に取得）
  const [tabs, setTabs] = useState([]);
  const [loadingTabs, setLoadingTabs] = useState(false);
  const [tabsError, setTabsError] = useState('');

  // 現在表示中のタブ（ドロップダウン選択）
  const [selectedTab, setSelectedTab] = useState('');

  const [savingConfig, setSavingConfig] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);

  // 初回マウント時に保存済み設定を読み込み、タブも取得
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await axios.get(`${API}/GetReportConfig?reportType=${reportMeta.key}`);
        if (res.data?.spreadsheetId) {
          const cfg = {
            spreadsheetId: res.data.spreadsheetId || '',
            headerRow: res.data.headerRow || reportMeta.defaultHeaderRow,
          };
          setSavedConfig(cfg);
          setFormConfig(cfg);
          // 前回選択タブがあれば復元
          if (res.data.sheetTab) setSelectedTab(res.data.sheetTab);
          // タブ一覧を自動取得
          fetchTabs(res.data.spreadsheetId);
        }
      } catch (e) {
        console.error('Failed to load report config', e);
      } finally {
        setConfigLoaded(true);
      }
    };
    loadConfig();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportMeta.key]);

  const fetchTabs = async (spreadsheetId) => {
    if (!spreadsheetId) return;
    setLoadingTabs(true);
    setTabsError('');
    try {
      const res = await axios.get(`${API}/GetSheetTabs?spreadsheetId=${encodeURIComponent(spreadsheetId)}`);
      const fetchedTabs = res.data.tabs || [];
      setTabs(fetchedTabs);
      return fetchedTabs;
    } catch (e) {
      const statusCode = e.response?.status;
      const msg = e.response?.data || e.message || 'タブの取得に失敗しました';
      const msgStr = typeof msg === 'string' ? msg : JSON.stringify(msg);
      if (statusCode === 401) {
        setTabsError('スプレッドシートがサービスアカウント (lsircs-sheets-sa@lsircs-app.iam.gserviceaccount.com) に共有されていません。Google Sheetsの「共有」でこのメールアドレスを追加してください。');
      } else if (statusCode === 403) {
        setTabsError('アクセス拒否: スプレッドシートをサービスアカウント (lsircs-sheets-sa@lsircs-app.iam.gserviceaccount.com) に共有してください。');
      } else if (statusCode === 404) {
        setTabsError('スプレッドシートが見つかりません。Spreadsheet IDを確認してください。');
      } else {
        setTabsError(msgStr || 'タブの取得に失敗しました。スプレッドシートIDを確認してください。');
      }
      setTabs([]);
      return [];
    } finally {
      setLoadingTabs(false);
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // 保存ボタン → SpreadsheetId + HeaderRow を保存 → タブ一覧を取得
  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await axios.post(`${API}/SaveReportConfig`, {
        reportType: reportMeta.key,
        spreadsheetId: formConfig.spreadsheetId,
        headerRow: formConfig.headerRow,
        // sheetTabは保存しない（選択のみ）
      });
      setSavedConfig({ spreadsheetId: formConfig.spreadsheetId, headerRow: formConfig.headerRow });
      setSelectedTab('');
      setSyncResult(null);
      showSnackbar('設定を保存しました。シートタブを選択してください。');
      setSettingsOpen(false);

      const fetchedTabs = await fetchTabs(formConfig.spreadsheetId);
      // タブが1件しかなければ自動選択
      if (fetchedTabs && fetchedTabs.length === 1) setSelectedTab(fetchedTabs[0]);
    } catch (e) {
      showSnackbar('設定の保存に失敗しました', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSync = async (direction) => {
    if (!selectedTab) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      // 同期時は選択中タブを一時的にサーバーへ渡すため、先にタブをコンフィグに保存
      await axios.post(`${API}/SaveReportConfig`, {
        reportType: reportMeta.key,
        spreadsheetId: savedConfig.spreadsheetId,
        sheetTab: selectedTab,
        headerRow: savedConfig.headerRow,
      });
      const endpoint = direction === 'toSheet' ? 'SyncReportToSheet' : 'SyncReportFromSheet';
      const res = await axios.post(`${API}/${endpoint}`, { reportType: reportMeta.key });
      setSyncResult({ success: true, message: res.data.message });
      showSnackbar(res.data.message);
    } catch (e) {
      const msg = e.response?.data || e.message || '同期に失敗しました';
      setSyncResult({ success: false, message: msg });
      showSnackbar(msg, 'error');
    } finally {
      setSyncing(false);
    }
  };

  if (!configLoaded) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  const sheetsUrl = savedConfig.spreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${savedConfig.spreadsheetId}`
    : null;

  return (
    <Box sx={{ p: 2 }}>
      {/* Settings Accordion */}
      <Accordion expanded={settingsOpen} onChange={(_, v) => setSettingsOpen(v)} sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SettingsIcon fontSize="small" color="action" />
            <Typography variant="subtitle2">Googleスプレッドシート設定</Typography>
            {savedConfig.spreadsheetId
              ? <Chip label="設定済み" size="small" color="success" variant="outlined" />
              : <Chip label="未設定" size="small" color="warning" variant="outlined" />
            }
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            {reportMeta.description}
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Spreadsheet ID"
              value={formConfig.spreadsheetId}
              onChange={(e) => setFormConfig((p) => ({ ...p, spreadsheetId: e.target.value.trim() }))}
              placeholder="GoogleスプレッドシートのURL中の /d/{ID}/ 部分"
              fullWidth
              size="small"
              helperText="例: https://docs.google.com/spreadsheets/d/【ここ】/edit"
            />
            <TextField
              label="ヘッダー行"
              type="number"
              value={formConfig.headerRow}
              onChange={(e) => setFormConfig((p) => ({ ...p, headerRow: Number(e.target.value) || 1 }))}
              size="small"
              sx={{ width: 160 }}
              inputProps={{ min: 1 }}
              helperText={`ヘッダーが何行目にあるか（デフォルト: ${reportMeta.defaultHeaderRow}行目）`}
            />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button
                variant="contained"
                onClick={handleSaveConfig}
                disabled={savingConfig || !formConfig.spreadsheetId}
                size="small"
              >
                {savingConfig ? '保存中...' : '保存してタブを取得'}
              </Button>
              {sheetsUrl && (
                <Button
                  variant="outlined"
                  startIcon={<OpenInNewIcon />}
                  component="a"
                  href={sheetsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="small"
                >
                  スプレッドシートを開く
                </Button>
              )}
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* タブ選択エリア（設定済みの場合のみ表示） */}
      {savedConfig.spreadsheetId && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 260 }}>
            <InputLabel>シートタブ（期間を選択）</InputLabel>
            <Select
              value={selectedTab}
              onChange={(e) => { setSelectedTab(e.target.value); setSyncResult(null); }}
              label="シートタブ（期間を選択）"
              disabled={loadingTabs || tabs.length === 0}
            >
              {tabs.map((t) => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {loadingTabs && <CircularProgress size={20} />}
          {tabsError && (
            <Alert severity="error" sx={{ py: 0, flex: 1 }}>{tabsError}</Alert>
          )}
          {!loadingTabs && tabs.length === 0 && !tabsError && (
            <Typography variant="caption" color="text.secondary">
              上の設定で「保存してタブを取得」を押してください
            </Typography>
          )}
        </Box>
      )}

      {savedConfig.spreadsheetId && selectedTab ? (
        <>
          {/* Sync Toolbar */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Box>
              <Button
                variant="outlined"
                startIcon={syncing ? <CircularProgress size={16} /> : <CloudUploadIcon />}
                onClick={() => handleSync('toSheet')}
                disabled={syncing}
                size="small"
              >
                App → Sheet 同期
              </Button>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                {reportMeta.syncToDesc}
              </Typography>
            </Box>
            <Box>
              <Button
                variant="outlined"
                startIcon={syncing ? <CircularProgress size={16} /> : <CloudDownloadIcon />}
                onClick={() => handleSync('fromSheet')}
                disabled={syncing}
                size="small"
              >
                Sheet → App 同期
              </Button>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                {reportMeta.syncFromDesc}
              </Typography>
            </Box>
            {sheetsUrl && (
              <Button
                variant="text"
                startIcon={<OpenInNewIcon />}
                component="a"
                href={`${sheetsUrl}/edit#gid=0`}
                target="_blank"
                rel="noopener noreferrer"
                size="small"
                sx={{ alignSelf: 'flex-start' }}
              >
                Googleスプレッドシートで開く
              </Button>
            )}
          </Box>

          {syncResult && (
            <Alert
              severity={syncResult.success ? 'success' : 'error'}
              onClose={() => setSyncResult(null)}
              sx={{ mb: 2 }}
            >
              {syncResult.message}
            </Alert>
          )}

          {/* Sheet Editor */}
          <GoogleSheetEditor
            spreadsheetId={savedConfig.spreadsheetId}
            sheetTab={selectedTab}
            headerRow={savedConfig.headerRow}
          />
        </>
      ) : savedConfig.spreadsheetId ? (
        <Alert severity="info">
          上のドロップダウンからシートタブ（期間）を選択してください。
        </Alert>
      ) : (
        <Alert severity="info">
          設定セクションを開き、Spreadsheet IDを入力して「保存してタブを取得」を押してください。
        </Alert>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default function ReportsView() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ px: 2, pt: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>レポート管理</Typography>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          {REPORT_TYPES.map((rt) => (
            <Tab key={rt.key} label={rt.label} />
          ))}
        </Tabs>
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {REPORT_TYPES.map((rt, i) => (
          tab === i && <ReportTab key={rt.key} reportMeta={rt} />
        ))}
      </Box>
    </Box>
  );
}
