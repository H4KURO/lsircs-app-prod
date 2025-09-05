// app/src/App.jsx

import { useState, useEffect } from 'react';
import { TaskView } from './TaskView';
import { CustomerView } from './CustomerView';
import { InvoiceView } from './InvoiceView';
import { DashboardView } from './DashboardView';
import './App.css';
import { Box, AppBar, Toolbar, IconButton, Typography, Drawer, List, ListItem, ListItemButton, ListItemText, Divider, Chip, ListItemIcon } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import GoogleIcon from '@mui/icons-material/Google';
import MicrosoftIcon from '@mui/icons-material/Microsoft';
import LogoutIcon from '@mui/icons-material/Logout';
import { SettingsView } from './SettingsView';
import SettingsIcon from '@mui/icons-material/Settings';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { ProfileView } from './ProfileView';


function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/.auth/me');
        const data = await res.json();
        setUser(data.clientPrincipal);
      } catch (error) {
        console.error('No user logged in');
      }
    }
    fetchUser();
  }, []);

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const menuItems = [
    { text: 'ダッシュボード', view: 'dashboard' },
    { text: 'タスク管理', view: 'tasks' },
    { text: '顧客管理', view: 'customers' },
    { text: '請求書管理', view: 'invoices' },
    { text: '設定', view: 'settings', icon: <SettingsIcon /> },
  ];

  const loginMenu = (
    <Box sx={{ p: 2, textAlign: 'center' }}>
      <Typography variant="subtitle2" sx={{ mb: 2 }}>ログインしてください</Typography>
      <List>
        <ListItem disablePadding>
          <ListItemButton component="a" href="/.auth/login/google">
            <ListItemIcon><GoogleIcon /></ListItemIcon>
            <ListItemText primary="Googleでログイン" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton component="a" href="/.auth/login/aad">
            <ListItemIcon><MicrosoftIcon /></ListItemIcon>
            <ListItemText primary="Microsoftでログイン" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );


  const userMenu = (
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
      <Divider />
      <List>
        {/* ▼▼▼ プロフィール設定へのリンクを追加 ▼▼▼ */}
        <ListItem disablePadding>
          <ListItemButton onClick={() => { setCurrentView('profile'); setDrawerOpen(false); }}>
            <ListItemIcon><AccountCircleIcon /></ListItemIcon>
            <ListItemText primary="プロフィール設定" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton component="a" href="/.auth/logout">
            <ListItemIcon><LogoutIcon /></ListItemIcon>
            <ListItemText primary="ログアウト" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar component="header" position="fixed" sx={{ backgroundColor: 'header.main' }}>
        <Toolbar>
          <IconButton color="inherit" aria-label="open drawer" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2 }} >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            LSIRCS アプリ
          </Typography>
          {user && <Chip label={user.userDetails} color="info" />}
        </Toolbar>
      </AppBar>

      <Drawer variant="temporary" open={drawerOpen} onClose={handleDrawerToggle} sx={{ '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240 } }} >
        <Toolbar />
        {user ? userMenu : loginMenu}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        {!user && <Typography>ようこそ！メニューからログインしてください。</Typography>}
        
        {user && currentView === 'dashboard' && <DashboardView user={user} />}
        {user && currentView === 'tasks' && <TaskView />}
        {user && currentView === 'customers' && <CustomerView />}
        {user && currentView === 'invoices' && <InvoiceView />}
        {user && currentView === 'profile' && <ProfileView />} {/* ★★★ プロフィール画面の表示を追加 ★★★ */}
      </Box>
    </Box>
  );
}

export default App;