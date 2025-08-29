// app/src/TaskDetailModal.jsx

import { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button } from '@mui/material';

export function TaskDetailModal({ task, onSave, onClose }) {
  const [editableTask, setEditableTask] = useState(task);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditableTask({ ...editableTask, [name]: value });
  };

  return (
    <Dialog open={true} onClose={onClose}>
      <DialogTitle>タスク詳細の編集</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: '10px !important' }}>
        <TextField
          label="タイトル"
          name="title"
          value={editableTask.title || ''}
          onChange={handleChange}
          variant="outlined"
          fullWidth
        />
        <TextField
          label="説明"
          name="description"
          value={editableTask.description || ''}
          onChange={handleChange}
          variant="outlined"
          multiline
          rows={4}
          fullWidth
        />
        <TextField
          label="担当者"
          name="assignee"
          value={editableTask.assignee || ''}
          onChange={handleChange}
          variant="outlined"
          fullWidth
        />
        <TextField
          label="タグ (カンマ区切り)"
          name="tags"
          value={editableTask.tags ? editableTask.tags.join(', ') : ''}
          onChange={(e) => setEditableTask({ ...editableTask, tags: e.target.value.split(',').map(t => t.trim()) })}
          variant="outlined"
          fullWidth
        />
        <TextField
          label="締め切り"
          name="deadline"
          type="date"
          value={editableTask.deadline ? editableTask.deadline.split('T')[0] : ''}
          onChange={handleChange}
          InputLabelProps={{ shrink: true }}
          fullWidth
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={() => onSave(editableTask)} variant="contained">保存</Button>
      </DialogActions>
    </Dialog>
  );
}