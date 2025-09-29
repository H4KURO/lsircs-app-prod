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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CircleIcon from '@mui/icons-material/Circle';
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

const statusColorMap = {
  Done: 'success.main',
  Inprogress: 'warning.main',
  Started: 'info.main',
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
  const [selectedCategories, setSelectedCategories] = useState(() => loadSelectedCategories());
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => {
    Promise.all([
      axios.get(`${API_URL}/GetTasks`),
      axios.get(`${API_URL}/GetAllUsers`)
    ]).then(([tasksRes, usersRes]) => {
      const normalizedTasks = normalizeTasks(tasksRes.data);
      setTasks(normalizedTasks);

      const assignees = usersRes.data.map(user => user.displayName);
      setAssigneeOptions(assignees);
    });
  }, []);

  const derivedCategories = useMemo(() => extractCategoryList(tasks).sort(sortByName), [tasks]);
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

  const handleOpenCreateModal = () => {
    setSelectedTask({
      title: '',
      description: '',
      status: 'Started',
      priority: 'Medium',
      importance: 1,
      category: selectedCategories[0] && selectedCategories[0] !== DEFAULT_CATEGORY_LABEL
        ? selectedCategories[0]
        : null,
      assignees: [],
      assignee: null,
      tags: [],
      deadline: null,
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h4" component="h1" sx={{ flexGrow: 1 }}>
          タスク管理
        </Typography>
        <Button
          startIcon={<AddIcon />}
          variant="contained"
          onClick={handleOpenCreateModal}
        >
          タスクを追加
        </Button>
      </Box>

      <Paper elevation={1} sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        <Typography variant="subtitle1">表示するカテゴリ</Typography>
        <Autocomplete
          sx={{ minWidth: 280, flexGrow: 1, maxWidth: 480 }}
          multiple
          options={categoryOptions}
          value={selectedCategories}
          onChange={handleCategorySelectionChange}
          renderInput={(params) => <TextField {...params} label="カテゴリを選択" placeholder="カテゴリ名" />}
        />
        <Button variant="outlined" size="small" onClick={handleResetSelection}>
          全て表示
        </Button>
      </Paper>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {selectedCategories.length === 0 ? (
          <Paper sx={{ p: 4, minWidth: 320, flex: '1 1 320px' }}>
            <Typography color="text.secondary">
              表示するカテゴリがありません。カテゴリを選択してください。
            </Typography>
          </Paper>
        ) : (
          selectedCategories.map((category) => {
            const tagsInCategory = categoryToTagsMap[category] || {};
            const sortedTags = Object.keys(tagsInCategory).sort(sortByName);

            return (
              <Paper
                key={category}
                sx={{
                  p: 2,
                  minWidth: 320,
                  flex: '1 1 360px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6">{category === DEFAULT_CATEGORY_LABEL ? 'カテゴリ未設定' : category}</Typography>
                  <Chip label={`${Object.values(tagsInCategory).reduce((count, items) => count + items.length, 0)} 件`} size="small" />
                </Box>
                <Divider />

                <Box
                  sx={{
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  }}
                >
                  {sortedTags.map((tag) => {
                    const tasksForTag = tagsInCategory[tag] || [];
                    return (
                      <Paper key={`${category}-${tag}`} variant="outlined" sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="subtitle1">
                            {tag === DEFAULT_TAG_LABEL ? 'タグ未設定' : tag}
                          </Typography>
                          <Chip label={`${tasksForTag.length} 件`} size="small" />
                        </Box>
                        <Stack spacing={1.5}>
                          {tasksForTag.map((task) => (
                            <Paper key={task.id} variant="outlined" sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                <CircleIcon sx={{ color: getStatusColor(task.status), fontSize: '1rem', mt: 0.5 }} />
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
                                      <Chip label={`担当: ${task.assignees.join(', ')}`} size="small" />
                                    )}
                                    {task.deadline && (
                                      <Chip label={`期限: ${getDeadlineLabel(task.deadline)}`} size="small" />
                                    )}
                                  </Stack>
                                </Box>
                              </Box>
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
                          ))}
                          {tasksForTag.length === 0 && (
                            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                              タスクはありません
                            </Paper>
                          )}
                        </Stack>
                      </Paper>
                    );
                  })}
                  {sortedTags.length === 0 && (
                    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                      タグに紐づいたタスクがありません。
                    </Paper>
                  )}
                </Box>
              </Paper>
            );
          })
        )}
      </Box>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onSave={handleSaveTask}
          onClose={() => setSelectedTask(null)}
          assigneeOptions={assigneeOptions}
          categoryOptions={categoryOptions.map((category) => (category === DEFAULT_CATEGORY_LABEL ? '' : category))}
          tagOptions={tagOptions}
        />
      )}
    </Box>
  );
}
