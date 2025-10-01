import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Box,
  Button,
  Typography,
  Paper,
  IconButton,
  Autocomplete,
  TextField,
  Chip,
  Stack,
  Divider,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  LinearProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CircleIcon from '@mui/icons-material/Circle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { TaskDetailModal } from './TaskDetailModal';
import {
  normalizeTask,
  normalizeTasks,
  extractCategoryList,
  extractTagList,
  groupTasksByCategoryAndTag,
  DEFAULT_CATEGORY_LABEL,
  DEFAULT_TAG_LABEL,
} from './taskUtils';

const API_URL = '/api';
const STORAGE_KEY_SELECTED_CATEGORIES = 'taskViewSelectedCategories';
const STORAGE_KEY_SORT_MODE = 'taskViewSortMode';

const statusColorMap = {
  Done: 'success.main',
  Inprogress: 'warning.main',
  Started: 'info.main',
};

const STATUS_DEFINITIONS = [
  { value: 'Started', label: '未着手' },
  { value: 'Inprogress', label: '進行中' },
  { value: 'Done', label: '完了' },
];

const UNKNOWN_STATUS_KEY = '__unknown';
const DEFAULT_STATUS_LABEL = 'ステータス未設定';

const statusOrderMap = STATUS_DEFINITIONS.reduce((acc, definition, index) => {
  acc[definition.value] = index;
  return acc;
}, {});

const statusLabelMap = STATUS_DEFINITIONS.reduce((acc, definition) => {
  acc[definition.value] = definition.label;
  return acc;
}, {});

const TASK_SORT_OPTIONS = [
  { value: 'statusDeadline', label: '進捗度 → 期限（標準）' },
  { value: 'deadlineAsc', label: '期限が近い順' },
  { value: 'deadlineDesc', label: '期限が遠い順' },
  { value: 'titleAsc', label: 'タイトル昇順' },
];

const sortLabelMap = TASK_SORT_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const calculateSubtaskSummary = (subtasks = []) => {
  if (!Array.isArray(subtasks) || subtasks.length === 0) {
    return { total: 0, completed: 0, percent: 0 };
  }
  const completed = subtasks.filter((subtask) => subtask?.completed).length;
  const total = subtasks.length;
  const percent = Math.round((completed / total) * 100);
  return { total, completed, percent };
};

const getStatusColor = (status) => statusColorMap[status] || 'action.disabled';

const getDeadlineLabel = (deadline) => {
  if (!deadline) return null;
  try {
    return new Date(deadline).toISOString().split('T')[0];
  } catch {
    return deadline;
  }
};

const getCategoryLabel = (category) => (category === DEFAULT_CATEGORY_LABEL ? 'カテゴリ未設定' : category);

const getTagLabel = (tag) => (tag === DEFAULT_TAG_LABEL ? 'タグ未設定' : tag);

const getStatusLabel = (statusKey) => {
  if (!statusKey || statusKey === UNKNOWN_STATUS_KEY) {
    return DEFAULT_STATUS_LABEL;
  }
  return statusLabelMap[statusKey] || statusKey;
};

const normalizeStatusKey = (status) => {
  if (!status) {
    return UNKNOWN_STATUS_KEY;
  }
  return Object.prototype.hasOwnProperty.call(statusOrderMap, status) ? status : UNKNOWN_STATUS_KEY;
};

const getStatusRank = (status) => {
  if (Object.prototype.hasOwnProperty.call(statusOrderMap, status)) {
    return statusOrderMap[status];
  }
  return STATUS_DEFINITIONS.length;
};

const getDeadlineValue = (deadline) => {
  if (!deadline) {
    return Number.POSITIVE_INFINITY;
  }
  const value = Date.parse(deadline);
  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value;
};

const compareTitleAsc = (a, b) => {
  return (a.title || '').localeCompare(b.title || '', 'ja');
};

const compareDeadlineAsc = (a, b) => {
  const diff = getDeadlineValue(a.deadline) - getDeadlineValue(b.deadline);
  if (diff !== 0) {
    return diff;
  }
  return compareTitleAsc(a, b);
};

const compareDeadlineDesc = (a, b) => {
  const diff = getDeadlineValue(b.deadline) - getDeadlineValue(a.deadline);
  if (diff !== 0) {
    return diff;
  }
  return compareTitleAsc(a, b);
};

const sortTasksByMode = (tasks, mode) => {
  const sorted = [...tasks];
  switch (mode) {
    case 'statusDeadline':
      sorted.sort((a, b) => {
        const statusDiff = getStatusRank(normalizeStatusKey(a.status)) - getStatusRank(normalizeStatusKey(b.status));
        if (statusDiff !== 0) {
          return statusDiff;
        }
        return compareDeadlineAsc(a, b);
      });
      return sorted;
    case 'deadlineAsc':
      return sorted.sort(compareDeadlineAsc);
    case 'deadlineDesc':
      return sorted.sort(compareDeadlineDesc);
    case 'titleAsc':
      return sorted.sort(compareTitleAsc);
    default:
      return sorted;
  }
};

const groupTasksByStatus = (tasks) => {
  const grouped = new Map();

  tasks.forEach((task) => {
    const key = normalizeStatusKey(task.status);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(task);
  });

  const orderedKeys = [...STATUS_DEFINITIONS.map((definition) => definition.value)];
  if (grouped.has(UNKNOWN_STATUS_KEY)) {
    orderedKeys.push(UNKNOWN_STATUS_KEY);
  }

  return orderedKeys
    .filter((key) => grouped.has(key))
    .map((key) => ({
      key,
      label: getStatusLabel(key),
      tasks: grouped.get(key).slice().sort(compareDeadlineAsc),
    }));
};

const prepareTasksForDisplay = (tasks, mode) => {
  if (mode === 'statusDeadline') {
    return groupTasksByStatus(tasks);
  }

  return [
    {
      key: mode,
      label: sortLabelMap[mode] || '並び替え',
      tasks: sortTasksByMode(tasks, mode),
    },
  ];
};

const loadSelectedCategories = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_SELECTED_CATEGORIES);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.warn('Failed to load task category preferences', error);
    return [];
  }
};

const persistSelectedCategories = (categories) => {
  try {
    localStorage.setItem(STORAGE_KEY_SELECTED_CATEGORIES, JSON.stringify(categories));
  } catch (error) {
    console.warn('Failed to persist task category preferences', error);
  }
};

const loadSortMode = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_SORT_MODE);
    return stored && sortLabelMap[stored] ? stored : 'statusDeadline';
  } catch (error) {
    console.warn('Failed to load task sort preference', error);
    return 'statusDeadline';
  }
};

const persistSortMode = (mode) => {
  try {
    localStorage.setItem(STORAGE_KEY_SORT_MODE, mode);
  } catch (error) {
    console.warn('Failed to persist task sort preference', error);
  }
};

function sortByName(a, b) {
  return a.localeCompare(b, 'ja');
}

function normalizeSelection(selection = [], options = []) {
  const optionSet = new Set(options);
  return selection.filter((item) => optionSet.has(item));
}

function areArraysEqual(a = [], b = []) {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
}

export function TaskView() {
  const [tasks, setTasks] = useState([]);
  const [assigneeOptions, setAssigneeOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [tagOptions, setTagOptions] = useState([]);
  const [automationRules, setAutomationRules] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState(() => loadSelectedCategories());
  const [sortMode, setSortMode] = useState(() => loadSortMode());
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [tasksRes, usersRes, rulesRes] = await Promise.all([
          axios.get(`${API_URL}/GetTasks`),
          axios.get(`${API_URL}/GetAllUsers`),
          axios.get(`${API_URL}/GetAutomationRules`).catch((error) => {
            console.error('Failed to load automation rules', error);
            return { data: [] };
          }),
        ]);

        const normalizedTasks = normalizeTasks(tasksRes.data);
        setTasks(normalizedTasks);

        const assignees = usersRes.data.map((user) => user.displayName);
        setAssigneeOptions(assignees);

        const rulesData = Array.isArray(rulesRes?.data) ? rulesRes.data : [];
        setAutomationRules(rulesData);
      } catch (error) {
        console.error('Failed to load task data', error);
      }
    };

    loadInitialData();
  }, []);

  const derivedCategories = useMemo(
    () => extractCategoryList(tasks).sort(sortByName),
    [tasks],
  );
  const derivedTags = useMemo(() => extractTagList(tasks).sort(sortByName), [tasks]);

  useEffect(() => {
    if (!areArraysEqual(categoryOptions, derivedCategories)) {
      setCategoryOptions(derivedCategories);
    }
  }, [derivedCategories, categoryOptions]);

  useEffect(() => {
    if (!areArraysEqual(tagOptions, derivedTags)) {
      setTagOptions(derivedTags);
    }
  }, [derivedTags, tagOptions]);

  useEffect(() => {
    if (derivedCategories.length === 0) {
      if (selectedCategories.length !== 0) {
        setSelectedCategories([]);
      }
      return;
    }

    if (selectedCategories.length === 0) {
      setSelectedCategories(derivedCategories);
      return;
    }

    const normalized = normalizeSelection(selectedCategories, derivedCategories);
    if (normalized.length === 0) {
      setSelectedCategories(derivedCategories);
    } else if (!areArraysEqual(normalized, selectedCategories)) {
      setSelectedCategories(normalized);
    }
  }, [derivedCategories, selectedCategories]);

  useEffect(() => {
    if (selectedCategories.length > 0) {
      persistSelectedCategories(selectedCategories);
    }
  }, [selectedCategories]);

  useEffect(() => {
    if (sortMode) {
      persistSortMode(sortMode);
    }
  }, [sortMode]);
  const categoryToTagsMap = useMemo(() => {
    if (selectedCategories.length === 0) {
      return {};
    }

    const grouped = groupTasksByCategoryAndTag(tasks);
    const result = {};

    selectedCategories.forEach((category) => {
      result[category] = grouped[category] || { [DEFAULT_TAG_LABEL]: [] };
    });

    return result;
  }, [tasks, selectedCategories]);

  const statusSummary = useMemo(() => {
    return tasks.reduce((acc, task) => {
      const key = normalizeStatusKey(task.status);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [tasks]);

  const upcomingDeadlines = useMemo(() => {
    return tasks
      .filter((task) => task.deadline)
      .map((task) => {
        const timestamp = Date.parse(task.deadline);
        if (Number.isNaN(timestamp)) {
          return null;
        }
        return { task, timestamp };
      })
      .filter(Boolean)
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, 3)
      .map(({ task }) => task);
  }, [tasks]);

  const handleOpenCreateModal = () => {
    setSelectedTask({
      title: '',
      description: '',
      status: 'Started',
      priority: 'Medium',
      importance: 1,
      category:
        selectedCategories[0] && selectedCategories[0] !== DEFAULT_CATEGORY_LABEL
          ? selectedCategories[0]
          : null,
      assignees: [],
      assignee: null,
      tags: [],
      deadline: null,
      subtasks: [],
    });
  };

  const handleSaveTask = (taskToSave) => {
    const apiCall = taskToSave.id
      ? axios.put(`${API_URL}/UpdateTask/${taskToSave.id}`, taskToSave)
      : axios.post(`${API_URL}/CreateTask`, taskToSave);

    apiCall
      .then((res) => {
        const savedTask = normalizeTask(res.data);
        setTasks((prev) => {
          const exists = prev.some((task) => task.id === savedTask.id);
          if (exists) {
            return prev.map((task) => (task.id === savedTask.id ? savedTask : task));
          }
          return [...prev, savedTask];
        });
      })
      .catch((error) => {
        console.error('Task save error:', error);
        alert('タスクの保存に失敗しました。');
      })
      .finally(() => {
        setSelectedTask(null);
      });
  };

  const handleDeleteTask = (taskId) => {
    axios.delete(`${API_URL}/DeleteTask/${taskId}`).then(() => {
      setTasks((prev) => prev.filter((task) => task.id !== taskId));
    });
  };

  const handleEditTask = (task) => {
    setSelectedTask(normalizeTask(task));
  };

  const handleCategorySelectionChange = (event, newValue) => {
    if (!newValue || newValue.length === 0) {
      setSelectedCategories(categoryOptions);
      return;
    }
    setSelectedCategories(newValue);
  };

  const handleResetSelection = () => {
    setSelectedCategories(categoryOptions);
  };

  const handleSortModeChange = (event) => {
    setSortMode(event.target.value);
  };

  const handleToggleSubtaskCompletion = (taskId, subtaskId) => {
    setTasks((prevTasks) => {
      const targetTask = prevTasks.find((candidate) => candidate.id === taskId);
      if (!targetTask) {
        return prevTasks;
      }

      const updatedTask = {
        ...targetTask,
        subtasks: (targetTask.subtasks || []).map((subtask) =>
          subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask
        ),
      };

      const updatedTasks = prevTasks.map((candidate) =>
        candidate.id === taskId ? updatedTask : candidate
      );

      axios
        .put(`${API_URL}/UpdateTask/${taskId}`, updatedTask)
        .then((res) => {
          const savedTask = normalizeTask(res.data);
          setTasks((current) =>
            current.map((candidate) => (candidate.id === savedTask.id ? savedTask : candidate))
          );
        })
        .catch((error) => {
          console.error('Failed to update subtask status', error);
          alert('サブタスクの更新に失敗しました。');
          setTasks(prevTasks);
        });

      return updatedTasks;
    });
  };

  const navCategories = selectedCategories.length > 0 ? selectedCategories : categoryOptions;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        gap: { xs: 2, md: 3 },
        minHeight: '100%',
      }}
    >
      <Paper
        component="header"
        sx={{
          p: { xs: 2, md: 3 },
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: { xs: 'stretch', md: 'center' },
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box sx={{ flex: '1 1 260px' }}>
          <Typography variant="h4" component="h1">
            タスク管理
          </Typography>
          <Typography variant="body2" color="text.secondary">
            カテゴリとタグごとにチームの作業状況を確認できます。
          </Typography>
        </Box>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            flex: { xs: '1 1 100%', md: '1 1 240px' },
            flexWrap: 'wrap',
          }}
        >
          <Chip label={`合計 ${tasks.length} 件`} color="primary" size="small" />
          {STATUS_DEFINITIONS.map((definition) => {
            const count = statusSummary[definition.value] || 0;
            if (count === 0) {
              return null;
            }
            return (
              <Chip
                key={definition.value}
                label={`${definition.label}: ${count} 件`}
                size="small"
                icon={<CircleIcon sx={{ color: getStatusColor(definition.value), fontSize: '0.875rem !important' }} />}
                variant="outlined"
                sx={{
                  color: getStatusColor(definition.value),
                  borderColor: getStatusColor(definition.value),
                }}
              />
            );
          })}
          {statusSummary[UNKNOWN_STATUS_KEY] ? (
            <Chip
              label={`${getStatusLabel(UNKNOWN_STATUS_KEY)}: ${statusSummary[UNKNOWN_STATUS_KEY]} 件`}
              size="small"
              variant="outlined"
              icon={<CircleIcon sx={{ color: getStatusColor('unknown'), fontSize: '0.875rem !important' }} />}
            />
          ) : null}
        </Stack>
        <Button
          startIcon={<AddIcon />}
          variant="contained"
          onClick={handleOpenCreateModal}
          sx={{
            alignSelf: { xs: 'stretch', md: 'center' },
            flex: { xs: '1 1 100%', md: '0 0 auto' },
          }}
        >
          タスクを追加
        </Button>
      </Paper>

      <Box
        component="section"
        sx={{
          display: 'grid',
          gap: { xs: 2, md: 3 },
          gridTemplateColumns: {
            xs: '1fr',
            md: '260px 1fr',
            lg: '260px 1fr 320px',
          },
          gridTemplateAreas: {
            xs: '"nav" "main" "aside"',
            md: '"nav main" "aside aside"',
            lg: '"nav main aside"',
          },
          alignItems: 'start',
        }}
      >
        <Paper
          sx={{
            gridArea: 'nav',
            p: { xs: 2, md: 3 },
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            position: { lg: 'sticky' },
            top: { lg: 24 },
            alignSelf: 'start',
          }}
        >
          <Typography variant="h6">表示設定</Typography>
          <Typography variant="body2" color="text.secondary">
            表示するカテゴリや並び順を選択してください。選択内容は次回開く際にも復元されます。
          </Typography>
          <Autocomplete
            multiple
            size="small"
            options={categoryOptions}
            value={selectedCategories}
            onChange={handleCategorySelectionChange}
            renderInput={(params) => (
              <TextField {...params} label="カテゴリ選択" placeholder="カテゴリ" />
            )}
          />
          <Button variant="outlined" size="small" onClick={handleResetSelection}>
            すべて表示
          </Button>
          <FormControl size="small">
            <InputLabel id="task-sort-mode-label">並び順</InputLabel>
            <Select
              labelId="task-sort-mode-label"
              value={sortMode}
              label="並び順"
              onChange={handleSortModeChange}
            >
              {TASK_SORT_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Divider />
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              タグの一覧
            </Typography>
            <Stack spacing={1.5}>
              {navCategories.length > 0 ? (
                navCategories.map((category) => {
                  const tagsInCategory = categoryToTagsMap[category] || {};
                  const sortedTags = Object.keys(tagsInCategory).sort(sortByName);
                  return (
                    <Box key={`nav-${category}`}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {getCategoryLabel(category)}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 0.5 }}>
                        {sortedTags.length > 0 ? (
                          sortedTags.map((tag) => (
                            <Chip key={`nav-${category}-${tag}`} label={getTagLabel(tag)} size="small" />
                          ))
                        ) : (
                          <Chip label="タグはありません" size="small" variant="outlined" />
                        )}
                      </Stack>
                    </Box>
                  );
                })
              ) : (
                <Typography variant="body2" color="text.secondary">
                  データが読み込まれるとカテゴリ一覧が表示されます。
                </Typography>
              )}
            </Stack>
          </Box>
        </Paper>

        <Box
          sx={{
            gridArea: 'main',
            display: 'flex',
            flexDirection: 'column',
            gap: { xs: 2, md: 3 },
          }}
        >
          <Paper sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h6">タスク一覧</Typography>
            <Typography variant="body2" color="text.secondary">
              カテゴリごとにカードを整理しています。並び替えは左のメニューから変更できます。
            </Typography>
          </Paper>

          {selectedCategories.length === 0 ? (
            <Paper sx={{ p: { xs: 3, md: 4 } }}>
              <Typography color="text.secondary">
                表示するカテゴリが選択されていません。左のメニューからカテゴリを選択してください。
              </Typography>
            </Paper>
          ) : (
            selectedCategories.map((category) => {
              const tagsInCategory = categoryToTagsMap[category] || {};
              const sortedTags = Object.keys(tagsInCategory).sort(sortByName);
              const totalCount = Object.values(tagsInCategory).reduce(
                (count, items) => count + items.length,
                0,
              );

              return (
                <Paper
                  key={category}
                  sx={{
                    p: { xs: 2, md: 3 },
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">{getCategoryLabel(category)}</Typography>
                    <Chip label={`${totalCount} 件`} size="small" />
                  </Box>
                  <Divider />

                  <Box
                    sx={{
                      display: 'grid',
                      gap: 2,
                      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    }}
                  >
                    {sortedTags.map((tag) => {
                      const tasksForTag = tagsInCategory[tag] || [];
                      const sections = prepareTasksForDisplay(tasksForTag, sortMode);
                      const hasTasks = tasksForTag.length > 0;

                      return (
                        <Paper
                          key={`${category}-${tag}`}
                          variant="outlined"
                          sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="subtitle1">{getTagLabel(tag)}</Typography>
                            <Chip label={`${tasksForTag.length} 件`} size="small" />
                          </Box>
                          {hasTasks ? (
                            <Stack spacing={2}>
                              {sections.map((section) => (
                                <Box key={`${category}-${tag}-${section.key}`} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                  {sections.length > 1 && (
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <Typography variant="subtitle2" color="text.secondary">
                                        {section.label}
                                      </Typography>
                                      <Chip label={`${section.tasks.length} 件`} size="small" variant="outlined" />
                                    </Box>
                                  )}
                                  <Stack spacing={1.5}>
                                    {section.tasks.map((task) => {
                                      const subtaskSummary = calculateSubtaskSummary(task.subtasks);
                                      const hasSubtasks = subtaskSummary.total > 0;

                                      return (
                                        <Paper
                                        key={task.id}
                                        variant="outlined"
                                        sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}
                                      >
                                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                          <CircleIcon sx={{ color: getStatusColor(task.status), fontSize: "1rem", mt: 0.5 }} />
                                          <Box sx={{ flexGrow: 1 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                              {task.title || 'タイトル未設定'}
                                            </Typography>
                                            {task.description && (
                                              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                                                {task.description}
                                              </Typography>
                                            )}
                                          <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                                            {Array.isArray(task.assignees) && task.assignees.length > 0 && (
                                              <Chip label={`担当: ${task.assignees.join(", ")}`} size="small" />
                                            )}
                                            {task.deadline && (
                                              <Chip label={`期限: ${getDeadlineLabel(task.deadline)}`} size="small" />
                                            )}
                                            <Chip label={`進捗: ${getStatusLabel(task.status)}`} size="small" variant="outlined" />
                                            {hasSubtasks && (
                                              <Chip
                                                label={`サブタスク: ${subtaskSummary.completed}/${subtaskSummary.total}`}
                                                size="small"
                                                color={subtaskSummary.completed === subtaskSummary.total ? 'success' : 'default'}
                                              />
                                            )}
                                          </Stack>
                                          </Box>
                                        </Box>

                                        {hasSubtasks ? (
                                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                            <Stack direction="row" spacing={1} alignItems="center">
                                              <LinearProgress
                                                variant="determinate"
                                                value={subtaskSummary.percent}
                                                sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
                                              />
                                              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 72, textAlign: 'right' }}>
                                                {subtaskSummary.percent}%
                                              </Typography>
                                            </Stack>
                                            <Stack spacing={0.75}>
                                              {task.subtasks.map((subtask) => (
                                                <Box
                                                  key={subtask.id}
                                                  sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1,
                                                    p: 0.75,
                                                    borderRadius: 1,
                                                    backgroundColor: subtask.completed ? 'action.selected' : 'transparent',
                                                  }}
                                                >
                                                  <Checkbox
                                                    checked={Boolean(subtask.completed)}
                                                    onChange={() => handleToggleSubtaskCompletion(task.id, subtask.id)}
                                                    icon={<RadioButtonUncheckedIcon fontSize="small" />}
                                                    checkedIcon={<CheckCircleIcon fontSize="small" />}
                                                    size="small"
                                                  />
                                                  <Typography
                                                    variant="body2"
                                                    sx={{
                                                      textDecoration: subtask.completed ? 'line-through' : 'none',
                                                      color: subtask.completed ? 'text.disabled' : 'text.primary',
                                                      flexGrow: 1,
                                                    }}
                                                  >
                                                    {subtask.title || '名称未設定のサブタスク'}
                                                  </Typography>
                                                </Box>
                                              ))}
                                            </Stack>
                                          </Box>
                                        ) : (
                                          <Typography variant="body2" color="text.secondary">
                                            サブタスクはまだ追加されていません。
                                          </Typography>
                                        )}

                                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                                          <Tooltip title="編集">
                                            <IconButton size="small" onClick={() => handleEditTask(task)}>
                                              <EditIcon fontSize="small" />
                                            </IconButton>
                                          </Tooltip>
                                          <Tooltip title="削除">
                                            <IconButton size="small" onClick={() => handleDeleteTask(task.id)}>
                                              <DeleteIcon fontSize="small" />
                                            </IconButton>
                                          </Tooltip>
                                        </Stack>
                                      </Paper>
                                      );
                                    })}
                                  </Stack>
                                </Box>
                              ))}
                            </Stack>
                          ) : (
                            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                              タスクはありません
                            </Paper>
                          )}
                        </Paper>
                      );
                    })}
                    {sortedTags.length === 0 && (
                      <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                        タグに紐づくタスクはまだありません。
                      </Paper>
                    )}
                  </Box>
                </Paper>
              );
            })
          )}
        </Box>

        <Paper
          sx={{
            gridArea: 'aside',
            p: { xs: 2, md: 3 },
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            position: { lg: 'sticky' },
            top: { lg: 24 },
            alignSelf: 'start',
          }}
        >
          <Typography variant="h6">進捗サマリー</Typography>
          <Stack spacing={1}>
            {STATUS_DEFINITIONS.map((definition) => {
              const count = statusSummary[definition.value] || 0;
              if (count === 0) {
                return null;
              }
              return (
                <Stack key={`aside-${definition.value}`} direction="row" spacing={1} alignItems="center">
                  <CircleIcon sx={{ color: getStatusColor(definition.value), fontSize: '0.875rem' }} />
                  <Typography variant="body2">
                    {definition.label}: {count} 件
                  </Typography>
                </Stack>
              );
            })}
            {statusSummary[UNKNOWN_STATUS_KEY] ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircleIcon sx={{ color: getStatusColor('unknown'), fontSize: '0.875rem' }} />
                <Typography variant="body2">
                  {getStatusLabel(UNKNOWN_STATUS_KEY)}: {statusSummary[UNKNOWN_STATUS_KEY]} 件
                </Typography>
              </Stack>
            ) : null}
            {Object.keys(statusSummary).length === 0 && (
              <Typography variant="body2" color="text.secondary">
                タスクが登録されるとステータスの内訳を表示します。
              </Typography>
            )}
          </Stack>
          <Divider />
          <Typography variant="subtitle1">直近の期限</Typography>
          <Stack spacing={1.5}>
            {upcomingDeadlines.length > 0 ? (
              upcomingDeadlines.map((task) => (
                <Box
                  key={`deadline-${task.id}`}
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    backgroundColor: 'action.hover',
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {task.title || 'タイトル未設定'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    期限: {getDeadlineLabel(task.deadline)}
                  </Typography>
                </Box>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">
                期限付きのタスクはありません。
              </Typography>
            )}
          </Stack>
        </Paper>
      </Box>

      <Paper
        component="footer"
        sx={{
          p: { xs: 2, md: 3 },
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'text.secondary',
        }}
      >
        <Typography variant="caption">
          最新の更新情報は自動的に同期されます。状況が変わったらタスクを更新してください。
        </Typography>
      </Paper>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onSave={handleSaveTask}
          onClose={() => setSelectedTask(null)}
          assigneeOptions={assigneeOptions}
          categoryOptions={categoryOptions.map((category) =>
            category === DEFAULT_CATEGORY_LABEL ? '' : category,
          )}
          automationRules={automationRules}
          tagOptions={tagOptions}
        />
      )}
    </Box>
  );
}

