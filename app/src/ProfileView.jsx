// app/src/ProfileView.jsx

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Typography, Paper, TextField, Button, CircularProgress, Divider, Alert, Chip } from '@mui/material';

const API_URL = '/api';

export function ProfileView() {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [slackOauthStatus, setSlackOauthStatus] = useState(null); // 'success' | 'error' | 'cancelled'

  useEffect(() => {
    // URLパラメータでOAuth結果を確認
    const params = new URLSearchParams(window.location.search);
    const oauthResult = params.get('slack_oauth');
    if (oauthResult) {
      setSlackOauthStatus(oauthResult);
      // URLからパラメータを除去
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

  const handleSlackLink = () => {
    window.location.href = `${API_URL}/SlackOAuthStart`;
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
          連携すると、コメントで@メンションされたときにSlackのDMや通知チャンネルに個人宛の通知が届きます。
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
          <Button
            variant="outlined"
            onClick={handleSlackLink}
            startIcon={
              <Box component="img"
                src="https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png"
                sx={{ width: 18, height: 18 }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            }
          >
            Slackアカウントと連携する
          </Button>
        )}
      </Paper>
    </Box>
  );
}
