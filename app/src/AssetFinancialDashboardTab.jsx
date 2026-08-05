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
  IconButton,
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
import { DataGrid } from '@mui/x-data-grid';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

const API_URL = '/api';

// dataviz skill: fixed categorical hue order (slot1 blue, slot2 orange), status colors reserved for state (good/critical)
const COLOR_INCOME = '#2a78d6';
const COLOR_EXPENSE = '#eb6834';
const COLOR_SURPLUS = '#0ca30c';
const COLOR_DEFICIT = '#d03b3b';

const MONTHS_BACK = 12;

const EXPENSE_CATEGORIES = [
  { value: 'repair', label: '修繕費' },
  { value: 'management_fee', label: '管理委託手数料' },
  { value: 'insurance', label: '保険料' },
  { value: 'tax', label: '固定資産税' },
  { value: 'other', label: 'その他' },
];

function formatCurrency(value) {
  const num = Number(value || 0);
  const sign = num < 0 ? '-' : '';
  return `${sign}¥${Math.abs(num).toLocaleString('ja-JP')}`;
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

export function AssetFinancialDashboardTab({ properties, contracts = [] }) {
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

  // ── グリッド式収支入力（年単位、Wealth Park風） ──────────────
  const [gridYear, setGridYear] = useState(() => new Date().getFullYear());
  const [gridError, setGridError] = useState('');

  const gridMonths = useMemo(
    () => Array.from({ length: 12 }, (_, i) => `${gridYear}-${String(i + 1).padStart(2, '0')}`),
    [gridYear],
  );

  const gridRows = useMemo(() => {
    if (!selectedPropertyId) return [];

    const incomeRow = { id: 'income', label: '賃料収入', type: 'income' };
    gridMonths.forEach((ym, idx) => {
      incomeRow[`m${idx + 1}`] = transactions
        .filter((t) => t.propertyId === selectedPropertyId && t.yearMonth === ym)
        .reduce((sum, t) => sum + (Number(t.receivedAmount) || 0), 0);
    });

    const expenseRows = EXPENSE_CATEGORIES.map((cat) => {
      const row = { id: `exp-${cat.value}`, label: cat.label, type: 'expense', category: cat.value };
      gridMonths.forEach((ym, idx) => {
        row[`m${idx + 1}`] = expenses
          .filter((e) => e.propertyId === selectedPropertyId && e.category === cat.value && e.yearMonth === ym)
          .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      });
      return row;
    });

    const netRow = { id: 'net', label: '収支', type: 'net' };
    gridMonths.forEach((ym, idx) => {
      const income = incomeRow[`m${idx + 1}`];
      const expenseTotal = expenseRows.reduce((sum, r) => sum + (r[`m${idx + 1}`] || 0), 0);
      netRow[`m${idx + 1}`] = income - expenseTotal;
    });

    return [incomeRow, ...expenseRows, netRow];
  }, [gridMonths, transactions, expenses, selectedPropertyId]);

  const gridColumns = useMemo(() => {
    const monthColumns = gridMonths.map((ym, idx) => ({
      field: `m${idx + 1}`,
      headerName: `${idx + 1}月`,
      width: 100,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value) => (value == null ? '' : formatCurrency(value)),
      // 列単位では true/false しか指定できないため、行ごとの編集可否は DataGrid の isCellEditable prop（グリッドレベル）側で判定する
      editable: true,
      cellClassName: (params) => (params.row.type === 'net' && Number(params.value) < 0 ? 'asset-grid-negative' : ''),
    }));

    return [
      { field: 'label', headerName: '収支項目', width: 160, sortable: false },
      ...monthColumns,
      {
        field: 'yearTotal',
        headerName: '年間合計',
        width: 130,
        align: 'right',
        headerAlign: 'right',
        sortable: false,
        valueGetter: (_value, row) => gridMonths.reduce((sum, _ym, idx) => sum + (Number(row[`m${idx + 1}`]) || 0), 0),
        valueFormatter: (value) => formatCurrency(value),
        cellClassName: (params) => (params.row.type === 'net' && Number(params.value) < 0 ? 'asset-grid-negative' : ''),
      },
    ];
  }, [gridMonths]);

  const handleProcessRowUpdate = useCallback(async (newRow, oldRow) => {
    if (newRow.type !== 'expense' && newRow.type !== 'income') return oldRow;

    const changedField = Object.keys(newRow).find((key) => /^m\d+$/.test(key) && newRow[key] !== oldRow[key]);
    if (!changedField) return newRow;

    const monthIndex = Number(changedField.slice(1)) - 1;
    const yearMonth = gridMonths[monthIndex];
    const newAmount = Number(newRow[changedField]) || 0;

    setGridError('');
    try {
      if (newRow.type === 'expense') {
        const category = newRow.category;
        const existing = expenses.filter(
          (e) => e.propertyId === selectedPropertyId && e.category === category && e.yearMonth === yearMonth,
        );
        if (existing.length > 1) {
          setGridError(`${yearMonth}の${newRow.label}は複数件登録されているため、グリッドからは編集できません。「支出」タブで編集してください。`);
          return oldRow;
        }
        if (existing.length === 1) {
          await axios.post(`${API_URL}/UpdateAssetExpense`, { id: existing[0].id, amount: newAmount });
        } else {
          await axios.post(`${API_URL}/CreateAssetExpense`, {
            propertyId: selectedPropertyId,
            category,
            yearMonth,
            amount: newAmount,
          });
        }
      } else {
        // 収入行: 賃料入出金(AssetRentTransactions)は契約単位の記録のため、
        // 更新対象を安全に一意特定できる場合のみ編集を許可する
        const existingTx = transactions.filter(
          (t) => t.propertyId === selectedPropertyId && t.yearMonth === yearMonth,
        );
        if (existingTx.length > 1) {
          setGridError(`${yearMonth}は複数契約の入金が合算されているため、グリッドからは編集できません。「賃料入出金」タブで編集してください。`);
          return oldRow;
        }
        if (existingTx.length === 1) {
          await axios.post(`${API_URL}/UpdateAssetRentTransaction`, { id: existingTx[0].id, receivedAmount: newAmount });
        } else {
          const propertyContracts = contracts.filter((c) => c.propertyId === selectedPropertyId);
          if (propertyContracts.length === 0) {
            setGridError('先に「契約」タブで契約を登録してください。');
            return oldRow;
          }
          if (propertyContracts.length > 1) {
            setGridError(`${yearMonth}はどの契約の入金か特定できないため、グリッドからは新規登録できません。「賃料入出金」タブで契約を指定して登録してください。`);
            return oldRow;
          }
          await axios.post(`${API_URL}/CreateAssetRentTransaction`, {
            contractId: propertyContracts[0].id,
            propertyId: selectedPropertyId,
            yearMonth,
            expectedAmount: newAmount,
            receivedAmount: newAmount,
            status: newAmount > 0 ? 'paid' : 'unpaid',
          });
        }
      }
      await fetchData();
      return newRow;
    } catch (err) {
      setGridError(err.response?.data?.message || err.response?.data || err.message || '保存に失敗しました');
      return oldRow;
    }
  }, [expenses, transactions, contracts, gridMonths, selectedPropertyId, fetchData]);

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

          <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
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

          <Paper elevation={2} sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                {selectedProperty.name} — 収支入力（グリッド）
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              <IconButton size="small" onClick={() => setGridYear((y) => y - 1)} aria-label="前年">
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
              <Typography variant="body2" fontWeight={600} sx={{ minWidth: 56, textAlign: 'center' }}>{gridYear}年</Typography>
              <IconButton size="small" onClick={() => setGridYear((y) => y + 1)} aria-label="翌年">
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              賃料収入・支出のセルはダブルクリックで直接編集できます（収支は自動計算のため編集不可。収入は対象月の契約が1件かつ記録が1件以下の場合のみ編集可能）
            </Typography>
            {gridError && (
              <Alert severity="error" sx={{ mb: 1 }} onClose={() => setGridError('')}>{gridError}</Alert>
            )}
            <Box sx={{ width: '100%', overflowX: 'auto' }}>
              <DataGrid
                autoHeight
                rows={gridRows}
                columns={gridColumns}
                hideFooter
                disableRowSelectionOnClick
                isCellEditable={(params) => params.row.type === 'expense' || params.row.type === 'income'}
                processRowUpdate={handleProcessRowUpdate}
                onProcessRowUpdateError={(err) => setGridError(err.message || '保存に失敗しました')}
                getRowClassName={(params) => (params.row.type === 'net' ? 'asset-grid-net-row' : '')}
                sx={{
                  minWidth: 1000,
                  '& .asset-grid-net-row': { fontWeight: 700, bgcolor: 'action.hover' },
                  '& .asset-grid-negative': { color: 'error.main' },
                }}
              />
            </Box>
          </Paper>
        </>
      ) : null}
    </Box>
  );
}

export default AssetFinancialDashboardTab;
