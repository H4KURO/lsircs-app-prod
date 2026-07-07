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
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import LinkIcon from '@mui/icons-material/Link';
import { CustomerDetailModal } from './CustomerDetailModal';

const API_URL = '/api';

const STATUS_OPTIONS = ['すべて', 'Lead', '商談中', '契約済み', 'フォローアップ', '見送り'];

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

export function CRMView({ onNavigateToTask }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('すべて');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

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
                        {customer.buyerLink ? (
                          <Chip
                            icon={<LinkIcon sx={{ fontSize: '0.8rem !important' }} />}
                            label={customer.buyerLink.displayName}
                            size="small"
                            color="info"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', maxWidth: 120 }}
                          />
                        ) : (
                          <Typography sx={{ color: 'text.disabled', fontSize: '0.8rem' }}>—</Typography>
                        )}
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
      />
    </Box>
  );
}

export default CRMView;
