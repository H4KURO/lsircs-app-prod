import { useState } from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
  CircularProgress,
  Alert,
  Divider,
  Chip,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

const API_URL = '/api';

export function EmailImportModal({ open, onClose, onParsed }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleClose = () => {
    setSubject('');
    setBody('');
    setError('');
    setResult(null);
    onClose();
  };

  const handleParse = async () => {
    if (!subject.trim() && !body.trim()) {
      setError('件名または本文を入力してください。');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const { data } = await axios.post(`${API_URL}/ParseEmailToTask`, { subject, body });
      setResult(data);
    } catch (err) {
      const msg = err.response?.data || err.message || 'エラーが発生しました。';
      setError(typeof msg === 'string' ? msg : 'エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = () => {
    if (!result) return;
    onParsed({
      title: result.title,
      description: result.description,
      tags: result.tags ?? ['PM案件'],
    });
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <EmailIcon />
        メールからタスクを作成
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="件名（Subject）"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            fullWidth
            placeholder="Re: Repair Request - Unit 101"
          />
          <TextField
            label="本文（Body）"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            fullWidth
            multiline
            minRows={6}
            placeholder="ハワイからのメール本文をここに貼り付けてください..."
          />

          {error && <Alert severity="error">{error}</Alert>}

          {result && (
            <>
              <Divider />
              <Typography variant="subtitle2" color="text.secondary">
                解析結果（確認・修正後にタスクを作成してください）
              </Typography>
              <Alert severity="success" sx={{ py: 0.5 }}>
                AIによる翻訳・解析が完了しました
              </Alert>
              <Stack spacing={1.5}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">タイトル</Typography>
                  <Typography variant="body1" fontWeight="medium">{result.title}</Typography>
                </Stack>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">説明</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{result.description}</Typography>
                </Stack>
                {result.originalSummary && (
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">オーナー報告用メモ</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                      {result.originalSummary}
                    </Typography>
                  </Stack>
                )}
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary">自動付与タグ:</Typography>
                  {(result.tags ?? ['PM案件']).map((tag) => (
                    <Chip key={tag} label={tag} size="small" color="primary" variant="outlined" />
                  ))}
                </Stack>
              </Stack>
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={handleClose} disabled={loading}>
          キャンセル
        </Button>
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={16} /> : <AutoFixHighIcon />}
          onClick={handleParse}
          disabled={loading}
        >
          {loading ? '解析中...' : 'AIで解析'}
        </Button>
        {result && (
          <Button variant="contained" onClick={handleCreateTask}>
            タスクを作成
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
