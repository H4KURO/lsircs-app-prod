// app/src/theme.js

import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      // LIST Sotheby's コーポレートカラー PANTONE 289 / RGB(0,35,73)
      main: '#002349',
      light: '#1A3D6B',
      dark: '#001528',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#B87020',
      contrastText: '#ffffff',
    },
    background: {
      default: '#F0F4F8',
      paper: '#ffffff',
    },
    text: {
      primary: '#041220',
      secondary: '#3A5670',
    },
    header: {
      main: '#002349',
      contrastText: '#ffffff',
    },
  },
  components: {
    MuiChip: {
      styleOverrides: {
        colorPrimary: { backgroundColor: '#002349', color: '#fff' },
      },
    },
  },
});

export default theme;