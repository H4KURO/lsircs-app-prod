// app/src/AssetChatTab.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Button,
  TextField,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';

const API_URL = '/api';
const POLL_INTERVAL_MS = 5000;

const EMPTY_THREAD_FORM = { title: '', relatedPropertyId: '' };

function formatTimestamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function AssetChatTab({ properties }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [threads, setThreads] = useState([]);
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [messages, setMessages] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [threadDialogOpen, setThreadDialogOpen] = useState(false);
  const [threadForm, setThreadForm] = useState(EMPTY_THREAD_FORM);
  const [threadSaveError, setThreadSaveError] = useState('');
  const [savingThread, setSavingThread] = useState(false);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    axios.get(`${API_URL}/GetUserProfile`)
      .then((res) => setCurrentUser(res.data))
      .catch(() => setCurrentUser(null));
  }, []);

  const fetchThreads = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/GetAssetChatThreads`);
      setThreads(res.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data || err.message || 'スレッド一覧の取得に失敗しました');
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  const fetchMessages = useCallback(async (threadId) => {
    if (!threadId) return;
    try {
      const res = await axios.get(`${API_URL}/GetAssetChatMessages`, { params: { threadId } });
      setMessages(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data || err.message || 'メッセージの取得に失敗しました');
    }
  }, []);

  // スレッド一覧のポーリング（追加インフラ不要のシンプルな方式。フェーズ3の技術方針どおり）
  useEffect(() => {
    fetchThreads();
    const timer = setInterval(fetchThreads, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchThreads]);

  // 選択中スレッドのメッセージポーリング
  useEffect(() => {
    if (!selectedThreadId) return undefined;
    setLoadingMessages(true);
    fetchMessages(selectedThreadId).finally(() => setLoadingMessages(false));
    const timer = setInterval(() => fetchMessages(selectedThreadId), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [selectedThreadId, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const selectedThread = threads.find((t) => t.id === selectedThreadId);
  const propertyName = (propertyId) => properties.find((p) => p.id === propertyId)?.name;

  const handleOpenNewThread = () => {
    setThreadForm(EMPTY_THREAD_FORM);
    setThreadSaveError('');
    setThreadDialogOpen(true);
  };

  const handleCreateThread = async () => {
    if (!threadForm.title.trim()) {
      setThreadSaveError('スレッド名は必須です');
      return;
    }
    setSavingThread(true);
    setThreadSaveError('');
    try {
      const res = await axios.post(`${API_URL}/CreateAssetChatThread`, {
        title: threadForm.title.trim(),
        relatedPropertyId: threadForm.relatedPropertyId || null,
      });
      setThreadDialogOpen(false);
      await fetchThreads();
      setSelectedThreadId(res.data.id);
    } catch (err) {
      setThreadSaveError(err.response?.data?.message || err.response?.data || err.message || 'スレッド作成に失敗しました');
    } finally {
      setSavingThread(false);
    }
  };

  const handleDeleteThread = async (thread) => {
    if (!window.confirm(`スレッド「${thread.title}」を削除しますか？（メッセージも全て削除されます）`)) return;
    try {
      await axios.post(`${API_URL}/DeleteAssetChatThread`, { id: thread.id });
      if (selectedThreadId === thread.id) setSelectedThreadId('');
      fetchThreads();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data || err.message || 'スレッド削除に失敗しました');
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedThreadId) return;
    setSending(true);
    try {
      await axios.post(`${API_URL}/CreateAssetChatMessage`, {
        threadId: selectedThreadId,
        body: newMessage.trim(),
        senderName: currentUser?.displayName || currentUser?.userDetails || '',
      });
      setNewMessage('');
      await fetchMessages(selectedThreadId);
      fetchThreads();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data || err.message || 'メッセージ送信に失敗しました');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (message) => {
    try {
      await axios.post(`${API_URL}/DeleteAssetChatMessage`, { id: message.id });
      fetchMessages(selectedThreadId);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data || err.message || 'メッセージ削除に失敗しました');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <Typography variant="h6" fontWeight={700}>社内チャット（フェーズ3・試験運用）</Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        社内スタッフ間の連絡用チャットです（オーナー・顧客向けチャットは今後のフェーズで別途対応予定）。数秒おきの自動更新方式のため、送受信にわずかな遅延があります。
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, height: 560 }}>
        <Paper elevation={2} sx={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>スレッド</Typography>
            <IconButton size="small" onClick={handleOpenNewThread} aria-label="新規スレッド">
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>
          {loadingThreads ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <List sx={{ overflowY: 'auto', flexGrow: 1 }} dense>
              {threads.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  スレッドがありません。「＋」から作成してください。
                </Typography>
              )}
              {threads.map((thread) => (
                <ListItemButton
                  key={thread.id}
                  selected={thread.id === selectedThreadId}
                  onClick={() => setSelectedThreadId(thread.id)}
                  sx={{ alignItems: 'flex-start' }}
                >
                  <ListItemText
                    primary={thread.title}
                    secondary={propertyName(thread.relatedPropertyId) || undefined}
                    primaryTypographyProps={{ fontWeight: 600, fontSize: '0.85rem' }}
                    secondaryTypographyProps={{ fontSize: '0.75rem' }}
                  />
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); handleDeleteThread(thread); }}
                    aria-label="スレッド削除"
                  >
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </ListItemButton>
              ))}
            </List>
          )}
        </Paper>

        <Paper elevation={2} sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {!selectedThread ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Typography color="text.secondary">スレッドを選択してください</Typography>
            </Box>
          ) : (
            <>
              <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle1" fontWeight={700}>{selectedThread.title}</Typography>
                {propertyName(selectedThread.relatedPropertyId) && (
                  <Chip size="small" label={propertyName(selectedThread.relatedPropertyId)} sx={{ mt: 0.5 }} />
                )}
              </Box>

              <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
                {loadingMessages ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : messages.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">まだメッセージがありません</Typography>
                ) : (
                  messages.map((message) => {
                    const isOwn = message.senderEmail === currentUser?.userDetails;
                    return (
                      <Box key={message.id} sx={{ mb: 1.5, display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                          <Typography variant="caption" color="text.secondary">
                            {message.senderName} ・ {formatTimestamp(message.createdAt)}
                          </Typography>
                          {isOwn && (
                            <IconButton size="small" onClick={() => handleDeleteMessage(message)} aria-label="削除">
                              <DeleteIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          )}
                        </Box>
                        <Box
                          sx={{
                            px: 1.5, py: 1, borderRadius: 2, maxWidth: '75%',
                            bgcolor: isOwn ? 'primary.main' : 'action.hover',
                            color: isOwn ? 'primary.contrastText' : 'text.primary',
                            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          }}
                        >
                          {message.body}
                        </Box>
                      </Box>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </Box>

              <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="メッセージを入力（Enterで送信）"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  multiline
                  maxRows={4}
                />
                <Button
                  variant="contained"
                  endIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                  onClick={handleSendMessage}
                  disabled={sending || !newMessage.trim()}
                >
                  送信
                </Button>
              </Box>
            </>
          )}
        </Paper>
      </Box>

      <Dialog open={threadDialogOpen} onClose={() => !savingThread && setThreadDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>新規スレッド作成</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {threadSaveError && <Alert severity="error">{threadSaveError}</Alert>}
            <TextField
              label="スレッド名"
              value={threadForm.title}
              onChange={(e) => setThreadForm((prev) => ({ ...prev, title: e.target.value }))}
              required
              fullWidth
              size="small"
            />
            <FormControl fullWidth size="small">
              <InputLabel>関連物件（任意）</InputLabel>
              <Select
                value={threadForm.relatedPropertyId}
                label="関連物件（任意）"
                onChange={(e) => setThreadForm((prev) => ({ ...prev, relatedPropertyId: e.target.value }))}
              >
                <MenuItem value="">なし</MenuItem>
                {properties.map((property) => (
                  <MenuItem key={property.id} value={property.id}>{property.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setThreadDialogOpen(false)} disabled={savingThread}>キャンセル</Button>
          <Button variant="contained" onClick={handleCreateThread} disabled={savingThread}>
            {savingThread ? <CircularProgress size={20} /> : '作成'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AssetChatTab;
