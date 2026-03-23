// app/src/SpreadsheetView.jsx
import { useState } from 'react';
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
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';

const SHEETS = [
  {
    label: 'Buyers List (Box)',
    embedUrl: 'https://app.box.com/embed/s/fkanyws37r8ouw14k310ocqs9rnm5c1g',
    externalUrl: 'https://app.box.com/s/fkanyws37r8ouw14k310ocqs9rnm5c1g',
    allowFullscreen: true,
    description: 'TPWV_Buyers_List.xlsx (Box)',
  },
  {
    label: 'Google Sheets',
    embedUrl:
      'https://docs.google.com/spreadsheets/d/1Zi8osWNTOZcT0LGx-bPLyWoaqDi8_ZPml8TgHUs0DJI/pubhtml?gid=1407916266&single=true&widget=true&headers=false',
    externalUrl:
      'https://docs.google.com/spreadsheets/d/1Zi8osWNTOZcT0LGx-bPLyWoaqDi8_ZPml8TgHUs0DJI/edit?gid=1407916266#gid=1407916266',
    allowFullscreen: false,
    description: 'Google スプレッドシート',
  },
];

function SheetPanel({ sheet }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const handleReload = () => {
    setIsLoaded(false);
    setIframeKey((k) => k + 1);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* ヘッダーバー */}
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
        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
          {sheet.description}
        </Typography>
        <Tooltip title="再読み込み">
          <Button
            size="small"
            startIcon={<RefreshIcon />}
            onClick={handleReload}
            sx={{ minWidth: 'auto' }}
          >
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

      {/* iframe エリア */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: 'calc(100vh - 260px)',
          minHeight: 400,
          backgroundColor: 'grey.100',
        }}
      >
        {/* ローディングスピナー */}
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

export function SpreadsheetView() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box sx={{ mt: 2 }}>
      <Paper elevation={2} sx={{ overflow: 'hidden' }}>
        {/* タブバー */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            aria-label="スプレッドシートタブ"
          >
            {SHEETS.map((sheet, index) => (
              <Tab key={index} label={sheet.label} />
            ))}
          </Tabs>
        </Box>

        {/* タブコンテンツ */}
        {SHEETS.map((sheet, index) =>
          activeTab === index ? (
            <SheetPanel key={index} sheet={sheet} />
          ) : null
        )}
      </Paper>
    </Box>
  );
}

export default SpreadsheetView;
