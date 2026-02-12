// src/WhitelistView.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  IconButton,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import PersonIcon from "@mui/icons-material/Person";

const API_URL = "/api";

export function WhitelistView({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [targetUser, setTargetUser] = useState(null);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${API_URL}/GetWhitelistUsers`);
      setUsers(res.data);
    } catch (err) {
      if (err.response?.status === 403) {
        setError("管理者権限が必要です。");
      } else {
        setError("ユーザーリストの取得に失敗しました。");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAdd = async () => {
    if (!newEmail.trim()) return;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/UpdateWhitelistUser`, {
        email: newEmail.trim(),
        name: newName.trim(),
        isAdmin: newIsAdmin,
      });
      setSuccessMessage(`${newEmail} をホワイトリストに追加しました。`);
      setAddDialogOpen(false);
      setNewEmail("");
      setNewName("");
      setNewIsAdmin(false);
      await fetchUsers();
    } catch (err) {
      if (err.response?.status === 409) {
        setError("このメールアドレスはすでに登録されています。");
      } else {
        setError("追加に失敗しました: " + (err.response?.data?.error || err.message));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!targetUser) return;
    setSaving(true);
    try {
      await axios.delete(`${API_URL}/UpdateWhitelistUser`, {
        data: { id: targetUser.id },
      });
      setSuccessMessage(`${targetUser.email} をホワイトリストから削除しました。`);
      setDeleteDialogOpen(false);
      setTargetUser(null);
      await fetchUsers();
    } catch (err) {
      setError("削除に失敗しました: " + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAdmin = async (user) => {
    try {
      await axios.put(`${API_URL}/UpdateWhitelistUser`, {
        id: user.id,
        isAdmin: !user.isAdmin,
      });
      await fetchUsers();
    } catch (err) {
      setError("更新に失敗しました。");
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: "auto" }}>
      {/* ヘッダー */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">
            アクセス管理（ホワイトリスト）
          </Typography>
          <Typography variant="body2" color="text.secondary">
            システムにアクセスできるユーザーを管理します
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setError(null);
            setAddDialogOpen(true);
          }}
        >
          ユーザーを追加
        </Button>
      </Box>

      {/* アラート */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {successMessage && (
        <Alert severity="success" onClose={() => setSuccessMessage("")} sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}

      {/* ユーザーテーブル */}
      <Paper elevation={2}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "grey.100" }}>
                <TableCell sx={{ fontWeight: "bold" }}>メールアドレス</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>名前</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>権限</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>追加日</TableCell>
                <TableCell sx={{ fontWeight: "bold" }} align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    ユーザーが登録されていません
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow
                    key={user.id}
                    sx={{
                      backgroundColor:
                        user.email === currentUser?.userDetails ? "primary.50" : "inherit",
                      "&:hover": { backgroundColor: "action.hover" },
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {user.email}
                        {user.email === currentUser?.userDetails && (
                          <Chip label="自分" size="small" color="primary" variant="outlined" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>{user.name || "-"}</TableCell>
                    <TableCell>
                      <Chip
                        icon={user.isAdmin ? <AdminPanelSettingsIcon /> : <PersonIcon />}
                        label={user.isAdmin ? "管理者" : "一般ユーザー"}
                        color={user.isAdmin ? "warning" : "default"}
                        size="small"
                        onClick={() => {
                          // 自分の権限は変更不可
                          if (user.email === currentUser?.userDetails) return;
                          handleToggleAdmin(user);
                        }}
                        sx={{
                          cursor: user.email === currentUser?.userDetails ? "default" : "pointer",
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString("ja-JP")
                        : "-"}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip
                        title={
                          user.email === currentUser?.userDetails
                            ? "自分自身は削除できません"
                            : "削除"
                        }
                      >
                        <span>
                          <IconButton
                            color="error"
                            size="small"
                            disabled={user.email === currentUser?.userDetails}
                            onClick={() => {
                              setTargetUser(user);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
        ※ 権限チップをクリックすると管理者 ↔ 一般ユーザーを切り替えられます（自分以外）
      </Typography>

      {/* 追加ダイアログ */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>ユーザーを追加</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            label="メールアドレス *"
            type="email"
            fullWidth
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
            placeholder="example@gmail.com"
            autoFocus
          />
          <TextField
            label="名前（任意）"
            fullWidth
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            sx={{ mb: 2 }}
            placeholder="山田 太郎"
          />
          <FormControlLabel
            control={
              <Switch
                checked={newIsAdmin}
                onChange={(e) => setNewIsAdmin(e.target.checked)}
                color="warning"
              />
            }
            label="管理者権限を付与する"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddDialogOpen(false)} disabled={saving}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={!newEmail.trim() || saving}
            startIcon={saving ? <CircularProgress size={16} /> : <AddIcon />}
          >
            追加する
          </Button>
        </DialogActions>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>ユーザーを削除</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{targetUser?.email}</strong> をホワイトリストから削除しますか？
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            削除後、このユーザーはシステムにアクセスできなくなります。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={saving}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            削除する
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
