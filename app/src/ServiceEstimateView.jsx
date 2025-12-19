import { useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  Button,
  Stack,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import axios from "axios";
import { filesToAttachmentPayloads, formatYen, ATTACHMENT_ACCEPTED_TYPES } from "./propertyPhotoUtils";
import { useTranslation } from "react-i18next";

const API_URL = "/api";

const initialProperty = {
  layout: "",
  areaSqm: "",
  region: "",
  address: "",
  buildingType: "",
  rooms: "",
  yearBuilt: "",
  notes: "",
};

export function ServiceEstimateView() {
  const { t } = useTranslation();
  const [property, setProperty] = useState(initialProperty);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [feedbackSuccess, setFeedbackSuccess] = useState("");
  const [result, setResult] = useState(null);
  const [finalAmount, setFinalAmount] = useState("");
  const [finalNotes, setFinalNotes] = useState("");

  const hasResult = useMemo(() => !!result?.estimateId, [result]);

  const handleFileChange = async (event) => {
    setError("");
    const files = event.target.files;
    if (!files || files.length === 0) return;
    try {
      const payloads = await filesToAttachmentPayloads(files);
      setAttachments(payloads);
    } catch (err) {
      setError(t("serviceEstimate.messages.fileReadError"));
    }
  };

  const handleRemoveAttachment = () => {
    setAttachments([]);
  };

  const handleInputChange = (key, value) => {
    setProperty((prev) => ({ ...prev, [key]: value }));
  };

  const submitEstimate = async () => {
    setError("");
    setSuccessMessage("");
    setResult(null);
    setFeedbackSuccess("");
    setFeedbackError("");

    if (!property.layout && !property.areaSqm && !property.region && attachments.length === 0) {
      setError(t("serviceEstimate.validation.minInput"));
      return;
    }

    const payload = {
      property: {
        layout: property.layout,
        areaSqm: property.areaSqm ? Number(property.areaSqm) : undefined,
        region: property.region,
        address: property.address,
        buildingType: property.buildingType,
        rooms: property.rooms ? Number(property.rooms) : undefined,
        yearBuilt: property.yearBuilt ? Number(property.yearBuilt) : undefined,
        notes: property.notes,
      },
      attachments,
    };

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/EstimateServiceCost`, payload);
      setResult(res.data);
      setFinalAmount(res.data?.estimate?.amount ?? "");
      setFinalNotes("");
      setSuccessMessage(t("serviceEstimate.messages.estimateSuccess"));
    } catch (err) {
      const message = err?.response?.data || err?.message || "Failed";
      setError(typeof message === "string" ? message : t("serviceEstimate.messages.estimateFailed"));
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async () => {
    if (!hasResult || !result?.estimateId) return;
    if (!finalAmount) {
      setFeedbackError(t("serviceEstimate.validation.finalAmount"));
      return;
    }
    setFeedbackError("");
    setFeedbackSuccess("");
    setFeedbackLoading(true);
    try {
      const res = await axios.post(`${API_URL}/ServiceEstimateFeedback`, {
        estimateId: result.estimateId,
        finalAmount: Number(finalAmount),
        notes: finalNotes,
      });
      setResult((prev) => ({ ...prev, estimate: res.data?.estimate, feedbackHistory: res.data?.feedbackHistory }));
      setFeedbackSuccess(t("serviceEstimate.messages.feedbackSuccess"));
    } catch (err) {
      const message = err?.response?.data || err?.message || "Failed";
      setFeedbackError(typeof message === "string" ? message : t("serviceEstimate.messages.feedbackFailed"));
    } finally {
      setFeedbackLoading(false);
    }
  };

  const estimateAmountDisplay = useMemo(
    () => formatYen(result?.estimate?.amount) || result?.estimate?.amount || "",
    [result],
  );
  const finalAmountDisplay = useMemo(
    () => formatYen(result?.estimate?.userAmount) || result?.estimate?.userAmount || "",
    [result],
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Typography variant="h5" fontWeight="bold">
        {t("serviceEstimate.title")}
      </Typography>
      <Typography variant="body1" color="text.secondary">
        {t("serviceEstimate.description")}
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {t("serviceEstimate.form.title")}
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              label={t("serviceEstimate.fields.layout")}
              fullWidth
              value={property.layout}
              onChange={(e) => handleInputChange("layout", e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              label={t("serviceEstimate.fields.areaSqm")}
              fullWidth
              type="number"
              value={property.areaSqm}
              onChange={(e) => handleInputChange("areaSqm", e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              label={t("serviceEstimate.fields.region")}
              fullWidth
              value={property.region}
              onChange={(e) => handleInputChange("region", e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              label={t("serviceEstimate.fields.address")}
              fullWidth
              value={property.address}
              onChange={(e) => handleInputChange("address", e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              label={t("serviceEstimate.fields.buildingType")}
              fullWidth
              value={property.buildingType}
              onChange={(e) => handleInputChange("buildingType", e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              label={t("serviceEstimate.fields.rooms")}
              fullWidth
              type="number"
              value={property.rooms}
              onChange={(e) => handleInputChange("rooms", e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              label={t("serviceEstimate.fields.yearBuilt")}
              fullWidth
              type="number"
              value={property.yearBuilt}
              onChange={(e) => handleInputChange("yearBuilt", e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label={t("serviceEstimate.fields.notes")}
              fullWidth
              multiline
              minRows={2}
              value={property.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={8}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Button variant="outlined" component="label">
                {attachments.length > 0 ? t("serviceEstimate.actions.replaceFiles") : t("serviceEstimate.actions.addFiles")}
                <input
                  hidden
                  accept={ATTACHMENT_ACCEPTED_TYPES}
                  multiple
                  type="file"
                  onChange={handleFileChange}
                />
              </Button>
              {attachments.length > 0 && (
                <Chip
                  label={t("serviceEstimate.attachments.count", { count: attachments.length })}
                  onDelete={handleRemoveAttachment}
                  color="primary"
                  variant="outlined"
                />
              )}
              <Typography variant="body2" color="text.secondary">
                {t("serviceEstimate.attachments.helper")}
              </Typography>
            </Stack>
          </Grid>
          <Grid item xs={12} sm={4} textAlign={{ xs: "left", sm: "right" }}>
            <Button variant="contained" onClick={submitEstimate} disabled={loading} startIcon={loading && <CircularProgress size={18} />}>
              {t("serviceEstimate.actions.estimate")}
            </Button>
          </Grid>
        </Grid>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        {successMessage && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {successMessage}
          </Alert>
        )}
      </Paper>

      {hasResult && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            {t("serviceEstimate.result.title")}
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap: "wrap" }}>
            <Chip label={`${t("serviceEstimate.result.estimate")}: ${estimateAmountDisplay}`} color="primary" />
            {finalAmountDisplay && <Chip label={`${t("serviceEstimate.result.final")}: ${finalAmountDisplay}`} color="success" />}
            <Chip label={`ID: ${result?.estimateId}`} variant="outlined" />
          </Stack>
          {Array.isArray(result?.estimate?.rationale) && result.estimate.rationale.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1">{t("serviceEstimate.result.rationale")}</Typography>
              <List dense>
                {result.estimate.rationale.map((item, idx) => (
                  <ListItem key={idx} sx={{ py: 0.5 }}>
                    <ListItemText primary={item} />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
          {Array.isArray(result?.similarExamples) && result.similarExamples.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1">{t("serviceEstimate.result.similarExamples")}</Typography>
              <List dense>
                {result.similarExamples.map((item) => (
                  <ListItem key={item.id} sx={{ py: 0.5 }}>
                    <ListItemText
                      primary={t("serviceEstimate.result.exampleLine", {
                        layout: item.layout || "-",
                        area: item.areaSqm || "-",
                        region: item.region || "-",
                        amount: formatYen(item.userAmount || item.aiAmount) || item.userAmount || item.aiAmount || "-",
                      })}
                      secondary={`ID: ${item.id}`}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            {t("serviceEstimate.feedback.title")}
          </Typography>
          <Stack spacing={2} sx={{ maxWidth: 480 }}>
            <TextField
              label={t("serviceEstimate.feedback.amount")}
              type="number"
              value={finalAmount}
              onChange={(e) => setFinalAmount(e.target.value)}
            />
            <TextField
              label={t("serviceEstimate.feedback.notes")}
              multiline
              minRows={2}
              value={finalNotes}
              onChange={(e) => setFinalNotes(e.target.value)}
            />
            <Stack direction="row" spacing={2} alignItems="center">
              <Button
                variant="contained"
                onClick={submitFeedback}
                disabled={feedbackLoading}
                startIcon={feedbackLoading && <CircularProgress size={18} />}
              >
                {t("serviceEstimate.feedback.submit")}
              </Button>
              {feedbackSuccess && <Alert severity="success">{feedbackSuccess}</Alert>}
              {feedbackError && <Alert severity="error">{feedbackError}</Alert>}
            </Stack>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
