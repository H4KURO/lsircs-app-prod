// app/src/TaskDetailModal.jsx

import { useState } from 'react';
// ▼▼▼ MUIのSelectとAutocompleteをインポート ▼▼▼
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, FormControl, InputLabel, Select, MenuItem, Autocomplete, Chip } from '@mui/material';

export function TaskDetailModal({ task, onSave, onClose, assigneeOptions, categoryOptions, tagOptions }) {
  const [editableTask, setEditableTask] = useState(task);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditableTask({ ...editableTask, [name]: value });
  };
  
  return (
    <Dialog open={true} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>タスク詳細の編集</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: '10px !important' }}>
        <TextField label="タイトル" name="title" value={editableTask.title || ''} onChange={handleChange} variant="outlined" fullWidth margin="dense" />
        <TextField label="説明" name="description" value={editableTask.description || ''} onChange={handleChange} variant="outlined" multiline rows={4} fullWidth margin="dense" />
        
        {/* ▼▼▼ 重要度のドロップダウンを追加 ▼▼▼ */}
        <FormControl fullWidth margin="dense">
          <InputLabel>重要度</InputLabel>
          <Select name="importance" value={editableTask.importance || 1} label="重要度" onChange={handleChange} >
            <MenuItem value={2}>高</MenuItem>
            <MenuItem value={1}>中</MenuItem>
            <MenuItem value={0}>低</MenuItem>
          </Select>
        </FormControl>

        {/* ▼▼▼ カテゴリーをドロップダウンに変更 ▼▼▼ */}
        <FormControl fullWidth margin="dense">
          <InputLabel>カテゴリー</InputLabel>
          <Select name="category" value={editableTask.category || ''} label="カテゴリー" onChange={handleChange} >
            {categoryOptions.map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}
          </Select>
        </FormControl>

        {/* ▼▼▼ 担当者をドロップダウンに変更 ▼▼▼ */}
        <FormControl fullWidth margin="dense">
          <InputLabel>担当者</InputLabel>
          <Select name="assignee" value={editableTask.assignee || ''} label="担当者" onChange={handleChange} >
            {assigneeOptions.map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}
          </Select>
        </FormControl>

        {/* ▼▼▼ タグをAutocomplete（高機能なドロップダウン）に変更 ▼▼▼ */}
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
          renderInput={(params) => (
            <TextField {...params} variant="outlined" label="タグ" placeholder="タグを追加..." />
          )}
        />
        
        <TextField label="締め切り" name="deadline" type="date" value={editableTask.deadline ? editableTask.deadline.split('T')[0] : ''} onChange={handleChange} InputLabelProps={{ shrink: true }} fullWidth margin="dense" />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={() => onSave(editableTask)} variant="contained">保存</Button>
      </DialogActions>
    </Dialog>
  );
}