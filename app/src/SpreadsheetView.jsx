// app/src/SpreadsheetView.jsx
import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Button,
  Typography,
  CircularProgress,
  Toolbar,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Alert,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

// ── デフォルトのシート定義 ─────────────────────────────
const DEFAULT_SHEETS = [
  {
    id: 'box-buyers-list',
    label: 'Buyers List (Box)',
    embedUrl: 'https://app.box.com/embed/s/fkanyws37r8ouw14k310ocqs9rnm5c1g',
    externalUrl: 'https://app.box.com/s/fkanyws37r8ouw14k310ocqs9rnm5c1g',
    allowFullscreen: true,
  },
  {
    id: 'google-sheets-1',
    label: 'Google Sheets',
    embedUrl:
      'https://docs.google.com/spreadsheets/d/1Zi8osWNTOZcT0LGx-bPLyWoaqDi8_ZPml8TgHUs0DJI/pubhtml?gid=1407916266&single=true&widget=true&headers=false',
    externalUrl:
      'https://docs.google.com/spreadsheets/d/1Zi8osWNTOZcT0LGx-bPLyWoaqDi8_ZPml8TgHUs0DJI/edit?usp=sharing',
    allowFullscreen: false,
  },
];

const STORAGE_KEY = 'spreadsheet_sheets_v1';

// ── URL 自動変換（Google Sheets / Box 対応）─────────────
function guessEmbedUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    // Google Sheets: edit URL → pubhtml
    const gsMatch = u.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
    if (u.hostname === 'docs.google.com' && gsMatch) {
      const gidMatch = u.hash.match(/gid=(\d+)/);
      const gid = gidMatch ? gidMatch[1] : (new URLSearchParams(u.search).get('gid') || '');
      const pubBase = `https://docs.google.com/spreadsheets/d/${gsMatch[1]}/pubhtml`;
      return gid ? `${pubBase}?gid=${gid}&single=true&widget=true&headers=false` : pubBase;
    }
    // Box: shared link → embed URL
    const boxMatch = u.pathname.match(/^\/s\/(.+)/);
    if ((u.hostname === 'app.box.com' || u.hostname === 'box.com') && boxMatch) {
      return `https://app.box.com/embed/s/${boxMatch[1]}`;
    }
    return url;
  } catch {
    return url;
  }
}

function isFullscreenAllowed(url) {
  try {
    const u = new URL(url);
    return u.hostname === 'app.box.com' || u.hostname === 'box.com';
  } catch {
    return false;
  }
}

function generateId() {
  return `sheet-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── iframeパネル ─────────────────────────────────────────
function SheetPanel({ sheet }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const handleReload = () => {
    setIsLoaded(false);
    setIframeKey((k) => k + 1);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <Toolbar
        variant="dense"
        sx={{
          backgroundColor: 'grey.50',
          borderBottom: '1px solid',
          borderColor: 'divider',
          minHeight: 48,
          px: 2,
          gap: 1,
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1, fontSize: '0.78rem' }}>
          {sheet.embedUrl}
        </Typography>
        <Tooltip title="再読み込み">
          <Button size="small" startIcon={<RefreshIcon />} onClick={handleReload}>
            再読み込み
          </Button>
        </Tooltip>
        <Button
          size="small"
          variant="outlined"
          startIcon={<OpenInNewIcon />}
          href={sheet.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          外部アプリで開く
        </Button>
      </Toolbar>

      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: 'calc(100vh - 264px)',
          minHeight: 400,
          backgroundColor: 'grey.100',
        }}
      >
        {!isLoaded && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              zIndex: 1,
              backgroundColor: 'grey.100',
            }}
          >
            <CircularProgress size={40} />
            <Typography variant="body2" color="text.secondary">
              読み込み中...
            </Typography>
          </Box>
        )}
        <iframe
          key={iframeKey}
          src={sheet.embedUrl}
          title={sheet.label}
          width="100%"
          height="100%"
          style={{
            border: 'none',
            display: 'block',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
          allow={sheet.allowFullscreen ? 'fullscreen' : undefined}
          allowFullScreen={sheet.allowFullscreen}
          onLoad={() => setIsLoaded(true)}
        />
      </Box>
    </Box>
  );
}

// ── シート追加/編集ダイアログ ────────────────────────────
function SheetFormDialog({ open, onClose, onSave, initial }) {
  const [label, setLabel] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [embedAutoFilled, setEmbedAutoFilled] = useState(false);

  useEffect(() => {
    if (open) {
      setLabel(initial?.label ?? '');
      setExternalUrl(initial?.externalUrl ?? '');
      setEmbedUrl(initial?.embedUrl ?? '');
      setEmbedAutoFilled(false);
    }
  }, [open, initial]);

  const handleExternalUrlChange = (val) => {
    setExternalUrl(val);
    const guessed = guessEmbedUrl(val);
    if (guessed !== val || !embedUrl) {
      setEmbedUrl(guessed);
      setEmbedAutoFilled(true);
    }
  };

  const handleSave = () => {
    if (!label.trim() || !externalUrl.trim()) return;
    onSave({
      id: initial?.id ?? generateId(),
      label: label.trim(),
      externalUrl: externalUrl.trim(),
      embedUrl: (embedUrl.trim() || externalUrl.trim()),
      allowFullscreen: isFullscreenAllowed(externalUrl.trim()),
    });
    onClose();
  };

  const isValid = label.trim() && externalUrl.trim();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initial ? 'シートを編集' : '新しいシートを追加'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="表示名"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            fullWidth
            required
            placeholder="例: 物件管理リスト"
          />
          <TextField
            label="共有URL（外部リンク）"
            value={externalUrl}
            onChange={(e) => handleExternalUrlChange(e.target.value)}
            fullWidth
            required
            placeholder="例: https://docs.google.com/spreadsheets/d/.../edit?usp=sharing"
            helperText="Google SheetsまたはBoxの共有URLを貼り付けると埋め込みURLが自動生成されます"
          />
          <TextField
            label="埋め込みURL（iframe src）"
            value={embedUrl}
            onChange={(e) => { setEmbedUrl(e.target.value); setEmbedAutoFilled(false); }}
            fullWidth
            placeholder="自動生成されます"
            helperText={
              embedAutoFilled
                ? '✓ 共有URLから自動生成されました（必要に応じて手動修正も可能です）'
                : 'iframeに表示するURLです。通常は自動入力されます。'
            }
            FormHelperTextProps={{ sx: { color: embedAutoFilled ? 'success.main' : undefined } }}
          />
          <Alert severity="info" sx={{ fontSize: '0.78rem' }}>
            <strong>Google Sheets</strong>: 「ファイル → 共有 → ウェブに公開」で公開したシートのみ埋め込み可能です。<br />
            <strong>Box</strong>: 「共有リンクを作成」し、リンクを知っている人が閲覧可能に設定してください。
          </Alert>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={handleSave} variant="contained" disabled={!isValid}>
          {initial ? '保存' : '追加'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── シート管理ダイアログ ─────────────────────────────────
function SheetManagerDialog({ open, onClose, sheets, onAdd, onEdit, onDelete }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingSheet, setEditingSheet] = useState(null);

  const handleAdd = () => {
    setEditingSheet(null);
    setFormOpen(true);
  };

  const handleEdit = (sheet) => {
    setEditingSheet(sheet);
    setFormOpen(true);
  };

  const handleSave = (sheet) => {
    if (editingSheet) {
      onEdit(sheet);
    } else {
      onAdd(sheet);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>スプレッドシートを管理</DialogTitle>
        <DialogContent>
          {sheets.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              シートが登録されていません
            </Typography>
          ) : (
            <List disablePadding>
              {sheets.map((sheet) => (
                <ListItem
                  key={sheet.id}
                  divider
                  sx={{ pl: 0 }}
                >
                  <DragIndicatorIcon sx={{ color: 'text.disabled', mr: 1, fontSize: '1.2rem' }} />
                  <ListItemText
                    primary={sheet.label}
                    secondary={sheet.externalUrl}
                    secondaryTypographyProps={{ sx: { fontSize: '0.72rem', noWrap: true } }}
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="編集">
                      <IconButton size="small" onClick={() => handleEdit(sheet)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="削除">
                      <IconButton
                        size="small"
                        onClick={() => onDelete(sheet.id)}
                        sx={{ color: 'error.main' }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between' }}>
          <Button startIcon={<AddIcon />} onClick={handleAdd} variant="outlined">
            シートを追加
          </Button>
          <Button onClick={onClose}>閉じる</Button>
        </DialogActions>
      </Dialog>

      <SheetFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        initial={editingSheet}
      />
    </>
  );
}

// ── メインコンポーネント ─────────────────────────────────
export function SpreadsheetView() {
  const [sheets, setSheets] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_SHEETS;
  });

  const [activeTab, setActiveTab] = useState(0);
  const [managerOpen, setManagerOpen] = useState(false);

  // sheets が変わったら localStorage に保存
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sheets));
    } catch {
      // ignore
    }
  }, [sheets]);

  // タブ番号をシート数の範囲内に収める
  useEffect(() => {
    if (activeTab >= sheets.length && sheets.length > 0) {
      setActiveTab(sheets.length - 1);
    }
  }, [sheets, activeTab]);

  const handleAdd = (sheet) => setSheets((prev) => [...prev, sheet]);
  const handleEdit = (sheet) =>
    setSheets((prev) => prev.map((s) => (s.id === sheet.id ? sheet : s)));
  const handleDelete = (id) =>
    setSheets((prev) => prev.filter((s) => s.id !== id));

  if (sheets.length === 0) {
    return (
      <Box sx={{ mt: 2 }}>
        <Paper elevation={2} sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            表示するスプレッドシートが登録されていません
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setManagerOpen(true)}>
            シートを追加する
          </Button>
        </Paper>
        <SheetManagerDialog
          open={managerOpen}
          onClose={() => setManagerOpen(false)}
          sheets={sheets}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Paper elevation={2} sx={{ overflow: 'hidden' }}>
        {/* タブバー + 管理ボタン */}
        <Box
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Tabs
            value={Math.min(activeTab, sheets.length - 1)}
            onChange={(_, v) => setActiveTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ flexGrow: 1 }}
          >
            {sheets.map((sheet, i) => (
              <Tab key={sheet.id} label={sheet.label} id={`sheet-tab-${i}`} />
            ))}
          </Tabs>
          <Tooltip title="シートを管理（追加・編集・削除）">
            <IconButton
              onClick={() => setManagerOpen(true)}
              sx={{ mx: 1, color: 'text.secondary' }}
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* アクティブなシートのパネル */}
        {sheets.map((sheet, i) =>
          activeTab === i ? <SheetPanel key={sheet.id} sheet={sheet} /> : null
        )}
      </Paper>

      <SheetManagerDialog
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        sheets={sheets}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </Box>
  );
}

export default SpreadsheetView;
