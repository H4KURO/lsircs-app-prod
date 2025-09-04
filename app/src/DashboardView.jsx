// app/src/DashboardView.jsx

import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Box, Grid, Paper, Typography, Fab, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import TaskIcon from '@mui/icons-material/Task';
import TaskAltIcon from '@mui/icons-material/TaskAlt'; // アイコンをインポート
import DonutLargeIcon from '@mui/icons-material/DonutLarge'; // アイコンをインポート
import { TaskCalendar } from './TaskCalendar';
import { DashboardTaskList } from './DashboardTaskList';
import { TaskDetailModal } from './TaskDetailModal';
import { DashboardSettingsModal } from './DashboardSettingsModal';
import { StatCard } from './StatCard'; // 作成したStatCardをインポート
import { addDays, startOfToday } from 'date-fns';

const API_URL = '/api';

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
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [dashboardSettings, setDashboardSettings] = useState(() => {
    const savedSettings = localStorage.getItem('dashboardSettings');
    return savedSettings ? JSON.parse(savedSettings) : defaultSettings;
  });

  useEffect(() => {
// 全タスクと全ユーザーのリストを両方取得する
    Promise.all([
      axios.get(`${API_URL}/GetTasks`),
      axios.get(`${API_URL}/GetAllUsers`) // ★★★ 全ユーザー取得APIを呼び出す ★★★
    ]).then(([tasksRes, usersRes]) => {
      setTasks(tasksRes.data);
      
      // ★★★ 担当者の選択肢を、全ユーザーの表示名リストに更新 ★★★
      const assignees = usersRes.data.map(user => user.displayName);
      setAssigneeOptions(assignees);
      
      const categories = [...new Set(tasksRes.data.map(t => t.category).filter(Boolean))];
      const tags = [...new Set(tasksRes.data.flatMap(t => t.tags || []).filter(Boolean))];
      setCategoryOptions(categories);
      setTagOptions(tags);
    });

  // ▼▼▼ タスクの統計情報を計算するロジックを追加 ▼▼▼
  const taskStats = useMemo(() => {
    const total = allTasks.length;
    const done = allTasks.filter(t => t.status === 'Done').length;
    const inProgress = allTasks.filter(t => t.status === 'Inprogress').length;
    return { total, done, inProgress };
  }, [allTasks]);

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
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1" sx={{ flexGrow: 1 }}>
          ダッシュボード
        </Typography>
        <IconButton onClick={() => setSettingsOpen(true)}>
          <SettingsIcon />
        </IconButton>
      </Box>
      
      {/* ▼▼▼ 統計カードの表示エリアを追加 ▼▼▼ */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <StatCard title="総タスク数" value={taskStats.total} icon={<TaskIcon sx={{ fontSize: 40 }} />} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard title="完了済み" value={taskStats.done} icon={<TaskAltIcon sx={{ fontSize: 40 }} />} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard title="進行中" value={taskStats.inProgress} icon={<DonutLargeIcon sx={{ fontSize: 40 }} />} />
        </Grid>
      </Grid>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: '60vh', minHeight: 500 }}>
            <Typography variant="h6" gutterBottom>カレンダービュー</Typography>
            <TaskCalendar onTaskSelect={setSelectedTask} />
          </Paper>
        </Grid>
        
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

      <DashboardSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={dashboardSettings}
        onSave={handleSaveSettings}
      />
    </Box>
  );
}