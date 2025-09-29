import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { TaskDetailModal } from './TaskDetailModal';
import { Box, TextField, Button, List, ListItem, ListItemText, IconButton, Typography, Paper } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CircleIcon from '@mui/icons-material/Circle';
import { normalizeTask, normalizeTasks } from './taskUtils';

const API_URL = '/api';

const getStatusColor = (status) => {
  if (status === 'Done') return 'success.main';
  if (status === 'Inprogress') return 'warning.main';
  return 'action.disabled';
};

export function TaskView() {
  const [tasks, setTasks] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [filter, setFilter] = useState({ assignee: '', tag: '', category: '' });
  const [assigneeOptions, setAssigneeOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [tagOptions, setTagOptions] = useState([]);

  useEffect(() => {
    Promise.all([
      axios.get(`${API_URL}/GetTasks`),
      axios.get(`${API_URL}/GetAllUsers`)
    ]).then(([tasksRes, usersRes]) => {
      const normalizedTasks = normalizeTasks(tasksRes.data);
      setTasks(normalizedTasks);

      const assignees = usersRes.data.map(user => user.displayName);
      setAssigneeOptions(assignees);

      const categories = [...new Set(normalizedTasks.map(t => t.category).filter(Boolean))];
      const tags = [...new Set(normalizedTasks.flatMap(t => t.tags || []).filter(Boolean))];
      setCategoryOptions(categories);
      setTagOptions(tags);
    });
  }, []);

  const processedTasks = useMemo(() => {
    let filteredTasks = [...tasks];

    if (filter.assignee) {
      const keyword = filter.assignee.toLowerCase();
      filteredTasks = filteredTasks.filter(t =>
        Array.isArray(t.assignees) && t.assignees.some(name => name.toLowerCase().includes(keyword))
      );
    }
    if (filter.tag) {
      const keyword = filter.tag.toLowerCase();
      filteredTasks = filteredTasks.filter(t =>
        Array.isArray(t.tags) && t.tags.some(tag => tag.toLowerCase().includes(keyword))
      );
    }
    if (filter.category) {
      const keyword = filter.category.toLowerCase();
      filteredTasks = filteredTasks.filter(t => t.category && t.category.toLowerCase().includes(keyword));
    }

    if (sortConfig.key) {
      filteredTasks.sort((a, b) => {
        if (!a[sortConfig.key]) return 1;
        if (!b[sortConfig.key]) return -1;
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }

    return filteredTasks;
  }, [tasks, sortConfig, filter]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilter(prev => ({ ...prev, [name]: value }));
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    axios.post(`${API_URL}/CreateTask`, { title: newTitle }).then(res => {
      setTasks([...tasks, normalizeTask(res.data)]);
      setNewTitle('');
    });
  };

  const handleDelete = (idToDelete) => {
    axios.delete(`${API_URL}/DeleteTask/${idToDelete}`).then(() => {
      setTasks(tasks.filter(t => t.id !== idToDelete));
    });
  };

  const handleUpdate = (taskToUpdate) => {
    axios.put(`${API_URL}/UpdateTask/${taskToUpdate.id}`, taskToUpdate).then(res => {
      const normalized = normalizeTask(res.data);
      setTasks(tasks.map(t => t.id === taskToUpdate.id ? normalized : t));
      setSelectedTask(null);
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        タスク管理
      </Typography>

      <Paper elevation={2} sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>新規タスク</Typography>
        <Box component="form" onSubmit={handleCreate} sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            fullWidth
            label="新しいタスク名を入力..."
            variant="outlined"
            size="small"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
          />
          <Button type="submit" variant="contained">追加</Button>
        </Box>

        <Typography variant="h6" gutterBottom>フィルター & ソート</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField label="担当者..." name="assignee" variant="outlined" size="small" value={filter.assignee} onChange={handleFilterChange} />
          <TextField label="タグ..." name="tag" variant="outlined" size="small" value={filter.tag} onChange={handleFilterChange} />
          <TextField label="カテゴリー..." name="category" variant="outlined" size="small" value={filter.category} onChange={handleFilterChange} />
          <Button variant="outlined" size="small" onClick={() => requestSort('deadline')}>期限順</Button>
          <Button variant="outlined" size="small" onClick={() => requestSort('status')}>ステータス</Button>
        </Box>
      </Paper>

      <Paper elevation={2} sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>タスク一覧</Typography>
        <List>
          {processedTasks.map(task => {
            const secondaryParts = [];
            if (task.category) secondaryParts.push(`[${task.category}]`);
            if (Array.isArray(task.assignees) && task.assignees.length > 0) {
              secondaryParts.push(`担当: ${task.assignees.join(', ')}`);
            }
            if (task.deadline) {
              const formattedDeadline = task.deadline.split('T')[0];
              secondaryParts.push(`期限: ${formattedDeadline}`);
            }

            return (
              <ListItem
                key={task.id}
                secondaryAction={
                  <Box>
                    <IconButton edge="end" aria-label="edit" onClick={() => setSelectedTask(normalizeTask(task))}><EditIcon /></IconButton>
                    <IconButton edge="end" aria-label="delete" onClick={() => handleDelete(task.id)}><DeleteIcon /></IconButton>
                  </Box>
                }
                sx={{ borderBottom: '1px solid #eee' }}
              >
                <CircleIcon sx={{ color: getStatusColor(task.status), mr: 2, fontSize: '1rem' }} />
                <ListItemText
                  primary={task.title}
                  secondary={secondaryParts.join(' | ')}
                />
              </ListItem>
            );
          })}
        </List>
      </Paper>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onSave={handleUpdate}
          onClose={() => setSelectedTask(null)}
          assigneeOptions={assigneeOptions}
          categoryOptions={categoryOptions}
          tagOptions={tagOptions}
        />
      )}
    </Box>
  );
}
