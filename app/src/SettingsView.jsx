// app/src/SettingsView.jsx

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Typography, Paper, List, ListItem, ListItemText, Button } from '@mui/material';
import { MuiColorInput } from 'mui-color-picker';

const API_URL = '/api';

export function SettingsView() {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    axios.get(`${API_URL}/GetCategories`).then(res => setCategories(res.data));
  }, []);

  const handleColorChange = (id, newColor) => {
    setCategories(categories.map(cat => 
      cat.id === id ? { ...cat, color: newColor } : cat
    ));
  };

  const handleSave = (categoryToSave) => {
    axios.put(`${API_URL}/UpdateCategory/${categoryToSave.id}`, { color: categoryToSave.color })
      .then(() => alert('保存しました！'))
      .catch(() => alert('エラー：保存に失敗しました。'));
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        設定
      </Typography>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>カテゴリーの色設定</Typography>
        <List>
          {categories.map(category => (
            <ListItem key={category.id} secondaryAction={
              <Button variant="contained" onClick={() => handleSave(category)}>保存</Button>
            }>
              <ListItemText primary={category.name} />
              <MuiColorInput 
                value={category.color || '#ffffff'} 
                onChange={(newColor) => handleColorChange(category.id, newColor)} 
              />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
}