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
  const [data, setData] = useState({ headers: [], rows: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSearchText('');
    axios
      .get(`${API_URL}/GetBuyers`)
      .then((res) => setData(res.data))
      .catch((err) => console.error('GetBuyers failed', err))
      .finally(() => setLoading(false));
  }, [open]);

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
    onSelect({
      sheetName: 'Buyers list',
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
        {loading ? (
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
