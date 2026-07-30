// app/src/App.jsx

import axios from "axios";
import { useState, useEffect, useMemo } from "react";
import { TaskView } from "./TaskView";
import { DashboardView } from "./DashboardView";
import "./App.css";
import {
  Box,
  Drawer,
  Tooltip,
  Typography,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
} from "@mui/material";
import { SettingsView } from "./SettingsView";
import { ProfileView } from "./ProfileView";
import { useTranslation } from "react-i18next";
import { AccessDeniedView } from "./AccessDeniedView";
import { WhitelistView } from "./WhitelistView";
import { SpreadsheetView } from "./SpreadsheetView";
import { BuyersListView } from "./BuyersListView";
import { CRMView } from "./CRMView";
import { ProjectsView } from "./ProjectsView";
import { GlobalSearch } from "./GlobalSearch";

// MUI icons
import DashboardIcon from "@mui/icons-material/Dashboard";
import AssignmentIcon from "@mui/icons-material/Assignment";
import FolderSpecialIcon from "@mui/icons-material/FolderSpecial";
import PeopleIcon from "@mui/icons-material/People";
import ContactsIcon from "@mui/icons-material/Contacts";
import TableViewIcon from "@mui/icons-material/TableView";
import SecurityIcon from "@mui/icons-material/Security";
import SettingsIcon from "@mui/icons-material/Settings";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import SearchIcon from "@mui/icons-material/Search";
import LogoutIcon from "@mui/icons-material/Logout";
import MicrosoftIcon from "@mui/icons-material/Microsoft";

const RAIL_WIDTH = 56;
const RAIL_BG = "#001731";
const BRAND = "#002349";

const ALLOWED_VIEWS = new Set([
  "dashboard",
  "tasks",
  "settings",
  "profile",
  "whitelist",
  "spreadsheet",
  "buyers",
  "crm",
  "projects",
]);

const parseInitialLocation = () => {
  if (typeof window === "undefined") return { view: "dashboard", taskId: null };
  try {
    const params = new URLSearchParams(window.location.search);
    const rawView = params.get("view");
    const taskId = params.get("taskId");
    const normalizedView = rawView && ALLOWED_VIEWS.has(rawView) ? rawView : "dashboard";
    return { view: taskId ? "tasks" : normalizedView, taskId: taskId || null };
  } catch {
    return { view: "dashboard", taskId: null };
  }
};

const syncLocation = (view, taskId) => {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams();
    if (view && view !== "dashboard") params.set("view", view);
    if (taskId) params.set("taskId", taskId);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
  } catch { /* ignore */ }
};

const API_URL = "/api";

// ── Icon Rail item ──────────────────────────────────────────────
function RailItem({ icon, label, active, onClick, sx = {} }) {
  return (
    <Tooltip title={label} placement="right" arrow>
      <Box
        onClick={onClick}
        sx={{
          width: 40,
          height: 40,
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: active ? "#fff" : "rgba(255,255,255,.40)",
          bgcolor: active ? "rgba(255,255,255,.15)" : "transparent",
          position: "relative",
          transition: "background .14s, color .14s",
          "&:hover": {
            bgcolor: active ? "rgba(255,255,255,.15)" : "rgba(255,255,255,.08)",
            color: active ? "#fff" : "rgba(255,255,255,.72)",
          },
          // left accent bar when active
          "&::before": active ? {
            content: '""',
            position: "absolute",
            left: 0,
            top: "9px",
            bottom: "9px",
            width: "3px",
            bgcolor: "rgba(255,255,255,.8)",
            borderRadius: "0 3px 3px 0",
          } : {},
          ...sx,
        }}
      >
        {icon}
      </Box>
    </Tooltip>
  );
}

function RailDivider() {
  return (
    <Box sx={{ width: 24, height: 1, bgcolor: "rgba(255,255,255,.08)", my: "6px" }} />
  );
}

// ── App ──────────────────────────────────────────────────────────
function App() {
  const initialLocation = parseInitialLocation();
  const [currentView, setCurrentView] = useState(initialLocation.view);
  const [user, setUser] = useState(null);
  const [accessStatus, setAccessStatus] = useState(null);
  const [deepLinkTaskId, setDeepLinkTaskId] = useState(initialLocation.taskId);
  const { t, i18n } = useTranslation();
  const [language, setLanguage] = useState(() => (i18n.language || "ja").split("-")[0]);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const taskIdForSync = currentView === "tasks" ? deepLinkTaskId : null;
    syncLocation(currentView, taskIdForSync);
  }, [currentView, deepLinkTaskId]);

  // ⌘K / Ctrl+K → global search
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

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
    if (!user) return;
    axios.get(`${API_URL}/GetUserProfile`).catch((err) => {
      console.error("Failed to ensure user profile", err);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    async function checkAccess() {
      try {
        const res = await axios.get(`${API_URL}/CheckUserAccess`);
        setAccessStatus(res.data);
      } catch {
        setAccessStatus({ allowed: false, reason: "error" });
      }
    }
    checkAccess();
  }, [user]);

  useEffect(() => {
    const handleLanguageChanged = (lng) => {
      if (typeof lng === "string") setLanguage(lng.split("-")[0]);
    };
    i18n.on("languageChanged", handleLanguageChanged);
    return () => i18n.off("languageChanged", handleLanguageChanged);
  }, [i18n]);

  const handleViewChange = (nextView) => {
    setCurrentView(nextView);
    if (nextView !== "tasks") setDeepLinkTaskId(null);
  };

  const handleTaskSelectionChange = (taskId) => {
    const nextTaskId = taskId || null;
    setDeepLinkTaskId(nextTaskId);
    if (nextTaskId && currentView !== "tasks") setCurrentView("tasks");
  };

  const handleLanguageChange = (e) => {
    const nextLang = e.target.value;
    setLanguage(nextLang);
    i18n.changeLanguage(nextLang);
    if (typeof window !== "undefined") window.localStorage.setItem("appLanguage", nextLang);
  };

  // Main nav items
  const navItems = useMemo(() => [
    { view: "dashboard", label: t("nav.dashboard"), icon: <DashboardIcon sx={{ fontSize: 20 }} /> },
    { view: "tasks",     label: t("nav.tasks"),      icon: <AssignmentIcon sx={{ fontSize: 20 }} /> },
    { view: "projects",  label: "プロジェクト管理",  icon: <FolderSpecialIcon sx={{ fontSize: 20 }} /> },
    { view: "buyers",    label: "バイヤーリスト",     icon: <PeopleIcon sx={{ fontSize: 20 }} /> },
    { view: "crm",       label: "顧客管理 (CRM)",    icon: <ContactsIcon sx={{ fontSize: 20 }} /> },
    { view: "spreadsheet", label: "スプレッドシート", icon: <TableViewIcon sx={{ fontSize: 20 }} /> },
  ], [t]);

  const renderView = () => {
    if (!user) {
      return (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 2 }}>
          <Typography variant="h6" color="text.secondary">{t("auth.signInPrompt")}</Typography>
          <Box
            component="a"
            href="/.auth/login/aad"
            sx={{
              display: "flex", alignItems: "center", gap: 1,
              px: 3, py: 1.5, borderRadius: 2,
              bgcolor: "primary.main", color: "#fff",
              textDecoration: "none", fontWeight: 600, fontSize: 14,
              "&:hover": { bgcolor: "primary.dark" },
            }}
          >
            <MicrosoftIcon sx={{ fontSize: 18 }} />
            {t("auth.microsoft")}
          </Box>
        </Box>
      );
    }

    if (!accessStatus) {
      return (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
          <CircularProgress />
        </Box>
      );
    }

    if (!accessStatus.allowed) {
      return <AccessDeniedView userEmail={user.userDetails} />;
    }

    switch (currentView) {
      case "dashboard":  return <DashboardView user={user} />;
      case "tasks":      return <TaskView initialTaskId={deepLinkTaskId} onSelectedTaskChange={handleTaskSelectionChange} />;
      case "profile":    return <ProfileView />;
      case "settings":   return <SettingsView />;
      case "buyers":     return <BuyersListView />;
      case "crm":        return <CRMView onNavigateToTask={handleTaskSelectionChange} />;
      case "projects":   return <ProjectsView />;
      case "spreadsheet": return <SpreadsheetView />;
      case "whitelist":  return accessStatus.isAdmin ? <WhitelistView currentUser={user} /> : <AccessDeniedView userEmail={user.userDetails} />;
      default:           return <DashboardView user={user} />;
    }
  };

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden", bgcolor: "background.default" }}>

      {/* ── ICON RAIL ── */}
      <Drawer
        variant="permanent"
        sx={{
          width: RAIL_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: RAIL_WIDTH,
            background: RAIL_BG,
            border: "none",
            overflowX: "hidden",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            pt: "10px",
            pb: "12px",
            gap: 0,
          },
        }}
      >
        {/* Logo mark */}
        <Tooltip title="lsir-cs" placement="right">
          <Box
            onClick={() => handleViewChange("dashboard")}
            sx={{
              width: 34, height: 34,
              bgcolor: BRAND,
              borderRadius: "9px",
              display: "flex", alignItems: "center", justifyContent: "center",
              mb: "16px", flexShrink: 0, cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,.3)",
              "& svg": { fill: "#fff", width: 18, height: 18 },
            }}
          >
            <svg viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" /></svg>
          </Box>
        </Tooltip>

        {/* Main nav */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: "center" }}>
          {navItems.map((item) => (
            <RailItem
              key={item.view}
              icon={item.icon}
              label={item.label}
              active={currentView === item.view}
              onClick={() => handleViewChange(item.view)}
            />
          ))}
        </Box>

        {/* Spacer */}
        <Box sx={{ flex: 1 }} />

        {/* Bottom items */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: "center" }}>
          {/* Language toggle */}
          <Tooltip title="言語 / Language" placement="right">
            <Box sx={{ width: 40, display: "flex", justifyContent: "center" }}>
              <FormControl variant="standard" size="small" sx={{ "& .MuiSelect-select": { color: "rgba(255,255,255,.4)", fontSize: 10, py: 0 }, "& .MuiSvgIcon-root": { color: "rgba(255,255,255,.3)" } }}>
                <Select value={language} onChange={handleLanguageChange} disableUnderline>
                  <MenuItem value="ja">JA</MenuItem>
                  <MenuItem value="en">EN</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Tooltip>

          <RailDivider />

          {/* Global search */}
          <RailItem
            icon={<SearchIcon sx={{ fontSize: 20 }} />}
            label="グローバル検索 (⌘K)"
            active={false}
            onClick={() => setSearchOpen(true)}
          />

          {user && accessStatus?.isAdmin && (
            <RailItem
              icon={<SecurityIcon sx={{ fontSize: 20 }} />}
              label="アクセス管理"
              active={currentView === "whitelist"}
              onClick={() => handleViewChange("whitelist")}
            />
          )}

          <RailItem
            icon={<SettingsIcon sx={{ fontSize: 20 }} />}
            label={t("nav.settings")}
            active={currentView === "settings"}
            onClick={() => handleViewChange("settings")}
          />

          {user && (
            <RailItem
              icon={<AccountCircleIcon sx={{ fontSize: 20 }} />}
              label={user.userDetails || t("nav.profile")}
              active={currentView === "profile"}
              onClick={() => handleViewChange("profile")}
            />
          )}

          {user && (
            <RailItem
              icon={<LogoutIcon sx={{ fontSize: 20 }} />}
              label={t("auth.logout")}
              active={false}
              onClick={() => { window.location.href = "/.auth/logout"; }}
            />
          )}
        </Box>
      </Drawer>

      {/* ── MAIN CONTENT ── */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
          minHeight: 0,
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 1600,
            mx: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 3,
            minHeight: "100%",
            px: { xs: 2, md: 4 },
            pb: 6,
            pt: 3,
          }}
        >
          {renderView()}
        </Box>
      </Box>

      <GlobalSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectTask={handleTaskSelectionChange}
      />
    </Box>
  );
}

export default App;
