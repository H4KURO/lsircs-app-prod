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
import StarBorderIcon from '@mui/icons-material/StarBorder';
import StarIcon from '@mui/icons-material/Star';
import RestoreIcon from '@mui/icons-material/Restore';
import CircleIcon from '@mui/icons-material/Circle';
import { Responsive as ResponsiveGrid, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
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

const ResponsiveGridLayout = WidthProvider(ResponsiveGrid);

const API_URL = '/api';
const STORAGE_KEY_SELECTED_CATEGORIES = 'taskViewSelectedCategories';
const STORAGE_KEY_LAYOUTS = 'taskViewLayouts';
const STORAGE_KEY_FAVORITE_LAYOUT = 'taskViewFavoriteLayout';

const statusColorMap = {
  Done: 'success.main',
  Inprogress: 'warning.main',
  Started: 'info.main',
};

const GRID_COLS = { lg: 12, md: 10, sm: 8, xs: 6, xxs: 2 };
const GRID_ROW_HEIGHT = 36;
const GRID_MARGIN = [16, 16];
const GRID_BREAKPOINTS = Object.keys(GRID_COLS);
const DEFAULT_HEIGHT_UNITS = 14;

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

const loadLayouts = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_LAYOUTS);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn('Failed to load saved layouts', error);
    return null;
  }
};

const persistLayouts = (layouts) => {
  try {
    localStorage.setItem(STORAGE_KEY_LAYOUTS, JSON.stringify(layouts));
  } catch (error) {
    console.warn('Failed to persist layouts', error);
  }
};

const loadFavoriteLayout = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_FAVORITE_LAYOUT);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn('Failed to load favorite layout', error);
    return null;
  }
};

const persistFavoriteLayout = (payload) => {
  try {
    if (!payload) {
      localStorage.removeItem(STORAGE_KEY_FAVORITE_LAYOUT);
      return;
    }
    localStorage.setItem(STORAGE_KEY_FAVORITE_LAYOUT, JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to persist favorite layout', error);
  }
};

const sortByName = (a, b) => a.localeCompare(b, 'ja');

const normalizeSelection = (selection = [], options = []) => {
  const optionSet = new Set(options);
  return selection.filter((item) => optionSet.has(item));
};

const createDefaultLayoutItem = (id, index, breakpoint) => {
  const cols = GRID_COLS[breakpoint];
  const defaultWidth = Math.max(Math.floor(cols / 3), Math.min(4, cols));
  const width = Math.min(defaultWidth, cols);
  const x = (index * width) % cols;
  const y = Math.floor((index * width) / cols) * DEFAULT_HEIGHT_UNITS;
  return {
    i: id,
    x,
    y,
    w: width,
    h: DEFAULT_HEIGHT_UNITS,
    minW: Math.max(2, Math.min(width, cols)),
    minH: 8,
  };
};

const ensureLayoutsForCategories = (categories, baseLayouts) => {
  const categoryIds = categories.map((category) => `cat-${category}`);
  const categoryIdSet = new Set(categoryIds);
  const nextLayouts = {};

  GRID_BREAKPOINTS.forEach((breakpoint) => {
    const existing = Array.isArray(baseLayouts?.[breakpoint]) ? [...baseLayouts[breakpoint]] : [];
    const filtered = existing.filter((item) => categoryIdSet.has(item.i));
    const presentIds = new Set(filtered.map((item) => item.i));

    categories.forEach((category, index) => {
      const id = `cat-${category}`;
      if (!presentIds.has(id)) {
        filtered.push(createDefaultLayoutItem(id, index, breakpoint));
      }
    });

    nextLayouts[breakpoint] = filtered;
  });

  return nextLayouts;
};

const layoutsEqual = (a, b) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const keySet = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keySet) {
    const listA = Array.isArray(a[key]) ? a[key] : [];
    const listB = Array.isArray(b[key]) ? b[key] : [];
    if (listA.length !== listB.length) {
      return false;
    }
    const sortedA = [...listA].sort((x, y) => x.i.localeCompare(y.i));
    const sortedB = [...listB].sort((x, y) => x.i.localeCompare(y.i));
    for (let i = 0; i < sortedA.length; i += 1) {
      const itemA = sortedA[i];
      const itemB = sortedB[i];
      if (!itemA || !itemB) return false;
      const props = ['i', 'x', 'y', 'w', 'h', 'minW', 'minH'];
      if (props.some((prop) => itemA[prop] !== itemB[prop])) {
        return false;
      }
    }
  }
  return true;
};

export function TaskView() {
  const [tasks, setTasks] = useState([]);
  const [assigneeOptions, setAssigneeOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [tagOptions, setTagOptions] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState(() => loadSelectedCategories());
  const [selectedTask, setSelectedTask] = useState(null);
  const [layouts, setLayouts] = useState(() => loadLayouts() || {});
  const [hasFavoriteLayout, setHasFavoriteLayout] = useState(() => !!loadFavoriteLayout());

  useEffect(() => {
    Promise.all([
      axios.get(`${API_URL}/GetTasks`),
      axios.get(`${API_URL}/GetAllUsers`)
    ]).then(([tasksRes, usersRes]) => {
      const normalizedTasks = normalizeTasks(tasksRes.data);
      setTasks(normalizedTasks);

      const assignees = usersRes.data.map((user) => user.displayName);
      setAssigneeOptions(assignees);
    });
  }, []);

  const derivedCategories = useMemo(() => extractCategoryList(tasks).sort(sortByName), [tasks]);
  const derivedTags = useMemo(() => extractTagList(tasks).sort(sortByName), [tasks]);

  useEffect(() => {
    const categoriesChanged = categoryOptions.length !== derivedCategories.length
      || categoryOptions.some((value, index) => value !== derivedCategories[index]);
    if (categoriesChanged) {
      setCategoryOptions(derivedCategories);
    }
  }, [derivedCategories, categoryOptions]);

  useEffect(() => {
    const tagsChanged = tagOptions.length !== derivedTags.length
      || tagOptions.some((value, index) => value !== derivedTags[index]);
    if (tagsChanged) {
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
    } else if (normalized.length !== selectedCategories.length) {
      setSelectedCategories(normalized);
    }
  }, [derivedCategories, selectedCategories]);

  useEffect(() => {
    if (selectedCategories.length > 0) {
      persistSelectedCategories(selectedCategories);
    }
  }, [selectedCategories]);

  const ensuredLayouts = useMemo(
    () => ensureLayoutsForCategories(selectedCategories, layouts),
    [selectedCategories, layouts]
  );

  useEffect(() => {
    setLayouts((prev) => {
      if (layoutsEqual(prev, ensuredLayouts)) {
        return prev;
      }
      return ensuredLayouts;
    });
  }, [ensuredLayouts]);

  useEffect(() => {
    if (Object.keys(layouts || {}).length > 0) {
      persistLayouts(layouts);
    }
  }, [layouts]);

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

  const handleLayoutChange = (currentLayout, allLayouts) => {
    setLayouts(allLayouts);
  };

  const handleSaveFavoriteLayout = () => {
    if (selectedCategories.length === 0) {
      alert('保存するカテゴリがありません。');
      return;
    }
    persistFavoriteLayout({
      selectedCategories,
      layouts,
    });
    setHasFavoriteLayout(true);
    alert('現在のレイアウトをお気に入りとして保存しました。');
  };

  const handleLoadFavoriteLayout = () => {
    const favorite = loadFavoriteLayout();
    if (!favorite) {
      alert('お気に入りが保存されていません。');
      return;
    }
    const availableCategories = favorite.selectedCategories.filter((category) => categoryOptions.includes(category));
    if (availableCategories.length === 0) {
      alert('お気に入りに含まれるカテゴリが利用できません。');
      return;
    }
    setSelectedCategories(availableCategories);
    setLayouts(ensureLayoutsForCategories(availableCategories, favorite.layouts));
  };

  const handleClearFavoriteLayout = () => {
    persistFavoriteLayout(null);
    setHasFavoriteLayout(false);
    alert('お気に入りを削除しました。');
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

      <Stack direction="row" spacing={1} flexWrap="wrap">
        <Button
          variant="outlined"
          size="small"
          startIcon={<StarBorderIcon />}
          onClick={handleSaveFavoriteLayout}
        >
          お気に入りに保存
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<StarIcon />}
          onClick={handleLoadFavoriteLayout}
          disabled={!hasFavoriteLayout}
        >
          お気に入りを読み込み
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RestoreIcon />}
          onClick={handleClearFavoriteLayout}
          disabled={!hasFavoriteLayout}
        >
          お気に入り解除
        </Button>
      </Stack>

      <ResponsiveGridLayout
        className="task-layout"
        layouts={ensuredLayouts}
        cols={GRID_COLS}
        rowHeight={GRID_ROW_HEIGHT}
        margin={GRID_MARGIN}
        isDraggable
        isResizable
        draggableHandle=".category-card-header"
        draggableCancel=".no-drag, .MuiIconButton-root, .MuiButtonBase-root"
        onLayoutChange={handleLayoutChange}
        compactType={null}
        preventCollision
      >
        {selectedCategories.length === 0 ? (
          <div key="empty">
            <Paper sx={{ p: 4 }}>
              <Typography color="text.secondary">
                表示するカテゴリがありません。カテゴリを選択してください。
              </Typography>
            </Paper>
          </div>
        ) : (
          selectedCategories.map((category) => {
            const tagsInCategory = categoryToTagsMap[category] || {};
            const sortedTags = Object.keys(tagsInCategory).sort(sortByName);
            const totalTasks = Object.values(tagsInCategory).reduce((count, items) => count + items.length, 0);

            return (
              <div key={`cat-${category}`}>
                <Paper
                  sx={{
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    height: '100%',
                    overflow: 'hidden',
                  }}
                >
                  <Box className="category-card-header" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move' }}>
                    <Typography variant="h6" noWrap>{category === DEFAULT_CATEGORY_LABEL ? 'カテゴリ未設定' : category}</Typography>
                    <Chip label={`${totalTasks} 件`} size="small" />
                  </Box>
                  <Divider />

                  <Box
                    sx={{
                      display: 'grid',
                      gap: 2,
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      alignItems: 'start',
                      overflow: 'auto',
                    }}
                  >
                    {sortedTags.map((tag) => {
                      const tasksForTag = tagsInCategory[tag] || [];
                      return (
                        <Paper
                          key={`${category}-${tag}`}
                          variant="outlined"
                          sx={{
                            p: 1.5,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1.5,
                            height: '100%',
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="subtitle1" noWrap>
                              {tag === DEFAULT_TAG_LABEL ? 'タグ未設定' : tag}
                            </Typography>
                            <Chip label={`${tasksForTag.length} 件`} size="small" />
                          </Box>
                          <Stack spacing={1.5}>
                            {tasksForTag.map((task) => (
                              <Paper
                                key={task.id}
                                variant="outlined"
                                sx={{
                                  p: 1.5,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 1,
                                }}
                              >
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
                                <Stack direction="row" spacing={1} justifyContent="flex-end" className="no-drag">
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
              </div>
            );
          })
        )}
      </ResponsiveGridLayout>

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
