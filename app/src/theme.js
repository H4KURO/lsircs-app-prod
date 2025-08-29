// app/src/theme.js

import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    // モードを'dark'にすると全体的に暗い背景になりますが、今回は'light'のまま
    // 各色をカスタマイズします
    mode: 'light',

    primary: {
      // メインカラー（ボタンなどに使われる）
      main: '#3F51B5', // 落ち着いたインディゴ
    },
    secondary: {
      // アクセントカラー
      main: '#FFC107', // 高級感のあるアンバー
    },
    background: {
      // ページ全体の背景色
      default: '#f4f6f8', // 明るく清潔感のあるグレー
      // カードなどの背景色
      paper: '#ffffff',
    },
    text: {
      // 基本の文字色
      primary: '#333333',
      // やや薄い文字色
      secondary: '#666666',
    },
    // ▼▼▼ ヘッダー用のカスタムカラーを追加 ▼▼▼
    header: {
      main: '#192a56', // 濃いネイビー
      contrastText: '#ffffff', // ネイビーに対する文字色（白）
    },
  },
});

export default theme;