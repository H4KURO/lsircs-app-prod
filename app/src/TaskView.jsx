// app/src/TaskView.jsx

import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { TaskDetailModal } from './TaskDetailModal';

// ▼▼▼ MUIコンポーネントをインポート ▼▼▼
import { Box, TextField, Button, List, ListItem, ListItemText, IconButton, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

const API_URL = 'http://localhost:7071/api';

export function TaskView() {
  const [tasks, setTasks] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  
  // (ソート・フィルターのロジックは変更なし)
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [filter, setFilter] = useState({ assignee: '', tag: '' });

  useEffect(() => {
    axios.get(`${API_URL}/GetTasks`).then(res => setTasks(res.data));
  }, []);

  const processedTasks = useMemo(() => {
    let filteredTasks = [...tasks];
    if (filter.assignee) { filteredTasks = filteredTasks.filter(t => t.assignee && t.assignee.toLowerCase().includes(filter.assignee.toLowerCase())); }
    if (filter.tag) { filteredTasks = filteredTasks.filter(t => t.tags && t.tags.some(tag => tag.toLowerCase().includes(filter.tag.toLowerCase())));}
    if (sortConfig.key) { filteredTasks.sort((a, b) => { if (!a[sortConfig.key]) return 1; if (!b[sortConfig.key]) return -1; if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'ascending' ? -1 : 1; if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'ascending' ? 1 : -1; return 0; }); }
    return filteredTasks;
  }, [tasks, sortConfig, filter]);

  const requestSort = (key) => { let direction = 'ascending'; if (sortConfig.key === key && sortConfig.direction === 'ascending') { direction = 'descending'; } setSortConfig({ key, direction }); };
  const handleFilterChange = (e) => { const { name, value } = e.target; setFilter(prev => ({ ...prev, [name]: value })); };
  const handleCreate = (e) => { e.preventDefault(); if (!newTitle.trim()) return; axios.post(`${API_URL}/CreateTask`, { title: newTitle }).then(res => { setTasks([...tasks, res.data]); setNewTitle(''); }); };
  const handleDelete = (idToDelete) => { axios.delete(`${API_URL}/DeleteTask/${idToDelete}`).then(() => { setTasks(tasks.filter(t => t.id !== idToDelete)); }); };
  const handleUpdate = (taskToUpdate) => { axios.put(`${API_URL}/UpdateTask/${taskToUpdate.id}`, taskToUpdate).then(res => { setTasks(tasks.map(t => t.id === taskToUpdate.id ? res.data : t)); setSelectedTask(null); }); };
  const handleUpdateStatus = (taskToUpdate) => { const statusCycle = { "Started": "Inprogress", "Inprogress": "Done", "Done": "Started" }; const nextStatus = statusCycle[taskToUpdate.status]; handleUpdate({ ...taskToUpdate, status: nextStatus }); };

  return (
    // Boxは多機能なdivのようなもの
    <Box sx={{ p: 2 }}> 
      <Typography variant="h4" component="h2" gutterBottom>
        タスク管理
      </Typography>
      
      {/* 新規作成フォーム */}
      <Box component="form" onSubmit={handleCreate} sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          label="新しいタスクを入力..."
          variant="outlined"
          size="small"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          sx={{ flexGrow: 1 }}
        />
        <Button type="submit" variant="contained">追加</Button>
      </Box>

      {/* フィルターとソート */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField label="担当者で絞り込み..." name="assignee" variant="outlined" size="small" value={filter.assignee} onChange={handleFilterChange} />
          <TextField label="タグで絞り込み..." name="tag" variant="outlined" size="small" value={filter.tag} onChange={handleFilterChange} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" size="small" onClick={() => requestSort('deadline')}>締め切り日</Button>
            <Button variant="outlined" size="small" onClick={() => requestSort('status')}>ステータス</Button>
        </Box>
      </Box>

      {/* タスク一覧 */}
      <List>
        {processedTasks.map(task => (
          <ListItem
            key={task.id}
            secondaryAction={
              <>
                <Button onClick={() => handleUpdateStatus(task)} size="small" sx={{ mr: 1 }}>{task.status}</Button>
                <IconButton edge="end" aria-label="edit" onClick={() => setSelectedTask(task)}>
                  <EditIcon />
                </IconButton>
                <IconButton edge="end" aria-label="delete" onClick={() => handleDelete(task.id)}>
                  <DeleteIcon />
                </IconButton>
              </>
            }
            sx={{ border: '1px solid #444', mb: 1, borderRadius: 1 }}
          >
            <ListItemText
              primary={task.title}
              secondary={
                (task.assignee ? `担当: ${task.assignee}` : '') + 
                (task.deadline ? ` / 締切: ${task.deadline.split('T')[0]}` : '')
              }
            />
          </ListItem>
        ))}
      </List>

      {selectedTask && (<TaskDetailModal task={selectedTask} onSave={handleUpdate} onClose={() => setSelectedTask(null)} />)}
    </Box>
  );
}