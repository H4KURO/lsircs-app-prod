// app/src/TaskDetailModal.jsx

import { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Autocomplete, Chip } from '@mui/material';

// 重要度の選択肢
const importanceOptions = [
  { label: '高', value: 2 },
  { label: '中', value: 1 },
  { label: '低', value: 0 },
];

export function TaskDetailModal({ task, onSave, onClose, assigneeOptions, categoryOptions, tagOptions }) {
  const [editableTask, setEditableTask] = useState(task);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditableTask({ ...editableTask, [name]: value });
  };
  
  return (
    <Dialog open={true} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{task.id ? 'タスク詳細の編集' : '新規タスク作成'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, paddingTop: '10px !important', mt:2 }}>
        <TextField label="タイトル" name="title" value={editableTask.title || ''} onChange={handleChange} variant="outlined" fullWidth />
        <TextField label="説明" name="description" value={editableTask.description || ''} onChange={handleChange} variant="outlined" multiline rows={4} fullWidth />
        
        <Autocomplete
          options={importanceOptions}
          getOptionLabel={(option) => option.label || ''}
          value={importanceOptions.find(opt => opt.value === editableTask.importance) || null}
          onChange={(event, newValue) => {
            setEditableTask({ ...editableTask, importance: newValue ? newValue.value : 1 });
          }}
          renderInput={(params) => <TextField {...params} label="重要度" />}
        />

        <Autocomplete
          options={categoryOptions}
          value={editableTask.category || null}
          onChange={(event, newValue) => {
            setEditableTask({ ...editableTask, category: newValue });
          }}
          freeSolo
          renderInput={(params) => <TextField {...params} label="カテゴリー" />}
        />

        <Autocomplete
          options={assigneeOptions}
          value={editableTask.assignee || null}
          onChange={(event, newValue) => {
            setEditableTask({ ...editableTask, assignee: newValue });
          }}
          freeSolo
          renderInput={(params) => <TextField {...params} label="担当者" />}
        />

        <Autocomplete
          multiple
          freeSolo
          options={tagOptions}
          value={editableTask.tags || []}
          onChange={(event, newValue) => {
            setEditableTask({ ...editableTask, tags: newValue });
          }}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip variant="outlined" label={option} {...getTagProps({ index })} />
            ))
          }
          renderInput={(params) => <TextField {...params} label="タグ" placeholder="タグを追加..." />}
        />
        
        <TextField label="締め切り" name="deadline" type="date" value={editableTask.deadline ? editableTask.deadline.split('T')[0] : ''} onChange={handleChange} InputLabelProps={{ shrink: true }} fullWidth />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={() => onSave(editableTask)} variant="contained">保存</Button>
      </DialogActions>
    </Dialog>
  );
}