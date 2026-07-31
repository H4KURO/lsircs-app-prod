// app/src/AssetFinancialDashboardTab.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';

const API_URL = '/api';

// dataviz skill: fixed categorical hue order (slot1 blue, slot2 orange), status colors reserved for state (good/critical)
const COLOR_INCOME = '#2a78d6';
const COLOR_EXPENSE = '#eb6834';
const COLOR_SURPLUS = '#0ca30c';
const COLOR_DEFICIT = '#d03b3b';

const MONTHS_BACK = 12;

function formatCurrency(value) {
  return `¥${Number(value || 0).toLocaleString('ja-JP')}`;
}

function lastNYearMonths(n) {
  const months = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

export function AssetFinancialDashboardTab({ properties }) {
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [txRes, expRes] = await Promise.all([
        axios.get(`${API_URL}/GetAssetRentTransactions`),
        axios.get(`${API_URL}/GetAssetExpenses`),
      ]);
      setTransactions(txRes.data || []);
      setExpenses(expRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data || err.message || '収支データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!selectedPropertyId && properties.length > 0) {
      setSelectedPropertyId(properties[0].id);
    }
  }, [properties, selectedPropertyId]);

  const months = useMemo(() => lastNYearMonths(MONTHS_BACK), []);

  const rows = useMemo(() => {
    if (!selectedPropertyId) return [];
    return months.map((yearMonth) => {
      const income = transactions
        .filter((t) => t.propertyId === selectedPropertyId && t.yearMonth === yearMonth)
        .reduce((sum, t) => sum + (Number(t.receivedAmount) || 0), 0);
      const expense = expenses
        .filter((e) => e.propertyId === selectedPropertyId && e.yearMonth === yearMonth)
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const net = income - expense;
      return {
        yearMonth,
        income,
        expense,
        net,
        netPositive: net >= 0 ? net : null,
        netNegative: net < 0 ? net : null,
      };
    });
  }, [months, transactions, expenses, selectedPropertyId]);

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
        <Typography variant="h6" fontWeight={700}>収支ダッシュボード</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel>物件</InputLabel>
          <Select
            value={selectedPropertyId}
            label="物件"
            onChange={(e) => setSelectedPropertyId(e.target.value)}
          >
            {properties.map((property) => (
              <MenuItem key={property.id} value={property.id}>{property.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {properties.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>先に「物件」タブで物件を登録してください。</Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchData}>再試行</Button>}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : selectedProperty ? (
        <>
          <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              {selectedProperty.name} — 月次収入・支出（直近{MONTHS_BACK}ヶ月）
            </Typography>
            <BarChart
              dataset={rows}
              xAxis={[{ scaleType: 'band', dataKey: 'yearMonth', label: '対象年月' }]}
              yAxis={[{ label: '金額（円）', valueFormatter: (v) => `¥${(v / 10000).toLocaleString('ja-JP')}万` }]}
              series={[
                { dataKey: 'income', label: '収入', color: COLOR_INCOME, valueFormatter: (v) => formatCurrency(v) },
                { dataKey: 'expense', label: '支出', color: COLOR_EXPENSE, valueFormatter: (v) => formatCurrency(v) },
              ]}
              height={320}
              grid={{ horizontal: true }}
            />
          </Paper>

          <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              {selectedProperty.name} — 月次収支（黒字/赤字、直近{MONTHS_BACK}ヶ月）
            </Typography>
            <BarChart
              dataset={rows}
              xAxis={[{ scaleType: 'band', dataKey: 'yearMonth', label: '対象年月' }]}
              yAxis={[{ label: '収支（円）', valueFormatter: (v) => `¥${(v / 10000).toLocaleString('ja-JP')}万` }]}
              series={[
                { dataKey: 'netPositive', label: '黒字', color: COLOR_SURPLUS, valueFormatter: (v) => (v == null ? '—' : formatCurrency(v)) },
                { dataKey: 'netNegative', label: '赤字', color: COLOR_DEFICIT, valueFormatter: (v) => (v == null ? '—' : formatCurrency(v)) },
              ]}
              // 黒字/赤字は色覚多様性検証でΔE不足のため、色だけに頼らずゼロ基準線からの向き＋直接ラベルで冗長化する
              barLabel={(item) => (item.value == null ? '' : `¥${Math.round(item.value / 10000).toLocaleString('ja-JP')}万`)}
              height={260}
              grid={{ horizontal: true }}
            />
          </Paper>

          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>一覧表</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>対象年月</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">収入</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">支出</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">収支</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.yearMonth} hover>
                      <TableCell>{row.yearMonth}</TableCell>
                      <TableCell align="right">{formatCurrency(row.income)}</TableCell>
                      <TableCell align="right">{formatCurrency(row.expense)}</TableCell>
                      <TableCell align="right" sx={{ color: row.net >= 0 ? 'success.main' : 'error.main', fontWeight: 600 }}>
                        {formatCurrency(row.net)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      ) : null}
    </Box>
  );
}

export default AssetFinancialDashboardTab;
