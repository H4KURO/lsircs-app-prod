// app/src/App.jsx

import { useState } from 'react';
import { TaskView } from './TaskView';
import { CustomerView } from './CustomerView';
import { InvoiceView } from './InvoiceView';
import { DashboardView } from './DashboardView'; // DashboardViewをインポート
import './App.css';
import { Box, AppBar, Toolbar, IconButton, Typography, Drawer, List, ListItem, ListItemButton, ListItemText } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';

function App() {
  const [currentView, setCurrentView] = useState('dashboard'); // 初期表示を'dashboard'に変更
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  // メニュー項目にダッシュボードを追加
  const menuItems = [
    { text: 'ダッシュボード', view: 'dashboard' },
    { text: 'タスク管理', view: 'tasks' },
    { text: '顧客管理', view: 'customers' },
    { text: '請求書管理', view: 'invoices' }
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar component="header" position="fixed" sx={{ backgroundColor: 'header.main' }}>
        <Toolbar>
          <IconButton color="inherit" aria-label="open drawer" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2 }} >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            LSIRCS アプリ
          </Typography>
        </Toolbar>
      </AppBar>

      <Drawer variant="temporary" open={drawerOpen} onClose={handleDrawerToggle} ModalProps={{ keepMounted: true }} sx={{ '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240 } }} >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {menuItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton onClick={() => { setCurrentView(item.view); setDrawerOpen(false); }}>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        {/* currentViewに応じて表示するコンポーネントを切り替え */}
        {currentView === 'dashboard' && <DashboardView />}
        {currentView === 'tasks' && <TaskView />}
        {currentView === 'customers' && <CustomerView />}
        {currentView === 'invoices' && <InvoiceView />}
      </Box>
    </Box>
  );
}

export default App;