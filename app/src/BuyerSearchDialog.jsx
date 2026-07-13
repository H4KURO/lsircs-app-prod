import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import SearchIcon from '@mui/icons-material/Search';

const API_URL = '/api';

function buildColumnLabels(headers) {
  if (!headers || headers.length === 0) return [];
  const maxCols = Math.max(...headers.map((r) => r?.length ?? 0));
  const labels = [];
  for (let col = 0; col < maxCols; col++) {
    const parts = headers
      .map((row) => (row?.[col] != null && row[col] !== '' ? String(row[col]) : null))
      .filter(Boolean);
    const unique = [...new Set(parts)];
    labels.push(unique.join(' / ') || `列${col + 1}`);
  }
  return labels;
}

export function BuyerSearchDialog({ open, onClose, onSelect }) {
  const [searchText, setSearchText] = useState('');
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [data, setData] = useState({ headers: [], rows: [] });
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingBuyers, setLoadingBuyers] = useState(false);

  // プロジェクト一覧を取得（ダイアログ初回オープン時）
  useEffect(() => {
    if (!open) return;
    setSearchText('');
    setData({ headers: [], rows: [] });
    setLoadingProjects(true);
    axios
      .get(`${API_URL}/GetProjects`)
      .then((res) => {
        const active = (res.data || []).filter((p) => p.status !== 'inactive');
        setProjects(active);
        if (active.length > 0) {
          setSelectedProjectId(active[0].id);
        } else {
          setSelectedProjectId('');
        }
      })
      .catch((err) => console.error('GetProjects failed', err))
      .finally(() => setLoadingProjects(false));
  }, [open]);

  // 選択プロジェクトが変わったらバイヤーを取得
  useEffect(() => {
    if (!open) return;
    if (loadingProjects) return;
    setData({ headers: [], rows: [] });
    setSearchText('');
    setLoadingBuyers(true);
    const params = selectedProjectId ? `?projectId=${selectedProjectId}` : '';
    axios
      .get(`${API_URL}/GetBuyers${params}`)
      .then((res) => setData(res.data))
      .catch((err) => console.error('GetBuyers failed', err))
      .finally(() => setLoadingBuyers(false));
  }, [open, selectedProjectId, loadingProjects]);

  const columnLabels = useMemo(() => buildColumnLabels(data.headers), [data.headers]);
  const PREVIEW = 6;

  const filtered = useMemo(() => {
    if (!searchText.trim()) return data.rows;
    const q = searchText.toLowerCase();
    return data.rows.filter((row) =>
      row.some((cell) => String(cell ?? '').toLowerCase().includes(q)),
    );
  }, [data.rows, searchText]);

  const handleSelect = (row) => {
    const rowIndex = data.rows.indexOf(row);
    const displayName = row
      .slice(0, 8)
      .filter((c) => c != null && c !== '')
      .slice(0, 3)
      .join(' · ');
    const selectedProject = projects.find((p) => p.id === selectedProjectId);
    onSelect({
      projectId: selectedProjectId || null,
      projectName: selectedProject?.name ?? null,
      sheetName: data.sheetName || 'Buyers list',
      rowIndex,
      displayName: displayName || `行${rowIndex + 1}`,
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LinkIcon fontSize="small" />
        バイヤーと紐づける
      </DialogTitle>
      <DialogContent>
        {/* プロジェクト選択 */}
        {loadingProjects ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">プロジェクト読み込み中...</Typography>
          </Box>
        ) : projects.length === 0 ? (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              プロジェクトが登録されていません。プロジェクト管理から追加してください。
            </Typography>
          </Box>
        ) : (
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>プロジェクト</InputLabel>
            <Select
              label="プロジェクト"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}{p.developer ? ` — ${p.developer}` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* 検索 */}
        <TextField
          placeholder="名前・ユニット番号などで検索..."
          size="small"
          fullWidth
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
          autoFocus
        />

        {loadingBuyers ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer
            sx={{ maxHeight: 400, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
          >
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {columnLabels.slice(0, PREVIEW).map((label, i) => (
                    <TableCell
                      key={i}
                      sx={{ fontWeight: 700, fontSize: '0.72rem', whiteSpace: 'nowrap' }}
                    >
                      {label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={PREVIEW} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                      {searchText ? '該当なし' : 'データがありません'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row, idx) => (
                    <TableRow
                      key={idx}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleSelect(row)}
                    >
                      {row.slice(0, PREVIEW).map((cell, ci) => (
                        <TableCell
                          key={ci}
                          sx={{
                            fontSize: '0.8rem',
                            maxWidth: 140,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {cell ?? ''}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
      </DialogActions>
    </Dialog>
  );
}
