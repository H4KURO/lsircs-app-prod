// app/src/TaskDetailModal.jsx

import { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Autocomplete, Chip } from '@mui/material';

export function TaskDetailModal({ task, onSave, onClose, assigneeOptions, categoryOptions, tagOptions }) {
  const [editableTask, setEditableTask] = useState(task);

  // Autocompleteコンポーネント用の汎用的なハンドラ
  const handleAutocompleteChange = (field, newValue) => {
    setEditableTask({ ...editableTask, [field]: newValue });
  };

  return (
    <Dialog open={true} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>タスク詳細の編集</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, paddingTop: '10px !important', mt:2 }}>
        <TextField label="タイトル" name="title" value={editableTask.title || ''} onChange={(e) => handleAutocompleteChange('title', e.target.value)} variant="outlined" fullWidth />
        <TextField label="説明" name="description" value={editableTask.description || ''} onChange={(e) => handleAutocompleteChange('description', e.target.value)} variant="outlined" multiline rows={4} fullWidth />
        
        {/* ▼▼▼ カテゴリーをAutocompleteに変更 ▼▼▼ */}
        <Autocomplete
          options={categoryOptions}
          value={editableTask.category || null}
          onChange={(event, newValue) => handleAutocompleteChange('category', newValue)}
          freeSolo // 自由入力も許可
          renderInput={(params) => <TextField {...params} label="カテゴリー" />}
        />

        {/* ▼▼▼ 担当者をAutocompleteに変更 ▼▼▼ */}
        <Autocomplete
          options={assigneeOptions}
          value={editableTask.assignee || null}
          onChange={(event, newValue) => handleAutocompleteChange('assignee', newValue)}
          freeSolo // 自由入力も許可
          renderInput={(params) => <TextField {...params} label="担当者" />}
        />
        
        {/* タグは既にAutocomplete */}
        <Autocomplete
          multiple
          freeSolo
          options={tagOptions}
          value={editableTask.tags || []}
          onChange={(event, newValue) => handleAutocompleteChange('tags', newValue)}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip variant="outlined" label={option} {...getTagProps({ index })} />
            ))
          }
          renderInput={(params) => (
            <TextField {...params} variant="outlined" label="タグ" placeholder="タグを追加..." />
          )}
        />
        
        <TextField 
          label="締め切り" 
          name="deadline" 
          type="date" 
          value={editableTask.deadline ? editableTask.deadline.split('T')[0] : ''} 
          onChange={(e) => handleAutocompleteChange('deadline', e.target.value)} 
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