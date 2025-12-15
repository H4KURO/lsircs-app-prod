import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  IconButton,
  Tooltip,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useTranslation } from "react-i18next";

const API_URL = "/api";

function buildColumns(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }
  const firstKeys = Object.keys(items[0].data || {});
  const seen = new Set(firstKeys);
  const orderedKeys = [...firstKeys];

  for (const item of items) {
    const keys = Object.keys(item.data || {});
    for (const k of keys) {
      if (!seen.has(k)) {
        seen.add(k);
        orderedKeys.push(k);
      }
    }
  }

  return orderedKeys.map((key) => ({ id: key, label: key }));
}

export function ProjectTMView({ initialProjectId = "TPWV" }) {
  const { t } = useTranslation();
  const [projectId, setProjectId] = useState(initialProjectId);
  const [projectOptions, setProjectOptions] = useState([initialProjectId]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState("edit");
  const [editKey, setEditKey] = useState("");
  const [editValues, setEditValues] = useState({});
  const [editRowIndex, setEditRowIndex] = useState(null);
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const columns = useMemo(() => buildColumns(rows), [rows]);

  const fetchData = async (id) => {
    if (!id) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const response = await axios.get(`${API_URL}/GetProjectCustomers`, {
        params: { projectId: id },
      });
      const data = Array.isArray(response.data) ? response.data : [];
      setRows(data);
      if (!projectOptions.includes(id)) {
        setProjectOptions((prev) => [...prev, id]);
      }
    } catch (err) {
      setError(err?.response?.data || err?.message || "Failed to fetch data");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(projectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProjectChange = (event, value) => {
    setProjectId(value || "");
  };

  const handleReload = () => {
    fetchData(projectId);
  };

  const openEditDialog = (mode, row = null) => {
    setEditMode(mode);
    setEditError("");
    if (mode === "edit" && row) {
      setEditKey(row.key || "");
      setEditValues({ ...(row.data || {}) });
      setEditRowIndex(row.rowIndex ?? null);
    } else {
      if (columns.length === 0) {
        setError(t("projectTm.noColumns"));
        return;
      }
      const initialValues = {};
      columns.forEach((c) => {
        initialValues[c.id] = "";
      });
      setEditKey("");
      setEditValues(initialValues);
      setEditRowIndex(rows.length + 1);
    }
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    const trimmedKey = (editKey || "").trim();
    if (!projectId) {
      setEditError(t("projectTm.noProject"));
      return;
    }
    if (!trimmedKey) {
      setEditError(t("projectTm.keyRequired"));
      return;
    }
    setEditSaving(true);
    setEditError("");
    try {
      const payload = {
        data: editValues,
        rowIndex: editRowIndex ?? rows.length + 1,
      };
      const { data } = await axios.put(
        `${API_URL}/ProjectCustomers/${projectId}/${encodeURIComponent(trimmedKey)}`,
        payload,
      );
      setRows((prev) => {
        const next = [...prev];
        const idx = next.findIndex((r) => r.id === data.id);
        if (idx >= 0) {
          next[idx] = data;
        } else {
          next.push(data);
        }
        return next.sort((a, b) => (a.rowIndex ?? 0) - (b.rowIndex ?? 0));
      });
      setEditDialogOpen(false);
    } catch (err) {
      setEditError(err?.response?.data || err?.message || t("projectTm.saveFailed"));
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!row?.key || !projectId) return;
    const confirmed = window.confirm(t("projectTm.confirmDelete", { key: row.key }));
    if (!confirmed) return;
    try {
      await axios.delete(
        `${API_URL}/ProjectCustomers/${projectId}/${encodeURIComponent(row.key)}`,
      );
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      setError(err?.response?.data || err?.message || t("projectTm.deleteFailed"));
    }
  };

  const handleSave = async () => {
    if (!projectId) return;
    setSaving(true);
    setError("");
    setInfo("");
    try {
      const response = await axios.get(`${API_URL}/ExportProjectExcel`, {
        params: { projectId },
        responseType: "json",
      });
      const { fileBase64, fileName } = response.data || {};
      if (!fileBase64) {
        setError(t("projectTm.noDataToExport"));
        return;
      }
      setInfo(
        t("projectTm.readyForPa", {
          fileName: fileName || `${projectId}.xlsx`,
        }),
      );
    } catch (err) {
      setError(err?.response?.data || err?.message || "Failed to export data");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Paper sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
        <Typography variant="h6">{t("projectTm.title")}</Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
          <Autocomplete
            freeSolo
            options={projectOptions}
            value={projectId}
            onChange={handleProjectChange}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t("projectTm.projectId")}
                placeholder={t("projectTm.projectPlaceholder")}
                size="small"
              />
            )}
            sx={{ minWidth: 220 }}
          />
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={handleReload}
            disabled={!projectId || loading}
          >
            {t("projectTm.reload")}
          </Button>
          <Button
            variant="outlined"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={!projectId || loading || saving}
          >
            {saving ? t("projectTm.saving") : t("projectTm.save")}
          </Button>
          <Button
            variant="outlined"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => openEditDialog("add")}
            disabled={!projectId || loading || saving}
          >
            {t("projectTm.addRow")}
          </Button>
          {loading && <CircularProgress size={24} />}
          {saving && !loading && <CircularProgress size={24} />}
        </Stack>
        {error && (
          <Alert severity="error" sx={{ whiteSpace: "pre-line" }}>
            {error}
          </Alert>
        )}
        {info && (
          <Alert severity="info" sx={{ whiteSpace: "pre-line" }}>
            {info}
          </Alert>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="subtitle1">
            {projectId ? t("projectTm.selectedProject", { projectId }) : t("projectTm.noProject")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("projectTm.rowCount", { count: rows.length })}
          </Typography>
        </Stack>

        {loading && rows.length === 0 ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : rows.length === 0 ? (
          <Typography color="text.secondary">{t("projectTm.empty")}</Typography>
        ) : (
          <TableContainer sx={{ maxHeight: 600, overflowX: "auto" }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 120, backgroundColor: "background.default" }}>
                    {t("projectTm.keyColumn")}
                  </TableCell>
                  {columns.map((col) => (
                    <TableCell
                      key={col.id}
                      sx={{ minWidth: 180, backgroundColor: "background.default" }}
                    >
                      {col.label}
                    </TableCell>
                  ))}
                  <TableCell sx={{ minWidth: 140, backgroundColor: "background.default" }}>
                    {t("projectTm.actions")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id || row.key}>
                    <TableCell sx={{ minWidth: 120 }}>{row.key || row.id}</TableCell>
                    {columns.map((col) => (
                      <TableCell key={col.id} sx={{ minWidth: 180 }}>
                        {row.data?.[col.id] ?? ""}
                      </TableCell>
                    ))}
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title={t("projectTm.edit")}>
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => openEditDialog("edit", row)}
                              disabled={saving || loading}
                            >
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={t("projectTm.delete")}>
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleDelete(row)}
                              disabled={saving || loading}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editMode === "edit" ? t("projectTm.editRowTitle") : t("projectTm.addRowTitle")}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label={t("projectTm.keyColumn")}
              value={editKey}
              onChange={(e) => setEditKey(e.target.value)}
              disabled={editMode === "edit"}
              fullWidth
            />
            <Stack spacing={2}>
              {columns.map((col) => (
                <TextField
                  key={col.id}
                  label={col.label}
                  value={editValues[col.id] ?? ""}
                  onChange={(e) =>
                    setEditValues((prev) => ({
                      ...prev,
                      [col.id]: e.target.value,
                    }))
                  }
                  fullWidth
                />
              ))}
            </Stack>
            {editError && (
              <Alert severity="error" sx={{ whiteSpace: "pre-line" }}>
                {editError}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} disabled={editSaving}>
            {t("projectTm.cancel")}
          </Button>
          <Button variant="contained" onClick={handleEditSave} disabled={editSaving}>
            {editSaving ? t("projectTm.saving") : t("projectTm.save")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
