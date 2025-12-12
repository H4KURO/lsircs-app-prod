import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
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
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
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

  const columns = useMemo(() => buildColumns(rows), [rows]);

  const fetchData = async (id) => {
    if (!id) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError("");
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
          {loading && <CircularProgress size={24} />}
        </Stack>
        {error && (
          <Alert severity="error" sx={{ whiteSpace: "pre-line" }}>
            {error}
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
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("projectTm.keyColumn")}</TableCell>
                  {columns.map((col) => (
                    <TableCell key={col.id}>{col.label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id || row.key}>
                    <TableCell>{row.key || row.id}</TableCell>
                    {columns.map((col) => (
                      <TableCell key={col.id}>{row.data?.[col.id] ?? ""}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}
