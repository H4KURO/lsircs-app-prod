// app/src/App.jsx

import axios from "axios";
import { useState, useEffect, useMemo } from "react";
import { TaskView } from "./TaskView";
import { CustomerView } from "./CustomerView";
import { InvoiceView } from "./InvoiceView";
import { DashboardView } from "./DashboardView";
import { ManagedPropertiesView } from "./ManagedPropertiesView";
import { WeeklyLeasingReportView } from "./WeeklyLeasingReportView";
import { ProjectTMView } from "./ProjectTMView";
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
  FormControl,
  Select,
  MenuItem,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import GoogleIcon from "@mui/icons-material/Google";
import MicrosoftIcon from "@mui/icons-material/Microsoft";
import LogoutIcon from "@mui/icons-material/Logout";
import AssessmentIcon from "@mui/icons-material/Assessment";
import { SettingsView } from "./SettingsView";
import SettingsIcon from "@mui/icons-material/Settings";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { ProfileView } from "./ProfileView";
import { useTranslation } from "react-i18next";

const ALLOWED_VIEWS = new Set([
  "dashboard",
  "tasks",
  "customers",
  "managedProperties",
  "weeklyReports",
  "invoices",
  "projectTm",
  "settings",
  "profile",
]);

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
  const { t, i18n } = useTranslation();
  const [language, setLanguage] = useState(() => (i18n.language || "ja").split("-")[0]);

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

  useEffect(() => {
    const handleLanguageChanged = (lng) => {
      if (typeof lng === "string") {
        setLanguage(lng.split("-")[0]);
      }
    };

    i18n.on("languageChanged", handleLanguageChanged);
    return () => {
      i18n.off("languageChanged", handleLanguageChanged);
    };
  }, [i18n]);

  const handleDrawerToggle = () => {
    setDrawerOpen((prev) => !prev);
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

  const handleLanguageChange = (event) => {
    const nextLang = event.target.value;
    setLanguage(nextLang);
    i18n.changeLanguage(nextLang);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("appLanguage", nextLang);
    }
  };

  const menuItems = useMemo(
    () => [
      { text: t("nav.dashboard"), view: "dashboard" },
      { text: t("nav.tasks"), view: "tasks" },
      { text: t("nav.customers"), view: "customers" },
      { text: t("nav.managedProperties"), view: "managedProperties" },
      { text: t("nav.projectTm"), view: "projectTm" },
      { text: t("nav.weeklyReports"), view: "weeklyReports", icon: <AssessmentIcon /> },
      { text: t("nav.invoices"), view: "invoices" },
      { text: t("nav.settings"), view: "settings", icon: <SettingsIcon /> },
    ],
    [t],
  );

  const loginMenu = (
    <Box sx={{ p: 2, textAlign: "center" }}>
      <Typography variant="subtitle2" sx={{ mb: 2 }}>
        {t("auth.signInPrompt")}
      </Typography>
      <List>
        <ListItem disablePadding>
          <ListItemButton component="a" href="/.auth/login/google">
            <ListItemIcon>
              <GoogleIcon />
            </ListItemIcon>
            <ListItemText primary={t("auth.google")} />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton component="a" href="/.auth/login/aad">
            <ListItemIcon>
              <MicrosoftIcon />
            </ListItemIcon>
            <ListItemText primary={t("auth.microsoft")} />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  const userMenu = (
    <Box sx={{ overflow: "auto" }}>
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.view} disablePadding>
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
            <ListItemText primary={t("nav.profile")} />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton component="a" href="/.auth/logout">
            <ListItemIcon>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary={t("auth.logout")} />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  const renderView = () => {
    if (!user) {
      return <Typography>{t("auth.welcome")}</Typography>;
    }

    switch (currentView) {
      case "dashboard":
        return <DashboardView user={user} />;
      case "tasks":
        return <TaskView initialTaskId={deepLinkTaskId} onSelectedTaskChange={handleTaskSelectionChange} />;
      case "customers":
        return <CustomerView />;
      case "managedProperties":
        return <ManagedPropertiesView />;
      case "weeklyReports":
        return <WeeklyLeasingReportView />;
      case "invoices":
        return <InvoiceView />;
      case "profile":
        return <ProfileView />;
      case "settings":
        return <SettingsView />;
      case "projectTm":
        return <ProjectTMView />;
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
            {t("app.title")}
          </Typography>
          <FormControl
            size="small"
            variant="standard"
            sx={{
              minWidth: 120,
              mr: user ? 2 : 0,
              "& .MuiInputBase-root": { color: "inherit" },
              "& .MuiSvgIcon-root": { color: "inherit" },
            }}
          >
            <Select value={language} onChange={handleLanguageChange} disableUnderline>
              <MenuItem value="ja">{t("language.ja")}</MenuItem>
              <MenuItem value="en">{t("language.en")}</MenuItem>
            </Select>
          </FormControl>
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
          overflowY: "auto",
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
