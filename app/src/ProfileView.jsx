// app/src/ProfileView.jsx

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Typography, Paper, TextField, Button, CircularProgress, Divider, Alert, Chip } from '@mui/material';

const API_URL = '/api';

export function ProfileView() {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [slackOauthStatus, setSlackOauthStatus] = useState(null);
  const [manualSlackId, setManualSlackId] = useState('');
  const [slackIdSaving, setSlackIdSaving] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthResult = params.get('slack_oauth');
    if (oauthResult) {
      setSlackOauthStatus(oauthResult);
      const url = new URL(window.location.href);
      url.searchParams.delete('slack_oauth');
      window.history.replaceState({}, '', url.toString());
    }

    axios.get(`${API_URL}/GetUserProfile`)
      .then(res => {
        setProfile(res.data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch profile', err);
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

  const handleSlackIdSave = () => {
    const id = manualSlackId.trim();
    if (!id) return;
    setSlackIdSaving(true);
    axios.put(`${API_URL}/UpdateUserProfile`, { displayName: profile.displayName, slackMemberId: id })
      .then(res => {
        setProfile(res.data);
        setManualSlackId('');
      })
      .catch(err => {
        console.error('Failed to save Slack Member ID', err);
        alert('エラー：保存に失敗しました。');
      })
      .finally(() => setSlackIdSaving(false));
  };

  const handleSlackUnlink = () => {
    if (!window.confirm('Slack連携を解除しますか？')) return;
    axios.put(`${API_URL}/UpdateUserProfile`, { displayName: profile.displayName, unlinkSlack: true })
      .then(res => {
        setProfile(res.data);
        setSlackOauthStatus(null);
      })
      .catch(err => {
        console.error('Failed to unlink Slack', err);
        alert('エラー：連携解除に失敗しました。');
      });
  };

  if (isLoading) return <CircularProgress />;
  if (!profile) return <Typography>プロファイル情報を読み込めませんでした。</Typography>;

  const isSlackLinked = Boolean(profile.slackMemberId);

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        プロフィール設定
      </Typography>

      {slackOauthStatus === 'success' && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSlackOauthStatus(null)}>
          Slackアカウントを連携しました。コメントでメンションされるとSlackに通知が届きます。
        </Alert>
      )}
      {slackOauthStatus === 'error' && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSlackOauthStatus(null)}>
          Slack連携に失敗しました。もう一度お試しください。
        </Alert>
      )}
      {slackOauthStatus === 'cancelled' && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setSlackOauthStatus(null)}>
          Slack連携をキャンセルしました。
        </Alert>
      )}

      <Paper sx={{ p: 2, maxWidth: 600 }}>
        <Typography variant="subtitle1">ログイン情報</Typography>
        <TextField
          label="ログインID"
          value={profile.userDetails}
          fullWidth
          margin="normal"
          disabled
        />

        <Typography variant="subtitle1" sx={{ mt: 2 }}>担当者名（表示名）</Typography>
        <TextField
          label="担当者として表示される名前"
          value={profile.displayName || ''}
          onChange={handleDisplayNameChange}
          fullWidth
          margin="normal"
        />
        <Button variant="contained" onClick={handleSave} sx={{ mt: 1 }}>
          保存
        </Button>

        <Divider sx={{ my: 3 }} />

        <Typography variant="subtitle1" gutterBottom>Slack連携</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          連携すると、コメントで@メンションされたときにSlackに個人宛の通知が届きます。
        </Typography>

        {isSlackLinked ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              label={`連携済み（${profile.slackMemberId}）`}
              color="success"
              variant="outlined"
            />
            <Button variant="outlined" color="error" size="small" onClick={handleSlackUnlink}>
              連携解除
            </Button>
          </Box>
        ) : (
          <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>
              SlackメンバーIDを入力して連携できます。
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              確認方法：Slackでプロフィールを開く → 「...」メニュー → 「メンバーIDをコピー」（例：U0AB12CDE）
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                label="Slack メンバーID"
                placeholder="U0AB12CDE"
                value={manualSlackId}
                onChange={(e) => setManualSlackId(e.target.value)}
                size="small"
                sx={{ flexGrow: 1 }}
              />
              <Button
                variant="contained"
                onClick={handleSlackIdSave}
                disabled={!manualSlackId.trim() || slackIdSaving}
                sx={{ mt: 0.5 }}
              >
                保存
              </Button>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
