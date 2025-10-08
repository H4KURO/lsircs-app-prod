// app/src/main.jsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import './i18n';

// ▼▼▼ MUIのテーマ関連の機能をインポート ▼▼▼
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme'; // 作成したテーマファイルをインポート

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* ▼▼▼ アプリ全体をThemeProviderで囲む ▼▼▼ */}
    <ThemeProvider theme={theme}>
      {/* CssBaselineはブラウザ間の表示差異をなくすためのもの */}
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
