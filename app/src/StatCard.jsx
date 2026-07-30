// app/src/StatCard.jsx

import { Paper, Typography, Box } from '@mui/material';

export function StatCard({ title, value, icon, color }) {
  const iconColor = color ? `${color}.main` : 'primary.main';
  const valueColor = color ? `${color}.main` : 'text.primary';
  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...(color === 'error' && value > 0 && { border: '1px solid', borderColor: 'error.light' }),
      }}
    >
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>{title}</Typography>
        <Typography variant="h4" color={valueColor} sx={{ fontWeight: 700 }}>{value}</Typography>
      </Box>
      <Box sx={{ color: iconColor }}>
        {icon}
      </Box>
    </Paper>
  );
}