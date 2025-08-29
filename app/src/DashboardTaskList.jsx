// app/src/DashboardTaskList.jsx

import { List, ListItem, ListItemText, Typography } from '@mui/material';

// このコンポーネントは、タスクの配列を受け取ってリスト表示するだけのシンプルな部品です
export function DashboardTaskList({ tasks, onTaskClick }) {
  if (tasks.length === 0) {
    return <Typography variant="body2" color="text.secondary">対象のタスクはありません。</Typography>;
  }

  return (
    <List dense>
      {tasks.map(task => (
        <ListItem
          key={task.id}
          button // クリックできることを示す
          onClick={() => onTaskClick(task)}
          sx={{ borderBottom: '1px solid #eee' }}
        >
          <ListItemText
            primary={task.title}
            secondary={task.deadline ? `締切: ${task.deadline.split('T')[0]}` : null}
          />
        </ListItem>
      ))}
    </List>
  );
}