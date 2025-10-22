import { useTranslation } from 'react-i18next';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  FormControlLabel,
  Switch,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CircleIcon from '@mui/icons-material/Circle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { TaskDetailModal } from './TaskDetailModal';
import {
  normalizeTask,
  normalizeTasks,
  extractCategoryList,
  extractTagList,
  groupTasksByCategoryAndTag,
  DEFAULT_CATEGORY_LABEL,
  DEFAULT_TAG_LABEL,
  getNextTaskStatus
} from './taskUtils';

const API_URL = '/api';
const statusColorMap = {
  Done: 'success.main',
  Inprogress: 'warning.main',
  Started: 'info.main',
};

const STATUS_DEFINITIONS = [
  { value: 'Started', label: '着手前' },
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
  { value: 'statusDeadline', label: 'ステータス → 期限（昇順）' },
  { value: 'deadlineAsc', label: '期限が早い順' },
  { value: 'deadlineDesc', label: '期限が遅い順' },
  { value: 'titleAsc', label: 'タイトル順' },
];

const sortLabelMap = TASK_SORT_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const LAYOUT_OPTIONS = [
  { value: 'category', label: 'カテゴリ × タグ' },
  { value: 'status', label: '進捗（ステータス）' },
  { value: 'assignee', label: '担当者' },
];

const ALLOWED_LAYOUTS = new Set(LAYOUT_OPTIONS.map((option) => option.value));
const ALLOWED_SORT_MODES = new Set(TASK_SORT_OPTIONS.map((option) => option.value));

const DEFAULT_PREFERENCES = Object.freeze({
  layout: 'category',
  sortMode: 'statusDeadline',
  selectedCategories: [],
  selectedAssignees: [],
  includeUnassignedColumn: true,
  updatedAt: null,
});

const UNASSIGNED_ASSIGNEE_KEY = '__unassigned';
const UNASSIGNED_ASSIGNEE_LABEL = '未担当';
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

const groupTasksByAssignee = (tasks = []) => {
  const grouped = new Map();

  tasks.forEach((task, index) => {
    if (!task || typeof task !== 'object') {
      return;
    }

    const assignees = Array.isArray(task.assignees) && task.assignees.length > 0 ? task.assignees : [];
    if (assignees.length === 0) {
      if (!grouped.has(UNASSIGNED_ASSIGNEE_KEY)) {
        grouped.set(UNASSIGNED_ASSIGNEE_KEY, []);
      }
      grouped.get(UNASSIGNED_ASSIGNEE_KEY).push({ ...task, order: task.order ?? index });
      return;
    }

    assignees.forEach((assignee) => {
      const key = typeof assignee === 'string' && assignee.trim() ? assignee.trim() : UNASSIGNED_ASSIGNEE_KEY;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push({ ...task, order: task.order ?? index });
    });
  });

  return grouped;
};

function sortByName(a, b) {
  return a.localeCompare(b, 'ja');
}

function normalizeSelection(selection = [], options = []) {
  const optionSet = new Set(options);
  return selection.filter((item) => optionSet.has(item));
}

function sanitizeStringArray(value = []) {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set();
  const result = [];
  for (const entry of value) {
    if (typeof entry !== 'string') {
      continue;
    }
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
    if (result.length >= 100) {
      break;
    }
  }
  return result;
}

function normalizePreferencesForClient(preferences = {}) {
  const layout = ALLOWED_LAYOUTS.has(preferences.layout) ? preferences.layout : DEFAULT_PREFERENCES.layout;
  const sortMode = ALLOWED_SORT_MODES.has(preferences.sortMode) ? preferences.sortMode : DEFAULT_PREFERENCES.sortMode;
  const selectedCategories = sanitizeStringArray(preferences.selectedCategories);
  const selectedAssignees = sanitizeStringArray(preferences.selectedAssignees);
  const includeUnassignedColumn =
    typeof preferences.includeUnassignedColumn === 'boolean'
      ? preferences.includeUnassignedColumn
      : DEFAULT_PREFERENCES.includeUnassignedColumn;

  return {
    layout,
    sortMode,
    selectedCategories,
    selectedAssignees,
    includeUnassignedColumn,
    updatedAt:
      typeof preferences.updatedAt === 'string' && preferences.updatedAt.trim().length > 0
        ? preferences.updatedAt
        : null,
  };
}

function clonePreferences(preferences = DEFAULT_PREFERENCES) {
  const normalized = normalizePreferencesForClient(preferences);
  return {
    ...normalized,
    selectedCategories: [...normalized.selectedCategories],
    selectedAssignees: [...normalized.selectedAssignees],
  };
}

function areArraysEqual(a = [], b = []) {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
}

function arePreferencesEqual(a, b) {
  if (!a || !b) {
    return false;
  }
  return (
    a.layout === b.layout &&
    a.sortMode === b.sortMode &&
    a.includeUnassignedColumn === b.includeUnassignedColumn &&
    areArraysEqual(a.selectedCategories, b.selectedCategories) &&
    areArraysEqual(a.selectedAssignees, b.selectedAssignees)
  );
}

const getTaskCategoryKey = (task) => (task?.category?.trim() ? task.category.trim() : DEFAULT_CATEGORY_LABEL);
export function TaskView({ initialTaskId = null, onSelectedTaskChange } = {}) {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState([]);
  const [assigneeOptions, setAssigneeOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [tagOptions, setTagOptions] = useState([]);
  const [automationRules, setAutomationRules] = useState([]);
  const [preferences, setPreferences] = useState(() => clonePreferences(DEFAULT_PREFERENCES));
  const [serverPreferences, setServerPreferences] = useState(() => clonePreferences(DEFAULT_PREFERENCES));
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [statusUpdatingIds, setStatusUpdatingIds] = useState([]);

  const deepLinkHandledRef = useRef(null);
  const savePreferencesTimerRef = useRef(null);
  const latestPreferencesRef = useRef(preferences);

  const updatePreferences = useCallback((updater) => {
    setPreferences((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const normalized = clonePreferences(next);
      if (arePreferencesEqual(prev, normalized)) {
        return prev;
      }
      return normalized;
    });
  }, []);

  const markStatusUpdating = useCallback((taskId, updating) => {
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
  }, []);

  useEffect(() => {
    latestPreferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [tasksRes, usersRes, rulesRes, preferencesRes] = await Promise.all([
          axios.get(`${API_URL}/GetTasks`),
          axios.get(`${API_URL}/GetAllUsers`),
          axios.get(`${API_URL}/GetAutomationRules`).catch((error) => {
            console.error('Failed to load automation rules', error);
            return { data: [] };
          }),
          axios.get(`${API_URL}/GetTaskViewPreferences`).catch((error) => {
            console.error('Failed to load task view preferences', error);
            return { data: null };
          }),
        ]);

        const normalizedTasks = normalizeTasks(tasksRes.data);
        setTasks(normalizedTasks);

        const assignees = usersRes.data.map((user) => user.displayName);
        setAssigneeOptions(assignees);

        const rulesData = Array.isArray(rulesRes?.data) ? rulesRes.data : [];
        setAutomationRules(rulesData);

        const normalizedPreferences = clonePreferences(preferencesRes?.data || DEFAULT_PREFERENCES);
        setPreferences(normalizedPreferences);
        setServerPreferences(normalizedPreferences);
        latestPreferencesRef.current = normalizedPreferences;
        setPreferencesLoaded(true);
      } catch (error) {
        console.error('Failed to load task data', error);
        setPreferencesLoaded(true);
      }
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    if (!initialTaskId) {
      deepLinkHandledRef.current = null;
      return;
    }

    if (deepLinkHandledRef.current === initialTaskId) {
      return;
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return;
    }

    const targetTask = tasks.find((candidate) => candidate.id === initialTaskId);
    deepLinkHandledRef.current = initialTaskId;

    if (targetTask) {
      setSelectedTask(normalizeTask(targetTask));
    }
  }, [initialTaskId, tasks]);

  useEffect(() => {
    if (typeof onSelectedTaskChange === 'function') {
      onSelectedTaskChange(selectedTask ? selectedTask.id : null);
    }
  }, [onSelectedTaskChange, selectedTask]);

  const derivedCategories = useMemo(
    () => extractCategoryList(tasks).sort(sortByName),
    [tasks],
  );
  const derivedTags = useMemo(() => extractTagList(tasks).sort(sortByName), [tasks]);
  const derivedAssignees = useMemo(() => {
    const names = new Set();
    assigneeOptions.forEach((name) => {
      if (typeof name === 'string' && name.trim()) {
        names.add(name.trim());
      }
    });
    tasks.forEach((task) => {
      if (Array.isArray(task?.assignees)) {
        task.assignees.forEach((candidate) => {
          if (typeof candidate === 'string' && candidate.trim()) {
            names.add(candidate.trim());
          }
        });
      }
    });
    return Array.from(names).sort(sortByName);
  }, [assigneeOptions, tasks]);

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
    updatePreferences((prev) => {
      if (derivedCategories.length === 0) {
        if (prev.selectedCategories.length === 0) {
          return prev;
        }
        return { ...prev, selectedCategories: [] };
      }

      if (prev.selectedCategories.length === 0) {
        return { ...prev, selectedCategories: derivedCategories };
      }

      const normalized = normalizeSelection(prev.selectedCategories, derivedCategories);
      if (normalized.length === 0) {
        return { ...prev, selectedCategories: derivedCategories };
      }
      if (!areArraysEqual(normalized, prev.selectedCategories)) {
        return { ...prev, selectedCategories: normalized };
      }
      return prev;
    });
  }, [derivedCategories, updatePreferences]);

  useEffect(() => {
    updatePreferences((prev) => {
      if (derivedAssignees.length === 0) {
        if (prev.selectedAssignees.length === 0) {
          return prev;
        }
        return { ...prev, selectedAssignees: [] };
      }

      if (prev.selectedAssignees.length === 0) {
        return { ...prev, selectedAssignees: derivedAssignees };
      }

      const normalized = normalizeSelection(prev.selectedAssignees, derivedAssignees);
      if (normalized.length === 0) {
        return { ...prev, selectedAssignees: derivedAssignees };
      }
      if (!areArraysEqual(normalized, prev.selectedAssignees)) {
        return { ...prev, selectedAssignees: normalized };
      }
      return prev;
    });
  }, [derivedAssignees, updatePreferences]);

  useEffect(() => {
    if (!preferencesLoaded) {
      return undefined;
    }
    if (arePreferencesEqual(preferences, serverPreferences)) {
      return undefined;
    }

    if (savePreferencesTimerRef.current) {
      clearTimeout(savePreferencesTimerRef.current);
    }

    const payload = clonePreferences(preferences);
    savePreferencesTimerRef.current = setTimeout(() => {
      setIsSavingPreferences(true);
      axios
        .put(`${API_URL}/UpdateTaskViewPreferences`, payload)
        .then((res) => {
          const normalized = clonePreferences(res?.data || payload);
          setServerPreferences(normalized);
          const latest = latestPreferencesRef.current;
          if (arePreferencesEqual(latest, payload)) {
            setPreferences(normalized);
          }
        })
        .catch((error) => {
          console.error('Failed to save task view preferences', error);
        })
        .finally(() => {
          setIsSavingPreferences(false);
        });
    }, 600);

    return () => {
      if (savePreferencesTimerRef.current) {
        clearTimeout(savePreferencesTimerRef.current);
      }
    };
  }, [preferences, serverPreferences, preferencesLoaded]);

  useEffect(() => {
    return () => {
      if (savePreferencesTimerRef.current) {
        clearTimeout(savePreferencesTimerRef.current);
      }
    };
  }, []);

  const { layout, sortMode, selectedCategories, selectedAssignees, includeUnassignedColumn } = preferences;

  const selectedCategorySet = useMemo(() => {
    if (selectedCategories.length === 0) {
      return new Set(derivedCategories);
    }
    return new Set(selectedCategories);
  }, [selectedCategories, derivedCategories]);

  const filteredTasks = useMemo(() => {
    if (selectedCategorySet.size === 0) {
      return [];
    }
    return tasks.filter((task) => selectedCategorySet.has(getTaskCategoryKey(task)));
  }, [tasks, selectedCategorySet]);

  const categoryToTagsMap = useMemo(() => {
    const activeCategories = selectedCategories.length > 0 ? selectedCategories : derivedCategories;
    if (activeCategories.length === 0) {
      return {};
    }
    const grouped = groupTasksByCategoryAndTag(filteredTasks);
    const result = {};
    activeCategories.forEach((category) => {
      result[category] = grouped[category] || { [DEFAULT_TAG_LABEL]: [] };
    });
    return result;
  }, [filteredTasks, selectedCategories, derivedCategories]);

  const statusSummary = useMemo(() => {
    return filteredTasks.reduce((acc, task) => {
      const key = normalizeStatusKey(task.status);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [filteredTasks]);

  const upcomingDeadlines = useMemo(() => {
    return filteredTasks
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
  }, [filteredTasks]);

  const statusSections = useMemo(() => {
    if (layout !== 'status') {
      return [];
    }
    const effectiveSortMode = sortMode === 'statusDeadline' ? 'deadlineAsc' : sortMode;
    return groupTasksByStatus(filteredTasks).map((section) => ({
      ...section,
      tasks: sortTasksByMode(section.tasks, effectiveSortMode),
    }));
  }, [layout, filteredTasks, sortMode]);

  const assigneeColumns = useMemo(() => {
    if (layout !== 'assignee') {
      return [];
    }
    const effectiveSortMode = sortMode === 'statusDeadline' ? 'deadlineAsc' : sortMode;
    const grouped = groupTasksByAssignee(filteredTasks);
    const columns = [];
    const activeAssignees = selectedAssignees.length > 0 ? selectedAssignees : derivedAssignees;

    activeAssignees.forEach((assignee) => {
      const tasksForAssignee = grouped.get(assignee) || [];
      columns.push({
        key: assignee,
        label: assignee,
        tasks: sortTasksByMode(tasksForAssignee, effectiveSortMode),
      });
    });

    if (includeUnassignedColumn) {
      const unassignedTasks = grouped.get(UNASSIGNED_ASSIGNEE_KEY) || [];
      columns.push({
        key: UNASSIGNED_ASSIGNEE_KEY,
        label: UNASSIGNED_ASSIGNEE_LABEL,
        tasks: sortTasksByMode(unassignedTasks, effectiveSortMode),
      });
    }

    return columns;
  }, [layout, filteredTasks, selectedAssignees, derivedAssignees, includeUnassignedColumn, sortMode]);

  const navCategories = selectedCategories.length > 0 ? selectedCategories : derivedCategories;
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

  const handleAdvanceTaskStatus = useCallback(
    (task) => {
      if (!task) {
        return;
      }

      const taskId = task.id ?? task.taskId;
      if (taskId == null) {
        return;
      }

      const normalizedId = String(taskId);
      const baseTask = normalizeTask(
        tasks.find((candidate) => String(candidate.id) === normalizedId) ?? task,
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
          setTasks((prev) => {
            const index = prev.findIndex((candidate) => String(candidate.id) === normalizedId);
            if (index === -1) {
              return [...prev, savedTask];
            }
            const nextList = [...prev];
            nextList[index] = savedTask;
            return nextList;
          });
          setSelectedTask((prev) => (prev && String(prev.id) === normalizedId ? savedTask : prev));
        })
        .catch((error) => {
          console.error('Task status advance error:', error);
          alert(t('taskView.actions.advanceStatusError'));
        })
        .finally(() => {
          markStatusUpdating(normalizedId, false);
        });
    },
    [tasks, markStatusUpdating, t],
  );
  const handleEditTask = useCallback((task) => {
    setSelectedTask(normalizeTask(task));
  }, []);

  const handleMoveCategory = useCallback(
    (category, direction) => {
      if (!category) {
        return;
      }
      updatePreferences((prev) => {
        const baseList = prev.selectedCategories.length === 0 ? derivedCategories : prev.selectedCategories;
        if (!Array.isArray(baseList) || baseList.length === 0) {
          return prev;
        }
        const current = [...baseList];
        const index = current.indexOf(category);
        if (index === -1) {
          return prev;
        }
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= current.length) {
          return prev;
        }
        const [moved] = current.splice(index, 1);
        current.splice(targetIndex, 0, moved);
        return {
          ...prev,
          selectedCategories: current,
        };
      });
    },
    [derivedCategories, updatePreferences],
  );

  const handleCategorySelectionChange = (event, newValue) => {
    updatePreferences((prev) => ({
      ...prev,
      selectedCategories:
        !newValue || newValue.length === 0
          ? derivedCategories
          : normalizeSelection(newValue, derivedCategories),
    }));
  };

  const handleResetSelection = () => {
    updatePreferences((prev) => ({ ...prev, selectedCategories: derivedCategories }));
  };

  const handleSortModeChange = (event) => {
    const value = event.target.value;
    updatePreferences((prev) => ({
      ...prev,
      sortMode: ALLOWED_SORT_MODES.has(value) ? value : prev.sortMode,
    }));
  };

  const handleLayoutChange = (event) => {
    const value = event.target.value;
    updatePreferences((prev) => ({
      ...prev,
      layout: ALLOWED_LAYOUTS.has(value) ? value : prev.layout,
    }));
  };

  const handleAssigneeSelectionChange = (event, newValue) => {
    updatePreferences((prev) => ({
      ...prev,
      selectedAssignees:
        !newValue || newValue.length === 0
          ? derivedAssignees
          : normalizeSelection(newValue, derivedAssignees),
    }));
  };

  const handleToggleIncludeUnassigned = (event) => {
    const { checked } = event.target;
    updatePreferences((prev) => ({ ...prev, includeUnassignedColumn: checked }));
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

  const renderTaskCard = (task) => {
    const subtaskSummary = calculateSubtaskSummary(task.subtasks);
    const hasSubtasks = subtaskSummary.total > 0;
    const normalizedTaskId =
      task?.id != null ? String(task.id) : task?.taskId != null ? String(task.taskId) : null;
    const nextStatus = getNextTaskStatus(task.status);
    const nextStatusLabel = nextStatus ? getStatusLabel(nextStatus) : null;
    const isAdvancing = normalizedTaskId ? statusUpdatingIds.includes(normalizedTaskId) : false;
    const currentStatusLabel = getStatusLabel(task.status);
    const advanceTooltip = nextStatus
      ? `${currentStatusLabel} → ${nextStatusLabel}`
      : t('taskView.actions.statusMax');

    return (
      <Paper
        key={task.id}
        variant="outlined"
        sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}
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
              <Chip label={`進捗: ${currentStatusLabel}`} size="small" variant="outlined" />
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
              {(task.subtasks || []).map((subtask) => (
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
                    {subtask.title || '未設定のサブタスク'}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            サブタスクはまだありません。
          </Typography>
        )}

        <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
          <Tooltip title={advanceTooltip}>
            <span>
              <IconButton
                size="small"
                color="primary"
                onClick={() => handleAdvanceTaskStatus(task)}
                disabled={!nextStatus || isAdvancing}
                aria-label={t('taskView.actions.advanceStatus')}
                sx={{ position: 'relative' }}
              >
                <ArrowForwardIcon fontSize="small" />
                {isAdvancing && (
                  <CircularProgress
                    size={26}
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      marginTop: '-13px',
                      marginLeft: '-13px',
                    }}
                  />
                )}
              </IconButton>
            </span>
          </Tooltip>
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
  };
  const renderCategoryLayout = () => {
    if (selectedCategories.length === 0) {
      return (
        <Paper sx={{ p: { xs: 3, md: 4 } }}>
          <Typography color="text.secondary">
            表示したいカテゴリを選択してください。左のメニューからカテゴリを指定できます。
          </Typography>
        </Paper>
      );
    }

    return selectedCategories.map((category) => {
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
                            {section.tasks.map((task) => renderTaskCard(task))}
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                      タスクはまだ登録されていません。
                    </Paper>
                  )}
                </Paper>
              );
            })}
            {sortedTags.length === 0 && (
              <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                タグに紐づいたタスクはありません。
              </Paper>
            )}
          </Box>
        </Paper>
      );
    });
  };

  const renderStatusLayout = () => {
    if (statusSections.length === 0) {
      return (
        <Paper sx={{ p: { xs: 3, md: 4 } }}>
          <Typography color="text.secondary">表示できるタスクがありません。</Typography>
        </Paper>
      );
    }

    return (
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        }}
      >
        {statusSections.map((section) => (
          <Paper key={section.key} variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1">{section.label}</Typography>
              <Chip label={`${section.tasks.length} 件`} size="small" />
            </Box>
            <Stack spacing={1.5}>
              {section.tasks.length > 0 ? section.tasks.map((task) => renderTaskCard(task)) : (
                <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                  タスクはありません。
                </Paper>
              )}
            </Stack>
          </Paper>
        ))}
      </Box>
    );
  };

  const renderAssigneeLayout = () => {
    if (assigneeColumns.length === 0) {
      return (
        <Paper sx={{ p: { xs: 3, md: 4 } }}>
          <Typography color="text.secondary">表示できるタスクがありません。</Typography>
        </Paper>
      );
    }

    return (
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        }}
      >
        {assigneeColumns.map((column) => (
          <Paper key={column.key} variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1">{column.label}</Typography>
              <Chip label={`${column.tasks.length} 件`} size="small" />
            </Box>
            <Stack spacing={1.5}>
              {column.tasks.length > 0 ? column.tasks.map((task) => renderTaskCard(task)) : (
                <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                  タスクはありません。
                </Paper>
              )}
            </Stack>
          </Paper>
        ))}
      </Box>
    );
  };
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
            カテゴリやタグごとにチームの状況を把握できます。表示ビューはユーザーごとに自動保存されます。
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
          <Chip label={`総数 ${filteredTasks.length} 件`} color="primary" size="small" />
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
          <Chip
            label={isSavingPreferences ? 'ビュー設定を保存中…' : 'ビュー設定は最新です'}
            size="small"
            color={isSavingPreferences ? 'info' : 'success'}
            variant={isSavingPreferences ? 'filled' : 'outlined'}
          />
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
            表示するカテゴリや並び順、レイアウトを指定できます。設定はユーザーごとに自動保存されます。
          </Typography>

          <FormControl size="small">
            <InputLabel id="task-view-layout-label">ビュー</InputLabel>
            <Select
              labelId="task-view-layout-label"
              value={layout}
              label="ビュー"
              onChange={handleLayoutChange}
            >
              {LAYOUT_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Autocomplete
            multiple
            size="small"
            options={categoryOptions}
            value={selectedCategories}
            onChange={handleCategorySelectionChange}
            renderInput={(params) => (
              <TextField {...params} label="カテゴリ選択" placeholder="カテゴリ名" />
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

          {layout === 'assignee' && (
            <>
              <Autocomplete
                multiple
                size="small"
                options={derivedAssignees}
                value={selectedAssignees}
                onChange={handleAssigneeSelectionChange}
                renderInput={(params) => (
                  <TextField {...params} label="担当者選択" placeholder="担当者名" />
                )}
              />
              <FormControlLabel
                control={(
                  <Switch
                    checked={includeUnassignedColumn}
                    onChange={handleToggleIncludeUnassigned}
                    size="small"
                  />
                )}
                label="未担当の列を表示"
              />
            </>
          )}

          <Divider />
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              カテゴリ一覧
            </Typography>
            <Typography variant="caption" color="text.secondary">
              矢印ボタンで表示順を変更できます。
            </Typography>
            <Stack spacing={1.5}>
              {navCategories.length > 0 ? (
                navCategories.map((category, index) => {
                  const displayLabel = getCategoryLabel(category);
                  const taskCount = categoryToTagsMap[category]
                    ? Object.values(categoryToTagsMap[category]).reduce(
                        (count, items) => count + items.length,
                        0,
                      )
                    : 0;

                  return (
                    <Box
                      key={`nav-${category}`}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Chip label={displayLabel} size="small" />
                        <Typography variant="caption" color="text.secondary">
                          {taskCount} 件
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="カテゴリを上に移動">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleMoveCategory(category, -1)}
                              disabled={index === 0}
                              aria-label="カテゴリを上に移動"
                            >
                              <KeyboardArrowUpIcon fontSize="inherit" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="カテゴリを下に移動">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleMoveCategory(category, 1)}
                              disabled={index === navCategories.length - 1}
                              aria-label="カテゴリを下に移動"
                            >
                              <KeyboardArrowDownIcon fontSize="inherit" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </Box>
                  );
                })
              ) : (
                <Typography variant="body2" color="text.secondary">
                  データを読み込むとカテゴリ一覧を表示します。
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
              選択したビューに応じてタスクを表示します。並び替えは右のメニューから変更できます。
            </Typography>
          </Paper>

          {layout === 'category' && renderCategoryLayout()}
          {layout === 'status' && renderStatusLayout()}
          {layout === 'assignee' && renderAssigneeLayout()}
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
                タスクを登録するとステータスの件数を表示します。
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
                近日中に期限を迎えるタスクはありません。
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
          表示内容は自動保存されます。ビューを切り替えてチームの状況を確認しましょう。
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
