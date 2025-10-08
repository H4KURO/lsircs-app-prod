// app/src/App.jsx

import axios from "axios";
import { useState, useEffect } from "react";
import { TaskView } from "./TaskView";
import { CustomerView } from "./CustomerView";
import { InvoiceView } from "./InvoiceView";
import { DashboardView } from "./DashboardView";
import "./App.css";
import {
  Box,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  Chip,
  ListItemIcon,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import GoogleIcon from "@mui/icons-material/Google";
import MicrosoftIcon from "@mui/icons-material/Microsoft";
import LogoutIcon from "@mui/icons-material/Logout";
import { SettingsView } from "./SettingsView";
import SettingsIcon from "@mui/icons-material/Settings";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { ProfileView } from "./ProfileView";

const ALLOWED_VIEWS = new Set(["dashboard", "tasks", "customers", "invoices", "settings", "profile"]);

const parseInitialLocation = () => {
  if (typeof window === "undefined") {
    return { view: "dashboard", taskId: null };
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const rawView = params.get("view");
    const taskId = params.get("taskId");
    const normalizedView = rawView && ALLOWED_VIEWS.has(rawView) ? rawView : "dashboard";
    const effectiveView = taskId ? "tasks" : normalizedView;

    return {
      view: effectiveView,
      taskId: taskId || null,
    };
  } catch (error) {
    console.warn("Failed to parse initial query params", error);
    return { view: "dashboard", taskId: null };
  }
};

const syncLocation = (view, taskId) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const params = new URLSearchParams();
    if (view && view !== "dashboard") {
      params.set("view", view);
    }
    if (taskId) {
      params.set("taskId", taskId);
    }

    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, "", nextUrl);
  } catch (error) {
    console.warn("Failed to sync query params", error);
  }
};

const API_URL = "/api";

function App() {
  const initialLocation = parseInitialLocation();
  const [currentView, setCurrentView] = useState(initialLocation.view);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [deepLinkTaskId, setDeepLinkTaskId] = useState(initialLocation.taskId);
  useEffect(() => {
    const taskIdForSync = currentView === "tasks" ? deepLinkTaskId : null;
    syncLocation(currentView, taskIdForSync);
  }, [currentView, deepLinkTaskId]);


  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch("/.auth/me");
        const data = await res.json();
        setUser(data.clientPrincipal);
      } catch (error) {
        console.error("No user logged in", error);
      }
    }
    fetchUser();
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    axios.get(`${API_URL}/GetUserProfile`).catch((err) => {
      console.error("Failed to ensure user profile", err);
    });
  }, [user]);

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleViewChange = (nextView) => {
    setCurrentView(nextView);
    if (nextView !== "tasks") {
      setDeepLinkTaskId(null);
    }
  };

  const handleTaskSelectionChange = (taskId) => {
    const nextTaskId = taskId || null;
    setDeepLinkTaskId(nextTaskId);
    if (nextTaskId && currentView !== "tasks") {
      setCurrentView("tasks");
    }
  };

  const menuItems = [
    { text: "ダッシュボード", view: "dashboard" },
    { text: "タスク管理", view: "tasks" },
    { text: "顧客管理", view: "customers" },
    { text: "請求書管理", view: "invoices" },
    { text: "設定", view: "settings", icon: <SettingsIcon /> },
  ];

  const loginMenu = (
    <Box sx={{ p: 2, textAlign: "center" }}>
      <Typography variant="subtitle2" sx={{ mb: 2 }}>
        ログインしてください
      </Typography>
      <List>
        <ListItem disablePadding>
          <ListItemButton component="a" href="/.auth/login/google">
            <ListItemIcon>
              <GoogleIcon />
            </ListItemIcon>
            <ListItemText primary="Googleでログイン" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton component="a" href="/.auth/login/aad">
            <ListItemIcon>
              <MicrosoftIcon />
            </ListItemIcon>
            <ListItemText primary="Microsoftでログイン" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  const userMenu = (
    <Box sx={{ overflow: "auto" }}>
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              onClick={() => {
                handleViewChange(item.view);
                setDrawerOpen(false);
              }}
            >
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => {
              handleViewChange("profile");
              setDrawerOpen(false);
            }}
          >
            <ListItemIcon>
              <AccountCircleIcon />
            </ListItemIcon>
            <ListItemText primary="プロフィール設定" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton component="a" href="/.auth/logout">
            <ListItemIcon>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="ログアウト" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  const renderView = () => {
    if (!user) {
      return <Typography>ようこそ。メニューからログインしてください。</Typography>;
    }

    switch (currentView) {
      case "dashboard":
        return <DashboardView user={user} />;
      case "tasks":
        return <TaskView initialTaskId={deepLinkTaskId} onSelectedTaskChange={handleTaskSelectionChange} />;
      case "customers":
        return <CustomerView />;
      case "invoices":
        return <InvoiceView />;
      case "profile":
        return <ProfileView />;
      case "settings":
        return <SettingsView />;
      default:
        return <DashboardView user={user} />;
    }
  };

  return (
    <Box
      className="App"
      sx={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "background.default",
      }}
    >
      <AppBar component="header" position="fixed" sx={{ backgroundColor: "header.main" }}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {t('app.title')}
          </Typography>
          {user && <Chip label={user.userDetails} color="info" />}
        </Toolbar>
      </AppBar>

      <Drawer
        variant="temporary"
        open={drawerOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{ "& .MuiDrawer-paper": { boxSizing: "border-box", width: 240 } }}
      >
        <Toolbar />
        {user ? userMenu : loginMenu}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: "flex",
          justifyContent: "center",
          width: "100%",
          px: { xs: 2, md: 4 },
          pb: 6,
          overflowY: 'auto',
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 1600,
            display: "flex",
            flexDirection: "column",
            gap: 3,
            minHeight: "100vh",
          }}
        >
          <Toolbar sx={{ mb: 2 }} />
          {renderView()}
        </Box>
      </Box>
    </Box>
  );
}

export default App;

