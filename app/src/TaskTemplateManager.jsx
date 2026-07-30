import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Box,
  Button,
  Typography,
  Stack,
  Paper,
  IconButton,
  TextField,
  Chip,
  Autocomplete,
  MenuItem,
  Collapse,
  Divider,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { generateSubtaskId } from './taskUtils';

const API_URL = '/api';

const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'];

function createEmptyTemplate() {
  return {
    name: '',
    description: '',
    category: null,
    priority: 'Medium',
    tags: [],
    subtasks: [],
  };
}

function TemplateForm({ initial = createEmptyTemplate(), categoryOptions = [], tagOptions = [], onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    setForm(prev => ({
      ...prev,
      subtasks: [...(prev.subtasks || []), { id: generateSubtaskId(), title: newSubtaskTitle.trim(), completed: false }],
    }));
    setNewSubtaskTitle('');
  };

  const handleRemoveSubtask = (id) => {
    setForm(prev => ({ ...prev, subtasks: prev.subtasks.filter(s => s.id !== id) }));
  };

  return (
    <Stack spacing={2}>
      <TextField
        label="テンプレート名 *"
        value={form.name}
        onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
        size="small"
        fullWidth
      />
      <TextField
        label="説明"
        value={form.description}
        onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
        size="small"
        multiline
        rows={2}
        fullWidth
      />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Autocomplete
          freeSolo
          options={categoryOptions}
          value={form.category || null}
          onChange={(_e, v) => setForm(p => ({ ...p, category: v || null }))}
          renderInput={(params) => <TextField {...params} label="カテゴリ" size="small" />}
          sx={{ flex: 1 }}
        />
        <TextField
          select
          label="優先度"
          value={form.priority}
          onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
          size="small"
          sx={{ width: 120 }}
        >
          {PRIORITY_OPTIONS.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
        </TextField>
      </Box>
      <Autocomplete
        multiple
        freeSolo
        options={tagOptions}
        value={form.tags || []}
        onChange={(_e, v) => setForm(p => ({ ...p, tags: v }))}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip key={option} label={option} size="small" {...getTagProps({ index })} />
          ))
        }
        renderInput={(params) => <TextField {...params} label="タグ" size="small" />}
      />

      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
          サブタスク
        </Typography>
        <Stack spacing={0.75}>
          {(form.subtasks || []).map(s => (
            <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ flex: 1 }}>・{s.title}</Typography>
              <IconButton size="small" onClick={() => handleRemoveSubtask(s.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              placeholder="サブタスクを追加"
              value={newSubtaskTitle}
              onChange={e => setNewSubtaskTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); } }}
              sx={{ flex: 1 }}
            />
            <Button size="small" variant="outlined" onClick={handleAddSubtask} disabled={!newSubtaskTitle.trim()}>
              追加
            </Button>
          </Box>
        </Stack>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button size="small" onClick={onCancel} disabled={saving}>キャンセル</Button>
        <Button
          size="small"
          variant="contained"
          onClick={() => onSave(form)}
          disabled={!form.name.trim() || saving}
          startIcon={saving ? <CircularProgress size={14} /> : <CheckIcon />}
        >
          保存
        </Button>
      </Box>
    </Stack>
  );
}

export function TaskTemplateManager({ categoryOptions = [], tagOptions = [] }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    axios.get(`${API_URL}/GetTaskTemplates`)
      .then(r => setTemplates(Array.isArray(r.data) ? r.data : []))
      .catch(err => console.error('GetTaskTemplates failed', err))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = useCallback(async (form) => {
    setSaving(true);
    try {
      const { data } = await axios.post(`${API_URL}/CreateTaskTemplate`, form);
      setTemplates(prev => [data, ...prev]);
      setIsAdding(false);
    } catch (err) {
      console.error('CreateTaskTemplate failed', err);
    } finally {
      setSaving(false);
    }
  }, []);

  const handleUpdate = useCallback(async (id, form) => {
    setSaving(true);
    try {
      const { data } = await axios.put(`${API_URL}/UpdateTaskTemplate/${id}`, form);
      setTemplates(prev => prev.map(t => t.id === id ? data : t));
      setEditingId(null);
    } catch (err) {
      console.error('UpdateTaskTemplate failed', err);
    } finally {
      setSaving(false);
    }
  }, []);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('このテンプレートを削除しますか？')) return;
    try {
      await axios.delete(`${API_URL}/DeleteTaskTemplate/${id}`);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('DeleteTaskTemplate failed', err);
    }
  }, []);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={24} /></Box>;
  }

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2" color="text.secondary">
          新規タスク作成時に1クリックで適用できるテンプレートを管理します
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => { setIsAdding(true); setEditingId(null); }}
          disabled={isAdding}
        >
          新規テンプレート
        </Button>
      </Box>

      {isAdding && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>新規テンプレート</Typography>
          <TemplateForm
            categoryOptions={categoryOptions}
            tagOptions={tagOptions}
            onSave={handleCreate}
            onCancel={() => setIsAdding(false)}
            saving={saving}
          />
        </Paper>
      )}

      {templates.length === 0 && !isAdding && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
          テンプレートがまだありません。「新規テンプレート」から追加してください。
        </Typography>
      )}

      {templates.map(tmpl => (
        <Paper key={tmpl.id} variant="outlined" sx={{ overflow: 'hidden' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              px: 2,
              py: 1.25,
              gap: 1,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
            }}
            onClick={() => setExpandedId(expandedId === tmpl.id ? null : tmpl.id)}
          >
            {expandedId === tmpl.id ? <ExpandLessIcon fontSize="small" color="action" /> : <ExpandMoreIcon fontSize="small" color="action" />}
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{tmpl.name}</Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.25 }}>
                {tmpl.category && <Chip label={tmpl.category} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.7rem' }} />}
                {(tmpl.tags || []).map(tag => <Chip key={tag} label={tag} size="small" sx={{ height: 18, fontSize: '0.7rem' }} />)}
                {(tmpl.subtasks || []).length > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    サブタスク {tmpl.subtasks.length}件
                  </Typography>
                )}
              </Box>
            </Box>
            <Tooltip title="編集">
              <IconButton size="small" onClick={e => { e.stopPropagation(); setEditingId(tmpl.id); setExpandedId(tmpl.id); }}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="削除">
              <IconButton size="small" onClick={e => { e.stopPropagation(); handleDelete(tmpl.id); }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Collapse in={expandedId === tmpl.id}>
            <Divider />
            <Box sx={{ p: 2 }}>
              {editingId === tmpl.id ? (
                <TemplateForm
                  initial={{ ...tmpl }}
                  categoryOptions={categoryOptions}
                  tagOptions={tagOptions}
                  onSave={form => handleUpdate(tmpl.id, form)}
                  onCancel={() => setEditingId(null)}
                  saving={saving}
                />
              ) : (
                <Stack spacing={0.75}>
                  {tmpl.description && (
                    <Typography variant="body2" color="text.secondary">{tmpl.description}</Typography>
                  )}
                  <Typography variant="caption">優先度: {tmpl.priority || 'Medium'}</Typography>
                  {(tmpl.subtasks || []).length > 0 && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                        サブタスク:
                      </Typography>
                      {tmpl.subtasks.map(s => (
                        <Typography key={s.id} variant="caption" sx={{ display: 'block', ml: 1 }}>・{s.title}</Typography>
                      ))}
                    </Box>
                  )}
                </Stack>
              )}
            </Box>
          </Collapse>
        </Paper>
      ))}
    </Stack>
  );
}
