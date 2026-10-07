import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
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
  IconButton,
  Tooltip,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import {
  ExpandMore as ExpandMoreIcon,
  Settings as SettingsIcon,
  OpenInNew as OpenInNewIcon,
  CloudUpload as CloudUploadIcon,
  CloudDownload as CloudDownloadIcon,
  Refresh as RefreshIcon,
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
  const [config, setConfig] = useState({
    spreadsheetId: '',
    sheetTab: '',
    headerRow: reportMeta.defaultHeaderRow,
  });
  const [tabs, setTabs] = useState([]);
  const [loadingTabs, setLoadingTabs] = useState(false);
  const [tabsError, setTabsError] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await axios.get(`${API}/GetReportConfig?reportType=${reportMeta.key}`);
        if (res.data?.spreadsheetId) {
          setConfig({
            spreadsheetId: res.data.spreadsheetId || '',
            sheetTab: res.data.sheetTab || '',
            headerRow: res.data.headerRow || reportMeta.defaultHeaderRow,
          });
        }
      } catch (e) {
        console.error('Failed to load report config', e);
      } finally {
        setConfigLoaded(true);
      }
    };
    loadConfig();
  }, [reportMeta.key, reportMeta.defaultHeaderRow]);

  const loadTabs = async (spreadsheetId) => {
    if (!spreadsheetId) { setTabs([]); return; }
    setLoadingTabs(true);
    setTabsError('');
    try {
      const res = await axios.get(`${API}/GetSheetTabs?spreadsheetId=${encodeURIComponent(spreadsheetId)}`);
      setTabs(res.data.tabs || []);
    } catch (e) {
      const msg = e.response?.data || e.message || 'タブの取得に失敗しました';
      setTabsError(typeof msg === 'string' ? msg : 'タブの取得に失敗しました。スプレッドシートIDを確認してください。');
      setTabs([]);
    } finally {
      setLoadingTabs(false);
    }
  };

  useEffect(() => {
    if (config.spreadsheetId) loadTabs(config.spreadsheetId);
    else setTabs([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.spreadsheetId]);

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await axios.post(`${API}/SaveReportConfig`, {
        reportType: reportMeta.key,
        spreadsheetId: config.spreadsheetId,
        sheetTab: config.sheetTab,
        headerRow: config.headerRow,
      });
      showSnackbar('設定を保存しました');
      setSettingsOpen(false);
    } catch (e) {
      showSnackbar('設定の保存に失敗しました', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSync = async (direction) => {
    setSyncing(true);
    setSyncResult(null);
    try {
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

  const sheetsUrl = config.spreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}`
    : null;

  return (
    <Box sx={{ p: 2 }}>
      {/* Settings Accordion */}
      <Accordion expanded={settingsOpen} onChange={(_, v) => setSettingsOpen(v)} sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SettingsIcon fontSize="small" color="action" />
            <Typography variant="subtitle2">Googleスプレッドシート設定</Typography>
            {config.spreadsheetId && (
              <Chip label="設定済み" size="small" color="success" variant="outlined" />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            {reportMeta.description}
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Spreadsheet ID"
              value={config.spreadsheetId}
              onChange={(e) => setConfig((p) => ({ ...p, spreadsheetId: e.target.value.trim() }))}
              placeholder="GoogleスプレッドシートのURL中の /d/{ID}/ 部分"
              fullWidth
              size="small"
              helperText="例: https://docs.google.com/spreadsheets/d/【ここ】/edit"
            />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, minWidth: 240 }}>
                <Autocomplete
                  freeSolo
                  options={tabs}
                  value={config.sheetTab}
                  onInputChange={(_, val) => setConfig((p) => ({ ...p, sheetTab: val }))}
                  onChange={(_, val) => setConfig((p) => ({ ...p, sheetTab: val || '' }))}
                  disabled={!config.spreadsheetId}
                  size="small"
                  sx={{ flex: 1 }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="シートタブ（期間）"
                      placeholder="例: 9.26.26 - 10.09.26"
                      helperText={
                        tabsError
                          ? tabsError
                          : tabs.length > 0
                            ? `${tabs.length}件取得済み`
                            : config.spreadsheetId
                              ? '手動で入力することもできます'
                              : ''
                      }
                      error={!!tabsError}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {loadingTabs && <CircularProgress size={14} sx={{ mr: 1 }} />}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
                <Tooltip title="タブ一覧を再取得">
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => loadTabs(config.spreadsheetId)}
                      disabled={!config.spreadsheetId || loadingTabs}
                      sx={{ mt: 0.5 }}
                    >
                      <RefreshIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
              <TextField
                label="ヘッダー行"
                type="number"
                value={config.headerRow}
                onChange={(e) => setConfig((p) => ({ ...p, headerRow: Number(e.target.value) || 1 }))}
                size="small"
                sx={{ width: 120 }}
                inputProps={{ min: 1 }}
                helperText={`デフォルト: ${reportMeta.defaultHeaderRow}行目`}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                onClick={handleSaveConfig}
                disabled={savingConfig || !config.spreadsheetId}
                size="small"
              >
                {savingConfig ? '保存中...' : '設定を保存'}
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

      {config.spreadsheetId && config.sheetTab ? (
        <>
          {/* Sync Toolbar */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Box>
              <Button
                variant="outlined"
                startIcon={syncing ? <CircularProgress size={16} /> : <CloudUploadIcon />}
                onClick={() => handleSync('toSheet')}
                disabled={syncing}
                size="small"
                sx={{ mr: 1 }}
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
            spreadsheetId={config.spreadsheetId}
            sheetTab={config.sheetTab}
            headerRow={config.headerRow}
          />
        </>
      ) : (
        <Alert severity="info">
          上の設定でSpreadsheet IDとシートタブを設定してください。
          {!config.spreadsheetId && ' Spreadsheet IDを入力してシートを接続してください。'}
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
