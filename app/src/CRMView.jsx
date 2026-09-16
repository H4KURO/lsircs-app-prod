// app/src/CRMView.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Button,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Radio,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import LinkIcon from '@mui/icons-material/Link';
import MergeIcon from '@mui/icons-material/MergeType';
import { CustomerDetailModal } from './CustomerDetailModal';

const API_URL = '/api';

const STATUS_OPTIONS = ['すべて', 'Lead', '商談中', '契約済み', 'フォローアップ', '見送り'];

// Simple edit distance for fuzzy duplicate detection
function normalize(s) { return (s || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function editDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}
function similarity(a, b) {
  const na = normalize(a), nb = normalize(b);
  if (!na || !nb) return 0;
  return 1 - editDistance(na, nb) / Math.max(na.length, nb.length);
}

function MergeDialog({ open, customers, onClose, onMerged }) {
  const [step, setStep] = useState('select'); // 'select' | 'confirm'
  const [primaryId, setPrimaryId] = useState('');
  const [secondaryId, setSecondaryId] = useState('');
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState('');

  // Find similar pairs
  const pairs = useMemo(() => {
    const result = [];
    for (let i = 0; i < customers.length; i++) {
      for (let j = i + 1; j < customers.length; j++) {
        const score = similarity(customers[i].name, customers[j].name);
        if (score >= 0.7) result.push({ a: customers[i], b: customers[j], score });
      }
    }
    return result.sort((x, y) => y.score - x.score).slice(0, 20);
  }, [customers]);

  const handleMerge = async () => {
    if (!primaryId || !secondaryId) return;
    setMerging(true);
    setError('');
    try {
      await axios.post(`${API_URL}/MergeCustomers`, { primaryId, secondaryId });
      onMerged();
      handleClose();
    } catch (e) {
      setError(e.response?.data || e.message);
    } finally {
      setMerging(false);
    }
  };

  const handleClose = () => {
    setStep('select');
    setPrimaryId('');
    setSecondaryId('');
    setError('');
    onClose();
  };

  const primary = customers.find(c => c.id === primaryId);
  const secondary = customers.find(c => c.id === secondaryId);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>名寄せ（顧客統合）</DialogTitle>
      <DialogContent dividers>
        {step === 'select' && (
          <>
            {pairs.length === 0 ? (
              <Typography color="text.secondary">類似名の顧客は見つかりませんでした。</Typography>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  名前が似ている顧客ペアが見つかりました。統合するペアを選択し、残す方（primary）を選んでください。
                </Typography>
                <List dense>
                  {pairs.map(({ a, b, score }, i) => (
                    <ListItem key={i} disablePadding divider>
                      <ListItemButton
                        onClick={() => { setPrimaryId(a.id); setSecondaryId(b.id); setStep('confirm'); }}
                        sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 1.5 }}
                      >
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', width: '100%' }}>
                          <Typography variant="body2" fontWeight={600}>{a.name}</Typography>
                          <Typography variant="caption" color="text.secondary">←→</Typography>
                          <Typography variant="body2" fontWeight={600}>{b.name}</Typography>
                          <Chip label={`${Math.round(score * 100)}%`} size="small" color="warning" sx={{ ml: 'auto' }} />
                        </Box>
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </>
        )}
        {step === 'confirm' && primary && secondary && (
          <Box>
            <Typography variant="body2" sx={{ mb: 2 }}>
              どちらを残しますか？残さない方のデータは統合されて削除されます。
            </Typography>
            {[primary, secondary].map(c => (
              <Paper
                key={c.id}
                variant="outlined"
                sx={{ p: 1.5, mb: 1, cursor: 'pointer', borderColor: primaryId === c.id ? 'primary.main' : 'divider', borderWidth: primaryId === c.id ? 2 : 1 }}
                onClick={() => { setPrimaryId(c.id); setSecondaryId(c.id === primary.id ? secondary.id : primary.id); }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Radio checked={primaryId === c.id} size="small" />
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{c.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {[c.phone, c.email, c.company].filter(Boolean).join(' / ') || '詳細なし'}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            ))}
            {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {step === 'confirm' && <Button onClick={() => setStep('select')}>戻る</Button>}
        <Button onClick={handleClose}>キャンセル</Button>
        {step === 'confirm' && (
          <Button variant="contained" color="error" onClick={handleMerge} disabled={merging}>
            {merging ? '統合中...' : '統合・削除'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function getStatusColor(status) {
  switch (status) {
    case 'Lead':
      return 'info';
    case '商談中':
      return 'warning';
    case '契約済み':
      return 'success';
    case 'フォローアップ':
      return 'primary';
    case '見送り':
    default:
      return 'default';
  }
}

export function CRMView({ onNavigateToTask, onNavigateToBuyer }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('すべて');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [mergeOpen, setMergeOpen] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/GetCustomers`);
      setCustomers(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data || err.message || '顧客データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const filteredCustomers = useMemo(() => {
    let result = customers;

    if (statusFilter !== 'すべて') {
      result = result.filter((c) => c.status === statusFilter);
    }

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(
        (c) =>
          (c.name ?? '').toLowerCase().includes(q) ||
          (c.email ?? '').toLowerCase().includes(q) ||
          (c.company ?? '').toLowerCase().includes(q) ||
          (c.phone ?? '').toLowerCase().includes(q),
      );
    }

    return result;
  }, [customers, statusFilter, searchText]);

  const handleRowClick = (customer) => {
    setSelectedCustomer(customer);
    setModalOpen(true);
  };

  const handleNewCustomer = () => {
    setSelectedCustomer(null);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedCustomer(null);
  };

  const handleSaved = () => {
    fetchCustomers();
  };

  const handleDeleted = () => {
    fetchCustomers();
  };

  return (
    <Box sx={{ mt: 2 }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>
          顧客管理 (CRM)
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="outlined"
          startIcon={<MergeIcon />}
          onClick={() => setMergeOpen(true)}
        >
          名寄せ
        </Button>
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={handleNewCustomer}
        >
          新規顧客追加
        </Button>
      </Box>

      <Paper elevation={2} sx={{ p: 2 }}>
        {/* 検索バー */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder="氏名・メール・会社・電話で検索..."
            size="small"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ width: 300 }}
          />
          <Typography variant="body2" color="text.secondary">
            {filteredCustomers.length} 件
          </Typography>
        </Box>

        {/* ステータスフィルター */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {STATUS_OPTIONS.map((s) => (
            <Chip
              key={s}
              label={s}
              onClick={() => setStatusFilter(s)}
              color={statusFilter === s ? 'primary' : 'default'}
              variant={statusFilter === s ? 'filled' : 'outlined'}
              size="small"
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Box>

        {/* エラー表示 */}
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button size="small" onClick={fetchCustomers}>
                再試行
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {/* ローディング */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 'calc(100vh - 340px)' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>氏名</TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>ステータス</TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>会社</TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>担当者</TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>次回フォロー</TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>最終接触日</TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>情報ソース</TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>BL連携</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                      {searchText || statusFilter !== 'すべて'
                        ? '該当する顧客が見つかりません'
                        : '顧客データがありません'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => (
                    <TableRow
                      key={customer.id}
                      hover
                      sx={{ cursor: 'pointer', '&:last-child td': { border: 0 } }}
                      onClick={() => handleRowClick(customer)}
                    >
                      <TableCell sx={{ fontWeight: 500 }}>{customer.name}</TableCell>
                      <TableCell>
                        <Chip
                          label={customer.status}
                          color={getStatusColor(customer.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        {customer.company ?? '—'}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        {customer.assignedTo ?? '—'}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        {customer.nextFollowUpAt ?? '—'}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        {customer.lastContactedAt ?? '—'}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        {customer.source ?? '—'}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const links = customer.buyerLinks ?? (customer.buyerLink ? [customer.buyerLink] : []);
                          if (links.length === 0) return <Typography sx={{ color: 'text.disabled', fontSize: '0.8rem' }}>—</Typography>;
                          return (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {links.map((lnk, i) => (
                                <Chip
                                  key={i}
                                  icon={<LinkIcon sx={{ fontSize: '0.8rem !important' }} />}
                                  label={lnk.displayName}
                                  size="small"
                                  color="info"
                                  variant="outlined"
                                  sx={{ fontSize: '0.7rem', maxWidth: 150 }}
                                />
                              ))}
                            </Box>
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* 顧客詳細モーダル */}
      <CustomerDetailModal
        open={modalOpen}
        onClose={handleModalClose}
        customer={selectedCustomer}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
        onNavigateToTask={onNavigateToTask}
        onNavigateToBuyer={onNavigateToBuyer}
      />
      <MergeDialog
        open={mergeOpen}
        customers={customers}
        onClose={() => setMergeOpen(false)}
        onMerged={fetchCustomers}
      />
    </Box>
  );
}

export default CRMView;
