// app/src/SettingsView.jsx

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Typography, Paper, List, ListItem, ListItemText, Button, TextField, IconButton } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import { MuiColorInput } from 'mui-color-input';

const API_URL = '/api';

export function SettingsView() {
  const [categories, setCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState(null); // 編集中のカテゴリID

  const fetchCategories = () => {
    axios.get(`${API_URL}/GetCategories`).then(res => {
      setCategories(res.data.map(cat => ({ ...cat, color: cat.color || '#cccccc' })));
    });
  };

  useEffect(fetchCategories, []);

  const handleValueChange = (id, field, value) => {
    setCategories(categories.map(cat => 
      cat.id === id ? { ...cat, [field]: value } : cat
    ));
  };
  
  const handleCreate = () => {
    if (!newCategoryName.trim()) return;
    axios.post(`${API_URL}/CreateCategory`, { name: newCategoryName }).then(() => {
      setNewCategoryName('');
      fetchCategories(); // リストを再取得して更新
    });
  };

  const handleUpdate = (categoryToUpdate) => {
    axios.put(`${API_URL}/UpdateCategory/${categoryToUpdate.id}`, { 
        name: categoryToUpdate.name, 
        color: categoryToUpdate.color 
    }).then(() => {
      setEditingCategoryId(null); // 編集モードを終了
      fetchCategories();
    });
  };

  const handleDelete = (idToDelete) => {
    if (window.confirm("このカテゴリを削除しますか？関連するタスクのカテゴリは空になります。")) {
      axios.delete(`${API_URL}/DeleteCategory/${idToDelete}`).then(() => {
        fetchCategories();
      });
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>設定</Typography>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>カテゴリー管理</Typography>
        
        {/* 新規作成フォーム */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            fullWidth
            label="新しいカテゴリー名"
            size="small"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
          />
          <Button variant="contained" onClick={handleCreate}>追加</Button>
        </Box>
        
        {/* カテゴリー一覧 */}
        <List>
          {categories.map(category => (
            <ListItem key={category.id} secondaryAction={
              editingCategoryId === category.id ? (
                <IconButton onClick={() => handleUpdate(category)}><SaveIcon /></IconButton>
              ) : (
                <>
                  <IconButton onClick={() => setEditingCategoryId(category.id)}><EditIcon /></IconButton>
                  <IconButton onClick={() => handleDelete(category.id)}><DeleteIcon /></IconButton>
                </>
              )
            }>
              {editingCategoryId === category.id ? (
                <TextField 
                  variant="standard" 
                  value={category.name} 
                  onChange={(e) => handleValueChange(category.id, 'name', e.target.value)}
                />
              ) : (
                <ListItemText primary={category.name} />
              )}
              <MuiColorInput 
                value={category.color} 
                onChange={(color) => handleValueChange(category.id, 'color', color)} 
                format="hex"
              />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
}