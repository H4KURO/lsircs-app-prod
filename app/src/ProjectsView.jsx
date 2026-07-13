// app/src/ProjectsView.jsx
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Button,
  TextField,
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

const API_URL = '/api';

const EMPTY_FORM = {
  name: '',
  developer: '',
  spreadsheetId: '',
  sheetName: '',
  headerRows: 3,
  status: 'active',
};

function shortenId(id) {
  if (!id) return '—';
  return id.length > 20 ? id.slice(0, 20) + '...' : id;
}

export function ProjectsView() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/GetProjects`);
      setProjects(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data || err.message || 'プロジェクトデータの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleOpenNew = () => {
    setEditingProject(null);
    setForm(EMPTY_FORM);
    setSaveError('');
    setDialogOpen(true);
  };

  const handleOpenEdit = (project) => {
    setEditingProject(project);
    setForm({
      name: project.name ?? '',
      developer: project.developer ?? '',
      spreadsheetId: project.spreadsheetId ?? '',
      sheetName: project.sheetName ?? '',
      headerRows: project.headerRows ?? 3,
      status: project.status ?? 'active',
    });
    setSaveError('');
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    if (saving) return;
    setDialogOpen(false);
    setEditingProject(null);
    setForm(EMPTY_FORM);
    setSaveError('');
  };

  const handleFormChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setSaveError('プロジェクト名は必須です');
      return;
    }
    if (!form.spreadsheetId.trim()) {
      setSaveError('スプレッドシートIDは必須です');
      return;
    }
    if (!form.sheetName.trim()) {
      setSaveError('シート名は必須です');
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        ...form,
        headerRows: Number(form.headerRows) || 3,
      };
      if (editingProject) {
        await axios.post(`${API_URL}/UpdateProject`, { id: editingProject.id, ...payload });
      } else {
        await axios.post(`${API_URL}/CreateProject`, payload);
      }
      setDialogOpen(false);
      fetchProjects();
    } catch (err) {
      setSaveError(err.response?.data?.message || err.response?.data || err.message || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (project) => {
    if (!window.confirm(`プロジェクト「${project.name}」を削除しますか？`)) return;
    try {
      await axios.post(`${API_URL}/DeleteProject`, { id: project.id });
      fetchProjects();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data || err.message || '削除に失敗しました');
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>
          プロジェクト管理
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenNew}
        >
          プロジェクト追加
        </Button>
      </Box>

      <Paper elevation={2} sx={{ p: 2 }}>
        {/* エラー表示 */}
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button size="small" onClick={fetchProjects}>
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
          <TableContainer sx={{ maxHeight: 'calc(100vh - 280px)' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>プロジェクト名</TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>開発業者</TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>スプレッドシートID</TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>シート名</TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>ヘッダー行数</TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>ステータス</TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {projects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                      プロジェクトがありません
                    </TableCell>
                  </TableRow>
                ) : (
                  projects.map((project) => (
                    <TableRow
                      key={project.id}
                      hover
                      sx={{ '&:last-child td': { border: 0 } }}
                    >
                      <TableCell sx={{ fontWeight: 500 }}>{project.name}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        {project.developer || '—'}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                        {shortenId(project.spreadsheetId)}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        {project.sheetName || '—'}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        {project.headerRows ?? 3}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={project.status === 'active' ? '有効' : '無効'}
                          color={project.status === 'active' ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenEdit(project)}
                          aria-label="編集"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(project)}
                          aria-label="削除"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* 追加・編集ダイアログ */}
      <Dialog open={dialogOpen} onClose={handleDialogClose} fullWidth maxWidth="sm">
        <DialogTitle>
          {editingProject ? 'プロジェクト編集' : 'プロジェクト追加'}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {saveError && (
              <Alert severity="error">{saveError}</Alert>
            )}
            <TextField
              label="プロジェクト名"
              value={form.name}
              onChange={handleFormChange('name')}
              required
              fullWidth
              size="small"
            />
            <TextField
              label="開発業者"
              value={form.developer}
              onChange={handleFormChange('developer')}
              fullWidth
              size="small"
            />
            <TextField
              label="スプレッドシートID"
              value={form.spreadsheetId}
              onChange={handleFormChange('spreadsheetId')}
              required
              fullWidth
              size="small"
              helperText="Google SheetsのURLに含まれるID"
            />
            <TextField
              label="シート名"
              value={form.sheetName}
              onChange={handleFormChange('sheetName')}
              required
              fullWidth
              size="small"
              helperText="スプレッドシート内のタブ名"
            />
            <TextField
              label="ヘッダー行数"
              type="number"
              value={form.headerRows}
              onChange={handleFormChange('headerRows')}
              fullWidth
              size="small"
              inputProps={{ min: 0 }}
            />
            <FormControl fullWidth size="small">
              <InputLabel>ステータス</InputLabel>
              <Select
                value={form.status}
                label="ステータス"
                onChange={handleFormChange('status')}
              >
                <MenuItem value="active">有効</MenuItem>
                <MenuItem value="inactive">無効</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} disabled={saving}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <CircularProgress size={20} /> : '保存'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ProjectsView;
