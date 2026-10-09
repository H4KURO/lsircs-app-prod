import { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, TextField, Button, Alert, Accordion, AccordionSummary,
  AccordionDetails, CircularProgress, Chip, Tabs, Tab, Table, TableHead,
  TableRow, TableCell, TableBody, InputAdornment, Drawer, IconButton,
  Divider, Dialog, DialogTitle, DialogContent, DialogActions,
  MenuItem, Select, FormControl, InputLabel, Snackbar,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon, Settings as SettingsIcon,
  OpenInNew as OpenInNewIcon, Search as SearchIcon,
  Close as CloseIcon, Assignment as AssignmentIcon,
  Info as InfoIcon, Refresh as RefreshIcon,
} from '@mui/icons-material';
import axios from 'axios';

const API = '/api';

// Try to identify column index by common name patterns
function findCol(headers, patterns) {
  if (!headers) return -1;
  for (const h of headers) {
    for (const p of patterns) {
      if (typeof h === 'string' && h.toLowerCase().includes(p.toLowerCase())) {
        return headers.indexOf(h);
      }
    }
  }
  return -1;
}

function detectColumns(headers) {
  return {
    id:       findCol(headers, ['ID', 'No', '番号']),
    nameJp:   findCol(headers, ['氏名', '名前', 'Name', '購入者']),
    nameEn:   findCol(headers, ['English', 'EN', '英語', 'nameEn']),
    sales:    findCol(headers, ['Sales', '担当', 'Salesperson', 'Agent']),
    contact:  findCol(headers, ['Contact', '連絡先']),
    tower:    findCol(headers, ['Tower', '棟']),
    unit:     findCol(headers, ['Unit', 'ユニット', '部屋']),
    price:    findCol(headers, ['Price', '金額', '価格', '購入金額']),
    monthly:  findCol(headers, ['Monthly', '月次', '支払日']),
    finalDue: findCol(headers, ['残代金', 'Final', 'Balance']),
    status:   findCol(headers, ['Status', 'ステータス']),
  };
}

function cellVal(row, headers, colIdx) {
  if (colIdx < 0 || colIdx >= headers.length) return '';
  const key = headers[colIdx];
  return row[key] ?? '';
}

function statusColor(status) {
  if (!status) return 'default';
  const s = String(status).toLowerCase();
  if (s === 'done' || s === '完了' || s === '済') return 'success';
  if (s === 'overdue' || s === '超過' || s === '期限超過') return 'error';
  return 'warning';
}

function formatPrice(val) {
  const n = Number(String(val).replace(/[^0-9.]/g, ''));
  if (isNaN(n) || n === 0) return val || '—';
  return '¥' + n.toLocaleString('ja-JP');
}

export default function ContractManagementView() {
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [savedSpreadsheetId, setSavedSpreadsheetId] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const [tabs, setTabs] = useState([]);
  const [loadingTabs, setLoadingTabs] = useState(false);
  const [tabsError, setTabsError] = useState('');

  const [activeTab, setActiveTab] = useState(0);
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [rowsError, setRowsError] = useState('');

  const [search, setSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskDesc, setTaskDesc] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Load config on mount
  useEffect(() => {
    axios.get(`${API}/GetContractConfig`).then((res) => {
      if (res.data?.spreadsheetId) {
        setSavedSpreadsheetId(res.data.spreadsheetId);
        setSpreadsheetId(res.data.spreadsheetId);
        fetchTabs(res.data.spreadsheetId);
      }
    }).catch(() => {}).finally(() => setConfigLoaded(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTabs = async (sid) => {
    if (!sid) return;
    setLoadingTabs(true);
    setTabsError('');
    try {
      const res = await axios.get(`${API}/GetSheetTabs?spreadsheetId=${encodeURIComponent(sid)}`);
      const fetched = res.data.tabs || [];
      setTabs(fetched);
      if (fetched.length > 0) setActiveTab(0);
    } catch (e) {
      const status = e.response?.status;
      const msg = e.response?.data || e.message || 'タブの取得に失敗しました';
      if (status === 401 || status === 403) {
        setTabsError('アクセス拒否: スプレッドシートをサービスアカウントに共有してください。');
      } else if (status === 404) {
        setTabsError('スプレッドシートが見つかりません。IDを確認してください。');
      } else {
        setTabsError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
      setTabs([]);
    } finally {
      setLoadingTabs(false);
    }
  };

  const currentTab = tabs[activeTab];

  // Load rows when tab changes
  useEffect(() => {
    if (!savedSpreadsheetId || !currentTab) return;
    setLoadingRows(true);
    setRowsError('');
    setRows([]);
    setHeaders([]);
    setSelectedRow(null);
    setPanelOpen(false);
    axios.get(`${API}/GetSheetData?spreadsheetId=${encodeURIComponent(savedSpreadsheetId)}&sheetTab=${encodeURIComponent(currentTab)}&headerRow=1`)
      .then((res) => {
        setHeaders(res.data.headers || []);
        setRows(res.data.rows || []);
      })
      .catch((e) => {
        const msg = e.response?.data || e.message || 'データの取得に失敗しました';
        setRowsError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      })
      .finally(() => setLoadingRows(false));
  }, [savedSpreadsheetId, currentTab]);

  const cols = useMemo(() => detectColumns(headers), [headers]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      headers.some((h) => String(r[h] ?? '').toLowerCase().includes(q))
    );
  }, [rows, headers, search]);

  // Stats
  const stats = useMemo(() => {
    const total = rows.length;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let dueThisMonth = 0;
    let overdue = 0;
    let completed = 0;

    rows.forEach((r) => {
      const statusVal = cols.status >= 0 ? String(r[headers[cols.status]] ?? '').toLowerCase() : '';
      if (statusVal === 'done' || statusVal === '完了' || statusVal === '済') completed++;
      if (statusVal === 'overdue' || statusVal === '超過') overdue++;

      const finalDue = cols.finalDue >= 0 ? String(r[headers[cols.finalDue]] ?? '') : '';
      if (finalDue.startsWith(currentMonth)) dueThisMonth++;
    });

    return { total, dueThisMonth, overdue, completed };
  }, [rows, headers, cols]);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await axios.post(`${API}/SaveContractConfig`, { spreadsheetId });
      setSavedSpreadsheetId(spreadsheetId);
      setSettingsOpen(false);
      setActiveTab(0);
      await fetchTabs(spreadsheetId);
    } catch {
      setSnackbar({ open: true, message: '設定の保存に失敗しました', severity: 'error' });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRowClick = (row) => {
    setSelectedRow(row);
    setPanelOpen(true);

    // Pre-fill task dialog
    const name = cols.nameJp >= 0 ? row[headers[cols.nameJp]] : (cols.nameEn >= 0 ? row[headers[cols.nameEn]] : '');
    const unit = cols.unit >= 0 ? row[headers[cols.unit]] : '';
    const tab = currentTab || '';
    setTaskTitle(`[契約管理] 中間金支払い – ${name} (${tab} ${unit})`);
    const due = cols.finalDue >= 0 ? row[headers[cols.finalDue]] : '';
    setTaskDueDate(due && due.length >= 7 ? due.substring(0, 7) + '-01' : '');
    setTaskDesc(
      `プロジェクト: ${tab}\n購入者: ${name}\nUnit: ${unit}\n` +
      (cols.price >= 0 ? `購入金額: ${formatPrice(row[headers[cols.price]])}\n` : '') +
      (cols.monthly >= 0 ? `月次支払日: ${row[headers[cols.monthly]]}\n` : '') +
      (cols.finalDue >= 0 ? `残代金期日: ${row[headers[cols.finalDue]]}\n` : '')
    );
  };

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) return;
    setCreatingTask(true);
    try {
      await axios.post(`${API}/CreateTask`, {
        title: taskTitle,
        description: taskDesc,
        dueDate: taskDueDate || undefined,
        priority: taskPriority,
      });
      setTaskDialogOpen(false);
      setSnackbar({ open: true, message: 'タスクを登録しました', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'タスクの登録に失敗しました', severity: 'error' });
    } finally {
      setCreatingTask(false);
    }
  };

  const sheetsUrl = savedSpreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${savedSpreadsheetId}`
    : null;

  if (!configLoaded) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ px: 2, pt: 2, pb: 0, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="h6" fontWeight={700}>契約管理</Typography>
          <Chip
            label="Phase 1 – Google Sheets 連携中"
            size="small"
            color="warning"
            variant="outlined"
            icon={<InfoIcon sx={{ fontSize: '14px !important' }} />}
          />
        </Box>

        {/* Project tabs */}
        {tabs.length > 0 && (
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ mt: 1 }}
          >
            {tabs.map((t) => (
              <Tab key={t} label={t} sx={{ minWidth: 80, fontSize: 13 }} />
            ))}
          </Tabs>
        )}
      </Box>

      {/* Main content area */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Settings accordion */}
        <Accordion expanded={settingsOpen} onChange={(_, v) => setSettingsOpen(v)}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SettingsIcon fontSize="small" color="action" />
              <Typography variant="subtitle2">Googleスプレッドシート設定</Typography>
              {savedSpreadsheetId
                ? <Chip label="設定済み" size="small" color="success" variant="outlined" />
                : <Chip label="未設定" size="small" color="warning" variant="outlined" />
              }
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <TextField
                label="Spreadsheet ID"
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value.trim())}
                placeholder="GoogleスプレッドシートURL中の /d/{ID}/ 部分"
                size="small"
                sx={{ flex: 1, minWidth: 320 }}
                helperText="契約管理用Googleスプレッドシートのシートタブ（TSR, TGMO等）を読み込みます"
              />
              <Button
                variant="contained"
                onClick={handleSaveConfig}
                disabled={savingConfig || !spreadsheetId}
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
          </AccordionDetails>
        </Accordion>

        {/* Errors */}
        {tabsError && <Alert severity="error">{tabsError}</Alert>}
        {rowsError && <Alert severity="error">{rowsError}</Alert>}

        {!savedSpreadsheetId && (
          <Alert severity="info">
            上の設定セクションを開き、契約管理用GoogleスプレッドシートのIDを入力して「保存してタブを取得」を押してください。
          </Alert>
        )}

        {/* Phase annotations */}
        {savedSpreadsheetId && (
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Alert severity="warning" icon={false} sx={{ flex: 1, minWidth: 220, py: 0.5 }}>
              <Typography variant="caption" fontWeight={700} display="block">📄 Phase 1（現在）</Typography>
              <Typography variant="caption">データはGoogle Sheetsから取得。表示・検索・ステータス確認に特化。シートへの直リンクで編集も可能。</Typography>
            </Alert>
            <Alert severity="info" icon={false} sx={{ flex: 1, minWidth: 220, py: 0.5 }}>
              <Typography variant="caption" fontWeight={700} display="block">🗄️ Phase 2（将来）</Typography>
              <Typography variant="caption">Cosmos DBに移行後はアプリ内で直接CRUD。Google Sheetsは不要またはオプションの出力先に。</Typography>
            </Alert>
            <Alert severity="info" icon={<AssignmentIcon fontSize="small" />} sx={{ flex: 1, minWidth: 220, py: 0.5 }}>
              <Typography variant="caption" fontWeight={700} display="block">💡 中間金カレンダー → Tasks</Typography>
              <Typography variant="caption">中間金支払いをタスクとして登録すると既存のダッシュボード・カレンダーで期日管理が完結。</Typography>
            </Alert>
          </Box>
        )}

        {/* Stats */}
        {savedSpreadsheetId && tabs.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {[
              { label: '総契約数', value: stats.total, color: 'primary.main' },
              { label: '今月の支払期日', value: stats.dueThisMonth, color: 'warning.main' },
              { label: '期限超過', value: stats.overdue, color: 'error.main' },
              { label: '残代金完了', value: stats.completed, color: 'success.main' },
            ].map((s) => (
              <Box key={s.label} sx={{
                bgcolor: 'background.paper', border: 1, borderColor: 'divider',
                borderRadius: 2, px: 2, py: 1.5, minWidth: 130,
              }}>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 10 }}>
                  {s.label}
                </Typography>
                <Typography variant="h5" fontWeight={700} sx={{ color: s.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }}>
                  {loadingRows ? '—' : s.value}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {/* Table */}
        {savedSpreadsheetId && tabs.length > 0 && (
          <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden', flex: 1 }}>
            {/* Toolbar */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField
                  size="small"
                  placeholder="購入者名・Unitで検索…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                  sx={{ width: 240 }}
                />
                {loadingRows && <CircularProgress size={16} />}
                {!loadingRows && rows.length > 0 && (
                  <Chip label={`${filteredRows.length} / ${rows.length} 件`} size="small" variant="outlined" />
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={() => {
                    const tabName = tabs[activeTab];
                    if (tabName && savedSpreadsheetId) {
                      setLoadingRows(true);
                      setRows([]);
                      axios.get(`${API}/GetSheetData?spreadsheetId=${encodeURIComponent(savedSpreadsheetId)}&sheetTab=${encodeURIComponent(tabName)}&headerRow=1`)
                        .then((res) => { setHeaders(res.data.headers || []); setRows(res.data.rows || []); })
                        .catch((e) => { const msg = e.response?.data || e.message; setRowsError(typeof msg === 'string' ? msg : 'データの取得に失敗しました'); })
                        .finally(() => setLoadingRows(false));
                    }
                  }}
                  variant="outlined"
                >
                  再読み込み
                </Button>
                {sheetsUrl && currentTab && (
                  <Button
                    size="small"
                    startIcon={<OpenInNewIcon />}
                    component="a"
                    href={`${sheetsUrl}/edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outlined"
                  >
                    Sheetsで開く
                  </Button>
                )}
              </Box>
            </Box>

            {/* Table */}
            <Box sx={{ overflow: 'auto' }}>
              {loadingRows ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : rows.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography color="text.secondary" variant="body2">
                    {tabs.length === 0 ? 'プロジェクトタブを選択してください' : 'データがありません'}
                  </Typography>
                </Box>
              ) : (
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {cols.id >= 0 && <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>ID</TableCell>}
                      <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>購入者名</TableCell>
                      {cols.sales >= 0 && <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>担当</TableCell>}
                      {(cols.tower >= 0 || cols.unit >= 0) && <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Tower / Unit</TableCell>}
                      {cols.price >= 0 && <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>購入金額</TableCell>}
                      {cols.monthly >= 0 && <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>月次支払日</TableCell>}
                      {cols.finalDue >= 0 && <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>残代金期日</TableCell>}
                      {cols.status >= 0 && <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>ステータス</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredRows.map((row, idx) => {
                      const isSelected = selectedRow === row;
                      const nameJp = cellVal(row, headers, cols.nameJp);
                      const nameEn = cellVal(row, headers, cols.nameEn);
                      const tower = cellVal(row, headers, cols.tower);
                      const unit = cellVal(row, headers, cols.unit);
                      const status = cellVal(row, headers, cols.status);
                      return (
                        <TableRow
                          key={idx}
                          hover
                          selected={isSelected}
                          onClick={() => handleRowClick(row)}
                          sx={{ cursor: 'pointer' }}
                        >
                          {cols.id >= 0 && (
                            <TableCell sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.secondary', fontSize: 12 }}>
                              {cellVal(row, headers, cols.id)}
                            </TableCell>
                          )}
                          <TableCell>
                            <Typography variant="body2" fontWeight={500}>{nameJp || nameEn || '—'}</Typography>
                            {nameJp && nameEn && (
                              <Typography variant="caption" color="text.secondary">{nameEn}</Typography>
                            )}
                          </TableCell>
                          {cols.sales >= 0 && (
                            <TableCell sx={{ fontSize: 12 }}>{cellVal(row, headers, cols.sales)}</TableCell>
                          )}
                          {(cols.tower >= 0 || cols.unit >= 0) && (
                            <TableCell>
                              <Typography variant="body2" fontWeight={600} color="primary.main" sx={{ fontSize: 12 }}>
                                {[tower, unit].filter(Boolean).join(' / ') || '—'}
                              </Typography>
                            </TableCell>
                          )}
                          {cols.price >= 0 && (
                            <TableCell sx={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, whiteSpace: 'nowrap' }}>
                              {formatPrice(cellVal(row, headers, cols.price))}
                            </TableCell>
                          )}
                          {cols.monthly >= 0 && (
                            <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>{cellVal(row, headers, cols.monthly)}</TableCell>
                          )}
                          {cols.finalDue >= 0 && (
                            <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>{cellVal(row, headers, cols.finalDue)}</TableCell>
                          )}
                          {cols.status >= 0 && (
                            <TableCell>
                              {status ? (
                                <Chip
                                  label={status}
                                  size="small"
                                  color={statusColor(status)}
                                  variant="outlined"
                                />
                              ) : '—'}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* Side Panel Drawer */}
      <Drawer
        anchor="right"
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: 400,
            p: 0,
          },
        }}
      >
        {selectedRow && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Panel Header */}
            <Box sx={{ px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  {cellVal(selectedRow, headers, cols.nameJp) || cellVal(selectedRow, headers, cols.nameEn) || '購入者詳細'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {currentTab}{' '}
                  {cellVal(selectedRow, headers, cols.tower) && `${cellVal(selectedRow, headers, cols.tower)} / `}
                  {cellVal(selectedRow, headers, cols.unit)}
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => setPanelOpen(false)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>

            {/* Panel Body */}
            <Box sx={{ flex: 1, overflow: 'auto', px: 2.5, py: 2 }}>
              {/* Contract info */}
              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
                契約情報
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5, mb: 2 }}>
                {headers.filter((h) => selectedRow[h] !== '' && selectedRow[h] != null).map((h) => (
                  <Box key={h} sx={{ width: 'calc(50% - 4px)', minWidth: 120 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{h}</Typography>
                    <Typography variant="body2" fontWeight={500} sx={{ wordBreak: 'break-word', fontSize: 12 }}>
                      {cols.price >= 0 && h === headers[cols.price]
                        ? formatPrice(selectedRow[h])
                        : String(selectedRow[h] ?? '—')}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Divider sx={{ my: 1.5 }} />

              {/* Task note */}
              <Box sx={{ bgcolor: 'primary.50', border: 1, borderColor: 'primary.200', borderRadius: 1.5, p: 1.5, display: 'flex', gap: 1 }}>
                <AssignmentIcon fontSize="small" color="primary" sx={{ flexShrink: 0, mt: 0.2 }} />
                <Typography variant="caption" color="primary.main">
                  「Taskとして登録」で既存のタスクカレンダー・ダッシュボードに中間金期日が表示されます
                </Typography>
              </Box>
            </Box>

            {/* Panel Actions */}
            <Box sx={{ px: 2.5, py: 1.5, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                startIcon={<AssignmentIcon />}
                fullWidth
                onClick={() => setTaskDialogOpen(true)}
              >
                Taskとして登録
              </Button>
              {sheetsUrl && (
                <Button
                  variant="outlined"
                  startIcon={<OpenInNewIcon />}
                  component="a"
                  href={`${sheetsUrl}/edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  Sheetsで開く
                </Button>
              )}
            </Box>
          </Box>
        )}
      </Drawer>

      {/* Task Creation Dialog */}
      <Dialog open={taskDialogOpen} onClose={() => setTaskDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>タスクとして登録</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          <TextField
            label="タスクタイトル"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            fullWidth
            size="small"
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="期日"
              type="date"
              value={taskDueDate}
              onChange={(e) => setTaskDueDate(e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1 }}
            />
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>優先度</InputLabel>
              <Select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)} label="優先度">
                <MenuItem value="low">低</MenuItem>
                <MenuItem value="medium">中</MenuItem>
                <MenuItem value="high">高</MenuItem>
                <MenuItem value="urgent">緊急</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <TextField
            label="詳細"
            value={taskDesc}
            onChange={(e) => setTaskDesc(e.target.value)}
            multiline
            rows={4}
            fullWidth
            size="small"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTaskDialogOpen(false)}>キャンセル</Button>
          <Button
            variant="contained"
            onClick={handleCreateTask}
            disabled={creatingTask || !taskTitle.trim()}
          >
            {creatingTask ? '登録中...' : '登録'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
