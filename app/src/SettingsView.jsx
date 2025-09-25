// app/src/SettingsView.jsx

import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  Button,
  Stack,
  TextField,
} from '@mui/material';
import { MuiColorInput } from 'mui-color-input';

const API_URL = '/api';

function normaliseHex(value) {
  if (!value) {
    return '';
  }
  const trimmed = value.trim();
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

export function SettingsView() {
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState({ name: '', color: '#1976d2' });
  const [savingId, setSavingId] = useState(null);
  const [isAdding, setIsAdding] = useState(false);

  const loadCategories = async () => {
    const res = await axios.get(`${API_URL}/GetCategories`);
    setCategories(res.data ?? []);
  };

  useEffect(() => {
    loadCategories().catch(() => {
      alert('カテゴリーの取得に失敗しました。');
      setCategories([]);
    });
  }, []);

  const handleNameChange = (id, value) => {
    setCategories(prev => prev.map(cat => (cat.id === id ? { ...cat, name: value } : cat)));
  };

  const handleColorChange = (id, newColor) => {
    setCategories(prev =>
      prev.map(cat => (cat.id === id ? { ...cat, color: normaliseHex(newColor) } : cat)),
    );
  };

  const handleSave = async (categoryToSave) => {
    const name = categoryToSave.name?.trim();
    const color = normaliseHex(categoryToSave.color);

    if (!name || !color) {
      alert('カテゴリー名とカラーは必須です。');
      return;
    }

    try {
      setSavingId(categoryToSave.id);
      const { data } = await axios.put(`${API_URL}/UpdateCategory/${categoryToSave.id}`, {
        name,
        color,
      });
      setCategories(prev => prev.map(cat => (cat.id === data.id ? data : cat)));
      alert('保存しました！');
    } catch (error) {
      console.error(error);
      alert('エラー：保存に失敗しました。');
    } finally {
      setSavingId(null);
    }
  };

  const handleNewCategoryChange = (field, value) => {
    setNewCategory(prev => ({
      ...prev,
      [field]: field === 'color' ? normaliseHex(value) : value,
    }));
  };

  const handleAddCategory = async () => {
    const name = newCategory.name.trim();
    const color = normaliseHex(newCategory.color);

    if (!name || !color) {
      alert('カテゴリー名とカラーは必須です。');
      return;
    }

    try {
      setIsAdding(true);
      const { data } = await axios.post(`${API_URL}/AddCategory`, { name, color });
      setCategories(prev => [...prev, data]);
      setNewCategory({ name: '', color: '#1976d2' });
      alert('カテゴリーを追加しました！');
    } catch (error) {
      console.error(error);
      alert('エラー：追加に失敗しました。');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        設定
      </Typography>

      <Stack spacing={3}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            新規カテゴリーを追加
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <TextField
              label="カテゴリー名"
              value={newCategory.name}
              onChange={(event) => handleNewCategoryChange('name', event.target.value)}
              fullWidth
            />
            <MuiColorInput
              value={newCategory.color}
              onChange={(color) => handleNewCategoryChange('color', color)}
            />
            <Button variant="contained" onClick={handleAddCategory} disabled={isAdding}>
              追加
            </Button>
          </Stack>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            カテゴリーの編集
          </Typography>
          <List>
            {categories.map((category) => (
              <ListItem
                key={category.id}
                divider
                secondaryAction={
                  <Button
                    variant="contained"
                    onClick={() => handleSave(category)}
                    disabled={savingId === category.id}
                  >
                    保存
                  </Button>
                }
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  alignItems={{ sm: 'center' }}
                  sx={{ flexGrow: 1 }}
                >
                  <TextField
                    label="カテゴリー名"
                    value={category.name || ''}
                    onChange={(event) => handleNameChange(category.id, event.target.value)}
                    fullWidth
                  />
                  <MuiColorInput
                    value={category.color || '#ffffff'}
                    onChange={(color) => handleColorChange(category.id, color)}
                  />
                </Stack>
              </ListItem>
            ))}
          </List>
        </Paper>
      </Stack>
    </Box>
  );
}
