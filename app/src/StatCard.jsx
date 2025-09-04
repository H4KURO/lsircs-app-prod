// app/src/StatCard.jsx

import { Paper, Typography, Box } from '@mui/material';

export function StatCard({ title, value, icon }) {
  return (
    <Paper 
      elevation={2} 
      sx={{ 
        p: 2, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between' 
      }}
    >
      <Box>
        <Typography variant="h6" color="text.secondary">{title}</Typography>
        <Typography variant="h4">{value}</Typography>
      </Box>
      <Box sx={{ color: 'primary.main' }}>
        {icon}
      </Box>
    </Paper>
  );
}