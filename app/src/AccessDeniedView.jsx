// src/AccessDeniedView.jsx
import { Box, Typography, Paper, Button, Chip, Divider } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import EmailIcon from "@mui/icons-material/Email";
import LogoutIcon from "@mui/icons-material/Logout";

export function AccessDeniedView({ userEmail, adminEmail }) {
  // 管理者のメールアドレス（環境に応じて変更してください）
  const contactEmail = adminEmail || "admin@example.com";

  const handleRequestAccess = () => {
    const subject = encodeURIComponent("アクセス申請 - HHC Property Management System");
    const body = encodeURIComponent(
      `管理者様\n\nHHC Property Management Systemへのアクセスを申請します。\n\n申請者メールアドレス: ${userEmail}\n\nよろしくお願いいたします。`
    );
    window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "70vh",
        p: 3,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 5,
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          borderRadius: 3,
        }}
      >
        {/* アイコン */}
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            backgroundColor: "error.light",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mx: "auto",
            mb: 3,
          }}
        >
          <LockIcon sx={{ fontSize: 36, color: "error.main" }} />
        </Box>

        {/* タイトル */}
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          アクセス権限がありません
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          このシステムへのアクセスが許可されていません。
          管理者にアクセス申請をしてください。
        </Typography>

        {/* ログイン中のメールアドレス */}
        {userEmail && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              ログイン中のアカウント
            </Typography>
            <Chip label={userEmail} variant="outlined" size="small" />
          </Box>
        )}

        <Divider sx={{ my: 3 }} />

        {/* 申請ボタン */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          アクセスを希望する場合は、管理者にお問い合わせください。
        </Typography>

        <Button
          variant="contained"
          color="primary"
          startIcon={<EmailIcon />}
          onClick={handleRequestAccess}
          fullWidth
          sx={{ mb: 2 }}
        >
          管理者にアクセス申請する
        </Button>

        <Button
          variant="outlined"
          color="inherit"
          startIcon={<LogoutIcon />}
          href="/.auth/logout"
          fullWidth
        >
          別のアカウントでログイン
        </Button>
      </Paper>
    </Box>
  );
}
