import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogContent,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PeopleIcon from '@mui/icons-material/People';

const API_URL = '/api';

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function GlobalSearch({ open, onClose, onSelectTask }) {
  const [query, setQuery] = useState('');
  const [tasks, setTasks] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const debouncedQuery = useDebounce(query, 250);

  // データを一度だけ取得してクライアント側でフィルタ
  const [allTasks, setAllTasks] = useState(null);
  const [allCustomers, setAllCustomers] = useState(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 50);
    if (allTasks === null) {
      setLoading(true);
      Promise.all([
        axios.get(`${API_URL}/GetTasks`).then(r => r.data),
        axios.get(`${API_URL}/GetCustomers`).then(r => r.data).catch(() => []),
      ]).then(([t, c]) => {
        setAllTasks(t || []);
        setAllCustomers(c || []);
      }).finally(() => setLoading(false));
    }
  }, [open]);

  useEffect(() => {
    if (!debouncedQuery.trim() || !allTasks) {
      setTasks([]);
      setCustomers([]);
      return;
    }
    const q = debouncedQuery.toLowerCase();
    setTasks(
      (allTasks || [])
        .filter(t =>
          t.title?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.category?.toLowerCase().includes(q) ||
          (t.assignees || []).some(a => a.toLowerCase().includes(q)) ||
          (t.tags || []).some(tag => tag.toLowerCase().includes(q))
        )
        .slice(0, 8)
    );
    setCustomers(
      (allCustomers || [])
        .filter(c =>
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q)
        )
        .slice(0, 5)
    );
  }, [debouncedQuery, allTasks, allCustomers]);

  const handleSelectTask = useCallback((task) => {
    onClose();
    onSelectTask(task.id);
  }, [onClose, onSelectTask]);

  const hasResults = tasks.length > 0 || customers.length > 0;
  const showEmpty = debouncedQuery.trim() && !loading && !hasResults;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { mt: { xs: 4, sm: 8 }, verticalAlign: 'top', borderRadius: 2 } }}
    >
      <DialogContent sx={{ p: 0 }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          placeholder="タスク・顧客を検索..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          variant="outlined"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                {loading ? <CircularProgress size={18} /> : <SearchIcon color="action" />}
              </InputAdornment>
            ),
            sx: {
              '& fieldset': { border: 'none' },
              fontSize: '1rem',
              px: 1,
            },
          }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px 8px 0 0' } }}
        />

        {hasResults && (
          <>
            <Divider />
            <List dense disablePadding sx={{ maxHeight: 420, overflow: 'auto' }}>
              {tasks.length > 0 && (
                <>
                  <ListItem sx={{ py: 0.5, px: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.68rem' }}>
                      タスク
                    </Typography>
                  </ListItem>
                  {tasks.map(task => (
                    <ListItemButton key={task.id} onClick={() => handleSelectTask(task)} sx={{ px: 2, py: 0.75 }}>
                      <AssignmentIcon sx={{ fontSize: 16, mr: 1.5, color: 'text.secondary', flexShrink: 0 }} />
                      <ListItemText
                        primary={task.title}
                        secondary={[task.category, ...(task.assignees || [])].filter(Boolean).join(' · ')}
                        primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 500, noWrap: true }}
                        secondaryTypographyProps={{ fontSize: '0.78rem', noWrap: true }}
                      />
                      {task.status && (
                        <Chip label={task.status} size="small" sx={{ ml: 1, fontSize: '0.68rem', height: 20, flexShrink: 0 }} />
                      )}
                    </ListItemButton>
                  ))}
                </>
              )}

              {customers.length > 0 && (
                <>
                  {tasks.length > 0 && <Divider />}
                  <ListItem sx={{ py: 0.5, px: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.68rem' }}>
                      顧客
                    </Typography>
                  </ListItem>
                  {customers.map(customer => (
                    <ListItemButton key={customer.id} sx={{ px: 2, py: 0.75 }}>
                      <PeopleIcon sx={{ fontSize: 16, mr: 1.5, color: 'text.secondary', flexShrink: 0 }} />
                      <ListItemText
                        primary={customer.name}
                        secondary={[customer.company, customer.email].filter(Boolean).join(' · ')}
                        primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 500, noWrap: true }}
                        secondaryTypographyProps={{ fontSize: '0.78rem', noWrap: true }}
                      />
                      {customer.status && (
                        <Chip label={customer.status} size="small" sx={{ ml: 1, fontSize: '0.68rem', height: 20, flexShrink: 0 }} />
                      )}
                    </ListItemButton>
                  ))}
                </>
              )}
            </List>
          </>
        )}

        {showEmpty && (
          <>
            <Divider />
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                「{debouncedQuery}」に一致する結果がありません
              </Typography>
            </Box>
          </>
        )}

        {!debouncedQuery && !loading && (
          <>
            <Divider />
            <Box sx={{ py: 2, px: 2 }}>
              <Typography variant="caption" color="text.secondary">
                タスク名・説明・カテゴリ・担当者・タグ・顧客名で検索できます
              </Typography>
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
