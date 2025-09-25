// app/src/ProfileView.jsx

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Typography, Paper, TextField, Button, CircularProgress } from '@mui/material';

const API_URL = '/api';

export function ProfileView() {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // ログイン中のユーザーのプロフィールを取得
    axios.get(`${API_URL}/GetUserProfile`)
      .then(res => {
        setProfile(res.data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch profile", err);
        setIsLoading(false);
      });
  }, []);

  const handleDisplayNameChange = (event) => {
    setProfile({ ...profile, displayName: event.target.value });
  };

  const handleSave = () => {
    axios.put(`${API_URL}/UpdateUserProfile`, { displayName: profile.displayName })
      .then(res => {
        setProfile(res.data);
        alert('プロフィールを更新しました。');
      })
      .catch(err => {
        console.error('Failed to update profile', err);
        alert('エラー：更新に失敗しました。');
      });
  };

  if (isLoading) {
    return <CircularProgress />;
  }

  if (!profile) {
    return <Typography>プロファイル情報を読み込めませんでした。</Typography>;
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        プロフィール設定
      </Typography>
      <Paper sx={{ p: 2, maxWidth: 600 }}>
        <Typography variant="subtitle1">ログイン情報</Typography>
        <TextField
          label="ログインID"
          value={profile.userDetails}
          fullWidth
          margin="normal"
          disabled // 編集不可
        />
        <Typography variant="subtitle1" sx={{ mt: 2 }}>担当者名（表示名）</Typography>
        <TextField
          label="担当者として表示される名前"
          value={profile.displayName || ''}
          onChange={handleDisplayNameChange}
          fullWidth
          margin="normal"
        />
        <Button variant="contained" onClick={handleSave} sx={{ mt: 2 }}>
          保存
        </Button>
      </Paper>
    </Box>
  );
}
