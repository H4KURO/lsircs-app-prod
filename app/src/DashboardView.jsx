// app/src/DashboardView.jsx

import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Box, Grid, Paper, Typography, Fab, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings'; // 設定アイコンをインポート
import { TaskCalendar } from './TaskCalendar';
import { DashboardTaskList } from './DashboardTaskList';
import { TaskDetailModal } from './TaskDetailModal';
import { DashboardSettingsModal } from './DashboardSettingsModal'; // 設定モーダルをインポート
import { addDays, startOfToday } from 'date-fns';

const API_URL = '/api';

// デフォルトの表示設定
const defaultSettings = {
  showHighPriority: true,
  showMyTasks: true,
  showUpcoming: true,
};

export function DashboardView({ user }) {
  const [allTasks, setAllTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [assigneeOptions, setAssigneeOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [tagOptions, setTagOptions] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false); // 設定モーダルの開閉state

  // ▼▼▼ 表示設定をstateで管理 ▼▼▼
  const [dashboardSettings, setDashboardSettings] = useState(() => {
    const savedSettings = localStorage.getItem('dashboardSettings');
    return savedSettings ? JSON.parse(savedSettings) : defaultSettings;
  });

  useEffect(() => {
    axios.get(`${API_URL}/GetTasks`).then(res => {
      setAllTasks(res.data);
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
      const updatedTasks = taskToSave.id
        ? allTasks.map(t => t.id === taskToSave.id ? res.data : t)
        : [...allTasks, res.data];
      setAllTasks(updatedTasks);
    }).catch(error => {
      console.error('Task save error:', error);
      alert('タスクの保存に失敗しました。');
    }).finally(() => {
      setSelectedTask(null);
    });
  };

  const handleOpenNewTaskModal = () => {
    setSelectedTask({
      title: '', description: '', status: 'Started', priority: 'Medium',
      importance: 1, category: null, assignee: null, tags: [], deadline: null,
    });
  };
  
  // ▼▼▼ 設定が保存されたときの処理を追加 ▼▼▼
  const handleSaveSettings = (newSettings) => {
    localStorage.setItem('dashboardSettings', JSON.stringify(newSettings));
    setDashboardSettings(newSettings);
    setSettingsOpen(false);
  };

  const highPriorityTasks = useMemo(() => allTasks.filter(task => task.priority === 'High'), [allTasks]);
  const myTasks = useMemo(() => {
    if (!user) return [];
    return allTasks.filter(task => task.assignee === user.userDetails);
  }, [allTasks, user]);
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
      {/* ▼▼▼ タイトルの横に設定アイコンを追加 ▼▼▼ */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1" sx={{ flexGrow: 1 }}>
          ダッシュボード
        </Typography>
        <IconButton onClick={() => setSettingsOpen(true)}>
          <SettingsIcon />
        </IconButton>
      </Box>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: '60vh', minHeight: 500 }}>
            <Typography variant="h6" gutterBottom>カレンダービュー</Typography>
            <TaskCalendar />
          </Paper>
        </Grid>
        
        {/* ▼▼▼ 設定に基づいてカードの表示を切り替え ▼▼▼ */}
        {dashboardSettings.showHighPriority && (
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, height: 'auto', mb: 2 }}>
              <Typography variant="h6" gutterBottom>重要度の高いタスク</Typography>
              <DashboardTaskList tasks={highPriorityTasks} onTaskClick={setSelectedTask} />
            </Paper>
          </Grid>
        )}
        
        {dashboardSettings.showMyTasks && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: 'auto' }}>
              <Typography variant="h6">あなたの担当タスク</Typography>
              <DashboardTaskList tasks={myTasks} onTaskClick={setSelectedTask} />
            </Paper>
          </Grid>
        )}
        
        {dashboardSettings.showUpcoming && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: 'auto' }}>
              <Typography variant="h6">7日以内に期日を迎えるタスク</Typography>
              <DashboardTaskList tasks={upcomingTasks} onTaskClick={setSelectedTask} />
            </Paper>
          </Grid>
        )}
      </Grid>
      
      <Fab 
        color="primary" 
        aria-label="add" 
        sx={{ position: 'fixed', bottom: 32, right: 32 }}
        onClick={handleOpenNewTaskModal}
      >
        <AddIcon />
      </Fab>

      {selectedTask && (
        <TaskDetailModal 
          task={selectedTask} 
          onSave={handleSaveTask} 
          onClose={() => setSelectedTask(null)}
          assigneeOptions={assigneeOptions}
          categoryOptions={categoryOptions}
          tagOptions={tagOptions}
        />
      )}

      {/* ▼▼▼ 設定モーダルを追加 ▼▼▼ */}
      <DashboardSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={dashboardSettings}
        onSave={handleSaveSettings}
      />
    </Box>
  );
}