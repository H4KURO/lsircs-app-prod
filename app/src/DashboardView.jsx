import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Box, Grid, Paper, Typography, Fab, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import TaskIcon from '@mui/icons-material/Task';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import DonutLargeIcon from '@mui/icons-material/DonutLarge';
import { useTranslation } from 'react-i18next';
import { TaskCalendar } from './TaskCalendar';
import { DashboardTaskList } from './DashboardTaskList';
import { TaskDetailModal } from './TaskDetailModal';
import { DashboardSettingsModal } from './DashboardSettingsModal';
import { StatCard } from './StatCard';
import { addDays, startOfToday } from 'date-fns';
import { normalizeTask, normalizeTasks, getNextTaskStatus } from './taskUtils';

const API_URL = '/api';

const defaultSettings = {
  showHighPriority: true,
  showMyTasks: true,
  showUpcoming: true,
};

const arraysEqual = (a = [], b = []) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const normalizeColorValue = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const hexMatch = trimmed.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hexMatch) {
    const hex = hexMatch[1].toLowerCase();
    if (hex.length === 3) {
      return `#${hex.split('').map((char) => char + char).join('')}`;
    }
    return `#${hex}`;
  }

  const rgbMatch = trimmed.match(/^#?rgba?\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (rgbMatch) {
    const clamp = (input) => Math.max(0, Math.min(255, Number(input)));
    const toHex = (input) => clamp(input).toString(16).padStart(2, '0');
    const [r, g, b] = rgbMatch.slice(1, 4);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  return null;
};

export function DashboardView({ user }) {
  const { t } = useTranslation();
  const [allTasks, setAllTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [assigneeOptions, setAssigneeOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [tagOptions, setTagOptions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [automationRules, setAutomationRules] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statusUpdatingIds, setStatusUpdatingIds] = useState([]);

  const [dashboardSettings, setDashboardSettings] = useState(() => {
    const savedSettings = localStorage.getItem('dashboardSettings');
    return savedSettings ? JSON.parse(savedSettings) : defaultSettings;
  });

  useEffect(() => {
    Promise.all([
      axios.get(`${API_URL}/GetTasks`),
      axios.get(`${API_URL}/GetAllUsers`),
      axios.get(`${API_URL}/GetCategories`),
      axios.get(`${API_URL}/GetAutomationRules`),
    ]).then(([tasksRes, usersRes, categoriesRes, automationRes]) => {
      const normalized = normalizeTasks(tasksRes.data);
      setAllTasks(normalized);

      const assignees = usersRes.data.map((u) => u.displayName);
      setAssigneeOptions(assignees);

      const categoryData = Array.isArray(categoriesRes.data) ? categoriesRes.data : [];
      setCategories(categoryData);

      const automationData = Array.isArray(automationRes.data) ? automationRes.data : [];
      setAutomationRules(automationData);
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
          .filter(Boolean),
      ),
    ).sort();

    setTagOptions((prev) => (arraysEqual(prev, derivedTags) ? prev : derivedTags));
  }, [allTasks, categories]);

  const categoryColorMap = useMemo(() => {
    const map = {};
    (Array.isArray(categories) ? categories : []).forEach((category) => {
      if (typeof category?.name === 'string' && category.name.trim()) {
        const key = category.name.trim();
        const normalizedColor = normalizeColorValue(category.color);
        map[key] = normalizedColor || '#9e9e9e';
      }
    });
    return map;
  }, [categories]);

  const taskStats = useMemo(() => {
    const total = allTasks.length;
    const done = allTasks.filter((t) => t.status === 'Done').length;
    const inProgress = allTasks.filter((t) => t.status === 'Inprogress').length;
    return { total, done, inProgress };
  }, [allTasks]);
  const markStatusUpdating = (taskId, updating) => {
    if (taskId == null) {
      return;
    }
    const normalizedId = String(taskId);
    setStatusUpdatingIds((prev) => {
      if (updating) {
        if (prev.includes(normalizedId)) {
          return prev;
        }
        return [...prev, normalizedId];
      }
      return prev.filter((value) => value !== normalizedId);
    });
  };

  const handleAdvanceTaskStatus = (task) => {
    if (!task) {
      return;
    }

    const taskId = task.id ?? task.taskId;
    if (taskId == null) {
      return;
    }

    const normalizedId = String(taskId);
    const baseTask = normalizeTask(
      allTasks.find((item) => String(item.id) === normalizedId) ?? task,
    );

    const nextStatus = getNextTaskStatus(baseTask.status);
    if (!nextStatus) {
      return;
    }

    const payload = { ...baseTask, status: nextStatus };

    markStatusUpdating(normalizedId, true);

    axios
      .put(`${API_URL}/UpdateTask/${taskId}`, payload)
      .then((res) => {
        const savedTask = normalizeTask(res.data);

        setAllTasks((prev) => {
          const index = prev.findIndex((item) => String(item.id) === normalizedId);
          if (index === -1) {
            return [...prev, savedTask];
          }
          const next = [...prev];
          next[index] = savedTask;
          return next;
        });

        setSelectedTask((prev) => (prev && String(prev.id) === normalizedId ? savedTask : prev));
      })
      .catch((error) => {
        console.error('Task status advance error:', error);
        alert(t('dashboard.advanceStatusError', { defaultValue: 'Failed to update task status.' }));
      })
      .finally(() => {
        markStatusUpdating(normalizedId, false);
      });
  };
  const handleSaveTask = (taskToSave) => {
    const apiCall = taskToSave.id
      ? axios.put(`${API_URL}/UpdateTask/${taskToSave.id}`, taskToSave)
      : axios.post(`${API_URL}/CreateTask`, taskToSave);

    apiCall
      .then((res) => {
        const savedTask = normalizeTask(res.data);
        const updatedTasks = taskToSave.id
          ? allTasks.map((t) => (t.id === savedTask.id ? savedTask : t))
          : [...allTasks, savedTask];
        setAllTasks(updatedTasks);
      })
      .catch((error) => {
        console.error('Task save error:', error);
        alert(t('dashboard.saveError'));
      })
      .finally(() => {
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
    () => allTasks.filter((task) => task.priority === 'High'),
    [allTasks],
  );

  const myTasks = useMemo(() => {
    if (!user || !user.userDetails) return [];
    return allTasks.filter((task) => Array.isArray(task.assignees) && task.assignees.includes(user.userDetails));
  }, [allTasks, user]);

  const upcomingTasks = useMemo(() => {
    const today = startOfToday();
    const sevenDaysLater = addDays(today, 7);
    return allTasks.filter((task) => {
      if (!task.deadline) return false;
      const deadlineDate = new Date(task.deadline);
      return deadlineDate >= today && deadlineDate <= sevenDaysLater;
    });
  }, [allTasks]);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1" sx={{ flexGrow: 1 }}>
          {t('nav.dashboard')}
        </Typography>
        <IconButton onClick={() => setSettingsOpen(true)} aria-label={t('dashboard.settingsTitle')}>
          <SettingsIcon />
        </IconButton>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <StatCard title={t('dashboard.total')} value={taskStats.total} icon={<TaskIcon sx={{ fontSize: 40 }} />} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard title={t('dashboard.completed')} value={taskStats.done} icon={<TaskAltIcon sx={{ fontSize: 40 }} />} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard
            title={t('dashboard.inProgress')}
            value={taskStats.inProgress}
            icon={<DonutLargeIcon sx={{ fontSize: 40 }} />}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: '60vh', minHeight: 500 }}>
            <Typography variant="h6" gutterBottom>
              {t('dashboard.calendar')}
            </Typography>
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
              <Typography variant="h6" gutterBottom>
                {t('dashboard.highPriority')}
              </Typography>
              <DashboardTaskList
                tasks={highPriorityTasks}
                onTaskClick={(task) => setSelectedTask(normalizeTask(task))}
                onAdvanceStatus={handleAdvanceTaskStatus}
                advancingTaskIds={statusUpdatingIds}
              />
            </Paper>
          </Grid>
        )}

        {dashboardSettings.showMyTasks && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: 'auto' }}>
              <Typography variant="h6">{t('dashboard.myTasks')}</Typography>
              <DashboardTaskList
                tasks={myTasks}
                onTaskClick={(task) => setSelectedTask(normalizeTask(task))}
                onAdvanceStatus={handleAdvanceTaskStatus}
                advancingTaskIds={statusUpdatingIds}
              />
            </Paper>
          </Grid>
        )}

        {dashboardSettings.showUpcoming && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: 'auto' }}>
              <Typography variant="h6">{t('dashboard.upcoming')}</Typography>
              <DashboardTaskList
                tasks={upcomingTasks}
                onTaskClick={(task) => setSelectedTask(normalizeTask(task))}
                onAdvanceStatus={handleAdvanceTaskStatus}
                advancingTaskIds={statusUpdatingIds}
              />
            </Paper>
          </Grid>
        )}
      </Grid>

      <Fab
        color="primary"
        aria-label={t('dashboard.addTask')}
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
          automationRules={automationRules}
          categoryColorMap={categoryColorMap}
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
