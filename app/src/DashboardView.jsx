import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Box, Grid, Paper, Typography, Fab, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import TaskIcon from '@mui/icons-material/Task';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import DonutLargeIcon from '@mui/icons-material/DonutLarge';
import { TaskCalendar } from './TaskCalendar';
import { DashboardTaskList } from './DashboardTaskList';
import { TaskDetailModal } from './TaskDetailModal';
import { DashboardSettingsModal } from './DashboardSettingsModal';
import { StatCard } from './StatCard';
import { addDays, startOfToday } from 'date-fns';
import { normalizeTask, normalizeTasks } from './taskUtils';

const API_URL = '/api';

const defaultSettings = {
  showHighPriority: true,
  showMyTasks: true,
  showUpcoming: true,
};
const arraysEqual = (a = [], b = []) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

export function DashboardView({ user }) {
  const [allTasks, setAllTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [assigneeOptions, setAssigneeOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [tagOptions, setTagOptions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [dashboardSettings, setDashboardSettings] = useState(() => {
    const savedSettings = localStorage.getItem('dashboardSettings');
    return savedSettings ? JSON.parse(savedSettings) : defaultSettings;
  });

  useEffect(() => {
    Promise.all([
      axios.get(`${API_URL}/GetTasks`),
      axios.get(`${API_URL}/GetAllUsers`),
      axios.get(`${API_URL}/GetCategories`)
    ]).then(([tasksRes, usersRes, categoriesRes]) => {
      const normalized = normalizeTasks(tasksRes.data);
      setAllTasks(normalized);

      const assignees = usersRes.data.map(u => u.displayName);
      setAssigneeOptions(assignees);

      const categoryData = Array.isArray(categoriesRes.data) ? categoriesRes.data : [];
      setCategories(categoryData);
    });
  }, []);

  useEffect(() => {
    const apiCategoryNames = (Array.isArray(categories) ? categories : [])
      .map((category) => (typeof category?.name === 'string' ? category.name.trim() : ''))
      .filter(Boolean);

    const taskCategoryNames = allTasks
      .map((task) => (typeof task?.category === 'string' ? task.category.trim() : ''))
      .filter(Boolean);

    const mergedCategories = Array.from(new Set([...apiCategoryNames, ...taskCategoryNames])).sort();

    setCategoryOptions((prev) => (arraysEqual(prev, mergedCategories) ? prev : mergedCategories));

    const derivedTags = Array.from(
      new Set(
        allTasks
          .flatMap((task) => (Array.isArray(task?.tags) ? task.tags : []))
          .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
          .filter(Boolean)
      )
    ).sort();

    setTagOptions((prev) => (arraysEqual(prev, derivedTags) ? prev : derivedTags));
  }, [allTasks, categories]);

  const categoryColorMap = useMemo(() => {
    const map = {};
    (Array.isArray(categories) ? categories : []).forEach((category) => {
      if (typeof category?.name === 'string' && category.name.trim()) {
        map[category.name.trim()] = category.color || '#9e9e9e';
      }
    });
    return map;
  }, [categories]);
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
      const savedTask = normalizeTask(res.data);
      const updatedTasks = taskToSave.id
        ? allTasks.map(t => t.id === savedTask.id ? savedTask : t)
        : [...allTasks, savedTask];
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
      title: '',
      description: '',
      status: 'Started',
      priority: 'Medium',
      importance: 1,
      category: null,
      assignees: [],
      assignee: null,
      tags: [],
      deadline: null,
    });
  };

  const handleSaveSettings = (newSettings) => {
    localStorage.setItem('dashboardSettings', JSON.stringify(newSettings));
    setDashboardSettings(newSettings);
    setSettingsOpen(false);
  };

  const highPriorityTasks = useMemo(
    () => allTasks.filter(task => task.priority === 'High'),
    [allTasks]
  );

  const myTasks = useMemo(() => {
    if (!user || !user.userDetails) return [];
    return allTasks.filter(task => Array.isArray(task.assignees) && task.assignees.includes(user.userDetails));
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

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <StatCard title="総タスク数" value={taskStats.total} icon={<TaskIcon sx={{ fontSize: 40 }} />} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard title="完了済" value={taskStats.done} icon={<TaskAltIcon sx={{ fontSize: 40 }} />} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard title="進行中" value={taskStats.inProgress} icon={<DonutLargeIcon sx={{ fontSize: 40 }} />} />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: '60vh', minHeight: 500 }}>
            <Typography variant="h6" gutterBottom>カレンダービュー</Typography>
            <TaskCalendar
              tasks={allTasks}
              categoryColors={categoryColorMap}
              onTaskSelect={(task) => setSelectedTask(normalizeTask(task))}
            />
          </Paper>
        </Grid>

        {dashboardSettings.showHighPriority && (
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, height: 'auto', mb: 2 }}>
              <Typography variant="h6" gutterBottom>重要度の高いタスク</Typography>
              <DashboardTaskList tasks={highPriorityTasks} onTaskClick={(task) => setSelectedTask(normalizeTask(task))} />
            </Paper>
          </Grid>
        )}

        {dashboardSettings.showMyTasks && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: 'auto' }}>
              <Typography variant="h6">あなたの担当タスク</Typography>
              <DashboardTaskList tasks={myTasks} onTaskClick={(task) => setSelectedTask(normalizeTask(task))} />
            </Paper>
          </Grid>
        )}

        {dashboardSettings.showUpcoming && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: 'auto' }}>
              <Typography variant="h6">7日以内に期限を迎えるタスク</Typography>
              <DashboardTaskList tasks={upcomingTasks} onTaskClick={(task) => setSelectedTask(normalizeTask(task))} />
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
          task={normalizeTask(selectedTask)}
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
