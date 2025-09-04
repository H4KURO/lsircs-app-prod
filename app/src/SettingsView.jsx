// app/src/SettingsView.jsx

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Typography, Paper, List, ListItem, ListItemText, Button } from '@mui/material';
import { MuiColorInput } from 'mui-color-input'; // 新しいライブラリをインポート

const API_URL = '/api';

export function SettingsView() {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    // カテゴリのデータを取得し、初期色がなければデフォルト色を設定
    axios.get(`${API_URL}/GetCategories`).then(res => {
      const categoriesWithDefaults = res.data.map(cat => ({
        ...cat,
        color: cat.color || '#cccccc' // 色が未設定ならグレー
      }));
      setCategories(categoriesWithDefaults);
    });
  }, []);

  const handleColorChange = (id, newColor) => {
    setCategories(categories.map(cat => 
      cat.id === id ? { ...cat, color: newColor } : cat
    ));
  };

  const handleSave = (categoryToSave) => {
    // データベースに保存する前に、カテゴリが存在するか確認
    if (!categoryToSave || !categoryToSave.id) {
      alert('エラー: カテゴリ情報が正しくありません。');
      return;
    }
    axios.put(`/api/UpdateCategory/${categoryToSave.id}`, { color: categoryToSave.color })
      .then(() => alert(`「${categoryToSave.name}」の色を保存しました！`))
      .catch(() => alert('エラー：保存に失敗しました。'));
  };
  
  // 新しいカテゴリがタスクで作成された際に、この設定画面に自動で追加するロジック
  const syncCategories = async () => {
    try {
      const [tasksRes, categoriesRes] = await Promise.all([
        axios.get(`${API_URL}/GetTasks`),
        axios.get(`${API_URL}/GetCategories`)
      ]);
      
      const taskCategories = [...new Set(tasksRes.data.map(t => t.category).filter(Boolean))];
      const existingCategories = categoriesRes.data.map(c => c.name);
      
      const newCategories = taskCategories.filter(tc => !existingCategories.includes(tc));

      if (newCategories.length > 0) {
        // 新しいカテゴリをデータベースに追加するAPIを呼び出す
        await axios.post(`${API_URL}/CreateCategories`, { categories: newCategories });
        // 最新のカテゴリリストを再取得
        const updatedCategoriesRes = await axios.get(`${API_URL}/GetCategories`);
        setCategories(updatedCategoriesRes.data.map(cat => ({...cat, color: cat.color || '#cccccc' })));
        alert('新しいカテゴリを同期しました！');
      } else {
        alert('新しいカテゴリはありません。');
      }
    } catch (error) {
      alert('カテゴリの同期中にエラーが発生しました。');
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        設定
      </Typography>
      <Paper sx={{ p: 2 }}>
        <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <Typography variant="h6" gutterBottom>カテゴリーの色設定</Typography>
            <Button onClick={syncCategories}>タスクとカテゴリを同期</Button>
        </Box>
        <List>
          {categories.map(category => (
            <ListItem key={category.id} secondaryAction={
              <Button variant="outlined" size="small" onClick={() => handleSave(category)}>保存</Button>
            }>
              <ListItemText primary={category.name} />
              <MuiColorInput 
                value={category.color} 
                onChange={(color) => handleColorChange(category.id, color)} 
                format="hex"
              />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
}