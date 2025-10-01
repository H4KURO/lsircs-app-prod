import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Autocomplete,
  Chip,
  Box,
  Stack,
  Typography,
  IconButton,
  Checkbox,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { normalizeTask, generateSubtaskId } from './taskUtils';

const importanceOptions = [
  { label: '高', value: 2 },
  { label: '中', value: 1 },
  { label: '低', value: 0 },
];

const createBlankSubtask = () => ({
  id: generateSubtaskId(),
  title: '',
  completed: false,
});

export function TaskDetailModal({ task, onSave, onClose, assigneeOptions, categoryOptions, tagOptions }) {
  const [editableTask, setEditableTask] = useState(() => normalizeTask(task));
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  useEffect(() => {
    setEditableTask(normalizeTask(task));
    setNewSubtaskTitle('');
  }, [task]);

  const subtasks = useMemo(() => Array.isArray(editableTask.subtasks) ? editableTask.subtasks : [], [editableTask.subtasks]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditableTask((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubtaskTitleChange = (subtaskId, value) => {
    setEditableTask((prev) => ({
      ...prev,
      subtasks: subtasks.map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, title: value } : subtask,
      ),
    }));
  };

  const handleToggleSubtask = (subtaskId) => {
    setEditableTask((prev) => ({
      ...prev,
      subtasks: subtasks.map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask,
      ),
    }));
  };

  const handleRemoveSubtask = (subtaskId) => {
    setEditableTask((prev) => ({
      ...prev,
      subtasks: subtasks.filter((subtask) => subtask.id !== subtaskId),
    }));
  };

  const handleAddSubtask = (title) => {
    const trimmed = title.trim();
    setEditableTask((prev) => ({
      ...prev,
      subtasks: [...subtasks, { ...createBlankSubtask(), title: trimmed }],
    }));
  };

  const handleQuickAddSubtask = () => {
    if (!newSubtaskTitle.trim()) {
      handleAddSubtask('');
      return;
    }
    handleAddSubtask(newSubtaskTitle);
    setNewSubtaskTitle('');
  };

  const handleSubmit = () => {
    const sanitizedSubtasks = subtasks.map((subtask, index) => ({
      ...subtask,
      title: subtask.title?.trim() || '',
      order: index,
    }));

    onSave({
      ...editableTask,
      subtasks: sanitizedSubtasks,
    });
  };

  const completedCount = subtasks.filter((subtask) => subtask.completed).length;

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{task.id ? 'タスク詳細の編集' : '新規タスク作成'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: '10px !important', mt: 1 }}>
        <TextField label="タイトル" name="title" value={editableTask.title || ''} onChange={handleChange} variant="outlined" fullWidth />
        <TextField label="説明" name="description" value={editableTask.description || ''} onChange={handleChange} variant="outlined" multiline rows={4} fullWidth />

        <Autocomplete
          options={importanceOptions}
          getOptionLabel={(option) => option.label || ''}
          value={importanceOptions.find((opt) => opt.value === editableTask.importance) || null}
          onChange={(event, newValue) => {
            setEditableTask((prev) => ({ ...prev, importance: newValue ? newValue.value : 1 }));
          }}
          renderInput={(params) => <TextField {...params} label="重要度" />}
        />

        <Autocomplete
          options={categoryOptions}
          value={editableTask.category || null}
          onChange={(event, newValue) => {
            setEditableTask((prev) => ({ ...prev, category: newValue || null }));
          }}
          freeSolo
          renderInput={(params) => <TextField {...params} label="カテゴリ" />}
        />

        <Autocomplete
          multiple
          freeSolo
          options={assigneeOptions}
          value={editableTask.assignees || []}
          onChange={(event, newValue) => {
            const sanitized = (newValue || [])
              .map((option) => (typeof option === 'string' ? option : option?.label ?? ''))
              .map((name) => name.trim())
              .filter(Boolean);
            setEditableTask((prev) => ({
              ...prev,
              assignees: sanitized,
              assignee: sanitized.length > 0 ? sanitized[0] : null,
            }));
          }}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip variant="outlined" label={option} {...getTagProps({ index })} />
            ))
          }
          renderInput={(params) => <TextField {...params} label="担当者" placeholder="担当者を入力または選択..." />}
        />

        <Autocomplete
          multiple
          freeSolo
          options={tagOptions}
          value={editableTask.tags || []}
          onChange={(event, newValue) => {
            const sanitized = (newValue || [])
              .map((option) => (typeof option === 'string' ? option : option?.label ?? ''))
              .map((tag) => tag.trim())
              .filter(Boolean);
            setEditableTask((prev) => ({ ...prev, tags: sanitized }));
          }}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip variant="outlined" label={option} {...getTagProps({ index })} />
            ))
          }
          renderInput={(params) => <TextField {...params} label="タグ" placeholder="タグを入力..." />}
        />

        <TextField label="期限" name="deadline" type="date" value={editableTask.deadline ? editableTask.deadline.split('T')[0] : ''} onChange={handleChange} InputLabelProps={{ shrink: true }} fullWidth />

        <Divider />
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6">サブタスク</Typography>
            <Chip label={`${completedCount}/${subtasks.length} 完了`} size="small" />
          </Box>
          <Stack spacing={1.5}>
            {subtasks.map((subtask) => (
              <Box
                key={subtask.id}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  alignItems: 'center',
                  gap: 1.5,
                }}
              >
                <DragIndicatorIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Checkbox
                    checked={Boolean(subtask.completed)}
                    onChange={() => handleToggleSubtask(subtask.id)}
                    inputProps={{ 'aria-label': 'サブタスクの完了' }}
                  />
                  <TextField
                    fullWidth
                    value={subtask.title || ''}
                    onChange={(event) => handleSubtaskTitleChange(subtask.id, event.target.value)}
                    placeholder="サブタスク名を入力"
                    size="small"
                  />
                </Box>
                <IconButton edge="end" aria-label="サブタスクを削除" onClick={() => handleRemoveSubtask(subtask.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mt: 2 }}>
            <TextField
              label="サブタスクを追加"
              placeholder="サブタスク名"
              size="small"
              fullWidth
              value={newSubtaskTitle}
              onChange={(event) => setNewSubtaskTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleQuickAddSubtask();
                }
              }}
            />
            <Button variant="outlined" startIcon={<AddIcon />} onClick={handleQuickAddSubtask}>
              追加
            </Button>
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={handleSubmit} variant="contained">
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}
