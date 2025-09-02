// app/src/DashboardView.jsx

import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Box, Grid, Paper, Typography, Fab } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { TaskCalendar } from './TaskCalendar';
import { DashboardTaskList } from './DashboardTaskList';
import { TaskDetailModal } from './TaskDetailModal';
import { addDays, startOfToday } from 'date-fns';

const API_URL = '/api';

export function DashboardView() {
  const [allTasks, setAllTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);

  // ▼▼▼ ドロップダウン用の選択肢リストを管理するstate ▼▼▼
  const [assigneeOptions, setAssigneeOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [tagOptions, setTagOptions] = useState([]);

  useEffect(() => {
    axios.get(`${API_URL}/GetTasks`).then(res => {
      setAllTasks(res.data);
      // ▼▼▼ タスクデータから選択肢を動的に生成 ▼▼▼
      const assignees = [...new Set(res.data.map(t => t.assignee).filter(Boolean))];
      const categories = [...new Set(res.data.map(t => t.category).filter(Boolean))];
      const tags = [...new Set(res.data.flatMap(t => t.tags || []).filter(Boolean))];

      setAssigneeOptions(assignees);
      setCategoryOptions(categories);
      setTagOptions(tags);
    });
  }, []);

  const handleSaveTask = (taskToSave) => {
    const apiCall = taskToSave.id 
      ? axios.put(`${API_URL}/UpdateTask/${taskToSave.id}`, taskToSave)
      : axios.post(`${API_URL}/CreateTask`, taskToSave);

    apiCall.then(res => {
      // データを更新または追加
      const updatedTasks = taskToSave.id
        ? allTasks.map(t => t.id === taskToSave.id ? res.data : t)
        : [...allTasks, res.data];
      setAllTasks(updatedTasks);
    });
    setSelectedTask(null);
  };

  // ▼▼▼ 新規作成時に、すべての項目を持つ空のオブジェクトを渡すように修正 ▼▼▼
  const handleOpenNewTaskModal = () => {
    setSelectedTask({
      title: '',
      description: '',
      status: 'Started',
      priority: 'Medium',
      importance: 1,
      category: null,
      assignee: null,
      tags: [],
      deadline: null,
    });
  };

  const highPriorityTasks = useMemo(() => allTasks.filter(task => task.priority === 'High'), [allTasks]);
  const myTasks = useMemo(() => allTasks.filter(task => task.assignee === '秋原'), [allTasks]);
  const upcomingTasks = useMemo(() => {
    const today = startOfToday();
    const sevenDaysLater = addDays(today, 7);
    return allTasks.filter(task => {
      if (!task.deadline) return false;
      const deadlineDate = new Date(task.deadline);
      return deadlineDate >= today && deadlineDate <= sevenDaysLater;
    });
  }, [allTasks]);

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        ダッシュボード
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: '60vh', minHeight: 500 }}>
            <Typography variant="h6" gutterBottom>カレンダービュー</Typography>
            <TaskCalendar />
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: 'auto', mb: 2 }}>
            <Typography variant="h6" gutterBottom>重要度の高いタスク</Typography>
            <DashboardTaskList tasks={highPriorityTasks} onTaskClick={setSelectedTask} />
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: 'auto' }}>
            <Typography variant="h6">あなたの担当タスク</Typography>
            <DashboardTaskList tasks={myTasks} onTaskClick={setSelectedTask} />
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: 'auto' }}>
            <Typography variant="h6">7日以内に期日を迎えるタスク</Typography>
            <DashboardTaskList tasks={upcomingTasks} onTaskClick={setSelectedTask} />
          </Paper>
        </Grid>
      </Grid>
      
      <Fab color="primary" aria-label="add" sx={{ position: 'fixed', bottom: 32, right: 32 }} onClick={handleOpenNewTaskModal} >
        <AddIcon />
      </Fab>

      {selectedTask && (
        <TaskDetailModal 
          task={selectedTask} 
          onSave={handleSaveTask} 
          onClose={() => setSelectedTask(null)}
          // ▼▼▼ モーダルに選択肢リストを渡す ▼▼▼
          assigneeOptions={assigneeOptions}
          categoryOptions={categoryOptions}
          tagOptions={tagOptions}
        />
      )}
    </Box>
  );
}