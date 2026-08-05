import { useTranslation } from 'react-i18next';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable, useDraggable, closestCenter } from '@dnd-kit/core';
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
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButton,
  ToggleButtonGroup,
  Drawer,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import CircleIcon from '@mui/icons-material/Circle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import EmailIcon from '@mui/icons-material/Email';
import LinkIcon from '@mui/icons-material/Link';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import FilterListIcon from '@mui/icons-material/FilterList';
import GridViewIcon from '@mui/icons-material/GridView';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import CloseIcon from '@mui/icons-material/Close';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { TaskDetailModal } from './TaskDetailModal';
import { TaskTimelineView } from './TaskTimelineView';
import { TaskCalendar } from './TaskCalendar';
import { EmailImportModal } from './EmailImportModal';
import {
  normalizeTask,
  normalizeTasks,
  extractCategoryList,
  extractTagList,
  groupTasksByCategoryAndTag,
  DEFAULT_CATEGORY_LABEL,
  DEFAULT_TAG_LABEL,
  getNextTaskStatus,
  ALL_TASK_STATUS_DEFINITIONS,
} from './taskUtils';

const API_URL = '/api';
const statusColorMap = {
  Started: 'info.main',
  WaitingEstimate: 'info.main',
  Inprogress: 'warning.main',
  WaitingOwnerApproval: 'warning.main',
  WaitingCompletionReport: 'warning.main',
  DoneWithoutReport: 'success.main',
  Done: 'success.main',
};

const STATUS_LABEL_JA = {
  Started: '着手前',
  WaitingEstimate: '見積もり待ち',
  Inprogress: '進行中',
  WaitingOwnerApproval: 'オーナー承諾待ち',
  WaitingCompletionReport: '完了報告待ち',
  DoneWithoutReport: '完了（報告なし）',
  Done: '完了',
};

const STATUS_DEFINITIONS = ALL_TASK_STATUS_DEFINITIONS.map((d) => ({
  value: d.value,
  label: STATUS_LABEL_JA[d.value] ?? d.value,
}));

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
  { value: 'createdAtDesc', label: '作成日が新しい順' },
  { value: 'createdAtAsc', label: '作成日が古い順' },
];

const CATEGORY_TASK_ORDER_OPTIONS = [
  { value: 'progress', label: '進捗度順' },
  { value: 'createdAtDesc', label: '作成が新しい順' },
  { value: 'deadlineAsc', label: '期日が近い順' },
];

const FILTER_FIELDS = [
  { value: 'status', label: 'ステータス' },
  { value: 'importance', label: '重要度' },
  { value: 'deadline', label: '期限' },
  { value: 'assignee', label: '担当者' },
  { value: 'tag', label: 'タグ' },
  { value: 'category', label: 'カテゴリ' },
];

const FILTER_OPERATORS = {
  status: [
    { value: 'is', label: 'が次と等しい' },
    { value: 'isNot', label: 'が次と等しくない' },
  ],
  importance: [
    { value: 'is', label: 'が次と等しい' },
    { value: 'isNot', label: 'が次と等しくない' },
  ],
  deadline: [
    { value: 'before', label: 'が次より前' },
    { value: 'after', label: 'が次より後' },
    { value: 'isEmpty', label: 'が未設定' },
    { value: 'isNotEmpty', label: 'が設定済み' },
  ],
  assignee: [
    { value: 'contains', label: 'を含む' },
    { value: 'notContains', label: 'を含まない' },
  ],
  tag: [
    { value: 'contains', label: 'を含む' },
    { value: 'notContains', label: 'を含まない' },
  ],
  category: [
    { value: 'is', label: 'が次と等しい' },
    { value: 'isNot', label: 'が次と等しくない' },
  ],
};

const IMPORTANCE_FILTER_OPTIONS = [
  { value: 2, label: '高' },
  { value: 1, label: '中' },
  { value: 0, label: '低' },
];

const applyFilterCondition = (task, condition, derivedCategories, DEFAULT_CATEGORY_LABEL) => {
  const { field, operator, value } = condition;
  switch (field) {
    case 'status': {
      const s = task.status || '';
      const match = s === value;
      return operator === 'is' ? match : !match;
    }
    case 'importance': {
      const match = task.importance === value;
      return operator === 'is' ? match : !match;
    }
    case 'deadline': {
      if (operator === 'isEmpty') return !task.deadline;
      if (operator === 'isNotEmpty') return Boolean(task.deadline);
      if (!task.deadline || !value) return false;
      const ts = Date.parse(task.deadline);
      const vts = Date.parse(value);
      if (Number.isNaN(ts) || Number.isNaN(vts)) return false;
      return operator === 'before' ? ts < vts : ts > vts;
    }
    case 'assignee': {
      const assignees = Array.isArray(task.assignees)
        ? task.assignees.map((a) => (typeof a === 'string' ? a : a?.name ?? '').toLowerCase())
        : [];
      const match = assignees.some((a) => a.includes((value || '').toLowerCase()));
      return operator === 'contains' ? match : !match;
    }
    case 'tag': {
      const tags = Array.isArray(task.tags) ? task.tags.map((t) => t.toLowerCase()) : [];
      const match = tags.some((t) => t.includes((value || '').toLowerCase()));
      return operator === 'contains' ? match : !match;
    }
    case 'category': {
      const cat = (task.category || DEFAULT_CATEGORY_LABEL).trim();
      const match = cat === value;
      return operator === 'is' ? match : !match;
    }
    default:
      return true;
  }
};

const sortLabelMap = [...TASK_SORT_OPTIONS, ...CATEGORY_TASK_ORDER_OPTIONS].reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const CATEGORY_TASK_ORDER_LABEL_MAP = CATEGORY_TASK_ORDER_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const LAYOUT_OPTIONS = [
  { value: 'category', label: 'カテゴリ × タグ' },
  { value: 'status', label: '進捗（ステータス）' },
  { value: 'list', label: 'リスト' },
  { value: 'calendar', label: 'カレンダー' },
  { value: 'assignee', label: '担当者' },
  { value: 'gallery', label: 'ギャラリー' },
  { value: 'timeline', label: 'タイムライン（ガント）' },
];

const PRIMARY_VIEW_TABS = [
  { value: 'status', label: 'カンバン' },
  { value: 'list', label: 'リスト' },
  { value: 'gallery', label: 'ギャラリー' },
  { value: 'calendar', label: 'カレンダー' },
  { value: 'timeline', label: 'タイムライン' },
];

const ALLOWED_LAYOUTS = new Set(LAYOUT_OPTIONS.map((option) => option.value));

const ALLOWED_SORT_MODES = new Set(TASK_SORT_OPTIONS.map((option) => option.value));
const ALLOWED_CATEGORY_TASK_ORDERS = new Set(
  CATEGORY_TASK_ORDER_OPTIONS.map((option) => option.value),
);

const DEFAULT_PREFERENCES = Object.freeze({
  layout: 'category',
  sortMode: 'statusDeadline',
  selectedCategories: [],
  selectedAssignees: [],
  includeUnassignedColumn: true,
  categoryGroupByTag: true,
  categoryTaskOrder: 'progress',
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

/** PM案件タグを持ち、4フェーズのサブタスク構成であるかを判定 */
const isPMTask = (task) =>
  Array.isArray(task?.tags) &&
  task.tags.includes('PM案件') &&
  Array.isArray(task?.subtasks) &&
  task.subtasks.length === 4;

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

const getCreatedAtValue = (task) => {
  if (!task || typeof task !== 'object') {
    return Number.NEGATIVE_INFINITY;
  }

  const sources = [task.createdAt, task.createdDate, task.createdOn, task.created];
  for (const source of sources) {
    if (!source) {
      continue;
    }
    if (source instanceof Date) {
      const timestamp = source.getTime();
      if (!Number.isNaN(timestamp)) {
        return timestamp;
      }
      continue;
    }
    if (typeof source === 'number' && Number.isFinite(source)) {
      return source;
    }
    if (typeof source === 'string' && source.trim()) {
      const parsed = Date.parse(source.trim());
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return Number.NEGATIVE_INFINITY;
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


const compareCreatedAtDesc = (a, b) => {
  const diff = getCreatedAtValue(b) - getCreatedAtValue(a);
  if (diff !== 0) {
    return diff;
  }
  return compareDeadlineAsc(a, b);
};

const compareCreatedAtAsc = (a, b) => {
  const diff = getCreatedAtValue(a) - getCreatedAtValue(b);
  if (diff !== 0) {
    return diff;
  }
  return compareDeadlineAsc(a, b);
};

const sortTasksByMode = (tasks, mode) => {
  const sorted = [...tasks];
  const effectiveMode = mode === 'progress' ? 'statusDeadline' : mode;
  switch (effectiveMode) {
    case 'statusDeadline':
      sorted.sort((a, b) => {
        const statusDiff =
          getStatusRank(normalizeStatusKey(a.status)) - getStatusRank(normalizeStatusKey(b.status));
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
    case 'createdAtDesc':
      return sorted.sort(compareCreatedAtDesc);
    case 'createdAtAsc':
      return sorted.sort(compareCreatedAtAsc);
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
  const effectiveMode = mode === 'progress' ? 'statusDeadline' : mode;
  if (effectiveMode === 'statusDeadline') {
    return groupTasksByStatus(tasks);
  }

  return [
    {
      key: mode,
      label: CATEGORY_TASK_ORDER_LABEL_MAP[mode] || sortLabelMap[mode] || '並び替え',
      tasks: sortTasksByMode(tasks, effectiveMode),
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
  const categoryGroupByTag =
    typeof preferences.categoryGroupByTag === 'boolean'
      ? preferences.categoryGroupByTag
      : DEFAULT_PREFERENCES.categoryGroupByTag;
  const categoryTaskOrder = ALLOWED_CATEGORY_TASK_ORDERS.has(preferences.categoryTaskOrder)
    ? preferences.categoryTaskOrder
    : DEFAULT_PREFERENCES.categoryTaskOrder;

  return {
    layout,
    sortMode,
    selectedCategories,
    selectedAssignees,
    includeUnassignedColumn,
    categoryGroupByTag,
    categoryTaskOrder,
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
    a.categoryGroupByTag === b.categoryGroupByTag &&
    a.categoryTaskOrder === b.categoryTaskOrder &&
    areArraysEqual(a.selectedCategories, b.selectedCategories) &&
    areArraysEqual(a.selectedAssignees, b.selectedAssignees)
  );
}

const getTaskCategoryKey = (task) => (task?.category?.trim() ? task.category.trim() : DEFAULT_CATEGORY_LABEL);

function KanbanDropColumn({ columnId, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });
  return (
    <Box
      ref={setNodeRef}
      sx={{
        p: 1.25,
        overflowY: 'auto',
        flexGrow: 1,
        transition: 'background-color 0.15s',
        bgcolor: isOver ? 'action.selected' : undefined,
      }}
    >
      {children}
    </Box>
  );
}

function DraggableTaskCard({ taskId, children }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: taskId });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.3 : 1,
        touchAction: 'none',
      }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

function DroppableColumnSlot({ columnId, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `colpos:${columnId}` });
  return (
    <Box
      ref={setNodeRef}
      sx={{
        borderRadius: 1,
        outline: isOver ? '2px dashed' : '2px solid transparent',
        outlineColor: isOver ? 'primary.main' : undefined,
        transition: 'outline-color 0.15s',
      }}
    >
      {children}
    </Box>
  );
}

function DraggableColumnHeader({ columnId, children }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `col:${columnId}` });
  return (
    <Box ref={setNodeRef} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%', opacity: isDragging ? 0.4 : 1 }}>
      <Box
        {...listeners}
        {...attributes}
        sx={{
          display: 'flex', alignItems: 'center', cursor: 'grab', color: 'text.disabled', flexShrink: 0,
          '&:hover': { color: 'text.secondary' },
          '&:active': { cursor: 'grabbing' },
        }}
        title="ドラッグして並び替え"
      >
        <DragIndicatorIcon sx={{ fontSize: '1rem' }} />
      </Box>
      {children}
    </Box>
  );
}

export function TaskView({ initialTaskId = null, onSelectedTaskChange } = {}) {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState([]);
  const [assigneeOptions, setAssigneeOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [tagOptions, setTagOptions] = useState([]);
  const [automationRules, setAutomationRules] = useState([]);
  const [preferences, setPreferences] = useState(() => clonePreferences(DEFAULT_PREFERENCES));
  const [serverPreferences, setServerPreferences] = useState(() => clonePreferences(DEFAULT_PREFERENCES));
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [listPanelTask, setListPanelTask] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterConditions, setFilterConditions] = useState([]);
  const [secondaryGroupBy, setSecondaryGroupBy] = useState('');

  // カスタムビュー保存
  const [savedViews, setSavedViews] = useState([]);
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
  const [emailImportOpen, setEmailImportOpen] = useState(false);
  const [statusUpdatingIds, setStatusUpdatingIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSubtaskIds, setExpandedSubtaskIds] = useState(new Set());
  const [dndActiveTaskId, setDndActiveTaskId] = useState(null);
  const [kanbanColumnOrder, setKanbanColumnOrder] = useState({});
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [kanbanGroupBy, setKanbanGroupBy] = useState('status');
  const [kanbanPanelTask, setKanbanPanelTask] = useState(null);

  const handleToggleSubtaskExpand = useCallback((taskId) => {
    if (!taskId) return;
    setExpandedSubtaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

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
        const [tasksRes, usersRes, rulesRes, preferencesRes, categoriesRes, savedViewsRes] = await Promise.all([
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
          axios.get(`${API_URL}/GetCategories`).catch((error) => {
            console.error('Failed to load categories', error);
            return { data: [] };
          }),
          axios.get(`${API_URL}/GetSavedViews`).catch(() => ({ data: [] })),
        ]);

        const normalizedTasks = normalizeTasks(tasksRes.data);
        setTasks(normalizedTasks);

        const fetchedDbCategories = Array.isArray(categoriesRes?.data)
          ? categoriesRes.data.map((c) => (typeof c === 'string' ? c.trim() : c?.name?.trim() ?? '')).filter(Boolean)
          : [];
        setDbCategories(fetchedDbCategories);

        const assignees = usersRes.data.map((user) => user.displayName);
        setAssigneeOptions(assignees);

        const rulesData = Array.isArray(rulesRes?.data) ? rulesRes.data : [];
        setAutomationRules(rulesData);

        const normalizedPreferences = clonePreferences(preferencesRes?.data || DEFAULT_PREFERENCES);
        setPreferences(normalizedPreferences);
        setServerPreferences(normalizedPreferences);
        latestPreferencesRef.current = normalizedPreferences;
        setPreferencesLoaded(true);

        if (Array.isArray(savedViewsRes?.data)) {
          setSavedViews(savedViewsRes.data);
        }
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
    // Skip reporting null while waiting for the deep-linked task to be found in the loaded task list.
    // Without this guard, the initial null selectedTask clears deepLinkTaskId in the parent before tasks load.
    if (!selectedTask && initialTaskId && deepLinkHandledRef.current !== initialTaskId) {
      return;
    }
    if (typeof onSelectedTaskChange === 'function') {
      onSelectedTaskChange(selectedTask ? selectedTask.id : null);
    }
  }, [onSelectedTaskChange, selectedTask, initialTaskId]);

  const derivedCategories = useMemo(() => {
    const fromTasks = extractCategoryList(tasks);
    const merged = new Set([...dbCategories, ...fromTasks]);
    return Array.from(merged).sort(sortByName);
  }, [tasks, dbCategories]);
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

  const { layout, sortMode, selectedCategories, selectedAssignees, includeUnassignedColumn, categoryGroupByTag, categoryTaskOrder } = preferences;

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

  const searchFilteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return filteredTasks;
    return filteredTasks.filter((task) => {
      const fields = [
        task.title,
        task.description,
        task.category,
        ...(Array.isArray(task.tags) ? task.tags : []),
        ...(Array.isArray(task.assignees) ? task.assignees : []),
      ];
      return fields.some((field) => typeof field === 'string' && field.toLowerCase().includes(query));
    });
  }, [filteredTasks, searchQuery]);

  const conditionFilteredTasks = useMemo(() => {
    const active = filterConditions.filter(
      (c) => c.field && c.operator && (c.operator === 'isEmpty' || c.operator === 'isNotEmpty' || c.value !== '' && c.value != null),
    );
    if (active.length === 0) return searchFilteredTasks;
    return searchFilteredTasks.filter((task) => {
      let result = applyFilterCondition(task, active[0], derivedCategories, DEFAULT_CATEGORY_LABEL);
      for (let i = 1; i < active.length; i++) {
        const match = applyFilterCondition(task, active[i], derivedCategories, DEFAULT_CATEGORY_LABEL);
        result = active[i].logic === 'OR' ? result || match : result && match;
      }
      return result;
    });
  }, [searchFilteredTasks, filterConditions, derivedCategories]);

  const addFilterCondition = useCallback(() => {
    setFilterConditions((prev) => [
      ...prev,
      { id: Date.now(), logic: 'AND', field: 'status', operator: 'is', value: '' },
    ]);
  }, []);

  const removeFilterCondition = useCallback((id) => {
    setFilterConditions((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const updateFilterCondition = useCallback((id, patch) => {
    setFilterConditions((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...patch };
        if (patch.field && patch.field !== c.field) {
          next.operator = FILTER_OPERATORS[patch.field]?.[0]?.value ?? 'is';
          next.value = '';
        }
        return next;
      }),
    );
  }, []);

  const categoryToTagsMap = useMemo(() => {
    const activeCategories = selectedCategories.length > 0 ? selectedCategories : derivedCategories;
    if (activeCategories.length === 0) {
      return {};
    }
    const grouped = groupTasksByCategoryAndTag(conditionFilteredTasks);
    const result = {};
    activeCategories.forEach((category) => {
      result[category] = grouped[category] || { [DEFAULT_TAG_LABEL]: [] };
    });
    return result;
  }, [conditionFilteredTasks, selectedCategories, derivedCategories]);

  const statusSummary = useMemo(() => {
    return conditionFilteredTasks.reduce((acc, task) => {
      const key = normalizeStatusKey(task.status);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [conditionFilteredTasks]);

  const upcomingDeadlines = useMemo(() => {
    return conditionFilteredTasks
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
  }, [conditionFilteredTasks]);

  const statusSections = useMemo(() => {
    if (layout !== 'status' && layout !== 'list') {
      return [];
    }
    const effectiveSortMode = sortMode === 'statusDeadline' ? 'deadlineAsc' : sortMode;
    return groupTasksByStatus(conditionFilteredTasks).map((section) => ({
      ...section,
      tasks: sortTasksByMode(section.tasks, effectiveSortMode),
    }));
  }, [layout, conditionFilteredTasks, sortMode]);

  const kanbanSections = useMemo(() => {
    if (layout !== 'status') return [];
    const effectiveSortMode = sortMode === 'statusDeadline' ? 'deadlineAsc' : sortMode;
    if (kanbanGroupBy === 'status') {
      return groupTasksByStatus(conditionFilteredTasks).map((s) => ({
        ...s,
        columnId: `status:${s.key}`,
        tasks: sortTasksByMode(s.tasks, effectiveSortMode),
      }));
    }
    if (kanbanGroupBy === 'category') {
      const map = new Map();
      conditionFilteredTasks.forEach((task) => {
        const key = task.category?.trim() || DEFAULT_CATEGORY_LABEL;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(task);
      });
      const allKeys = [...new Set([...derivedCategories.map((c) => c || DEFAULT_CATEGORY_LABEL), ...map.keys()])];
      return allKeys.filter((k) => map.has(k)).map((key) => ({
        key,
        columnId: `category:${key}`,
        label: key,
        tasks: sortTasksByMode(map.get(key) || [], effectiveSortMode),
      }));
    }
    if (kanbanGroupBy === 'assignee') {
      const map = new Map();
      conditionFilteredTasks.forEach((task) => {
        const key = task.assignees?.[0] || UNASSIGNED_ASSIGNEE_KEY;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(task);
      });
      const allKeys = [...new Set([...derivedAssignees, ...map.keys()])];
      const sections = allKeys.filter((k) => map.has(k)).map((key) => ({
        key,
        columnId: `assignee:${key}`,
        label: key === UNASSIGNED_ASSIGNEE_KEY ? UNASSIGNED_ASSIGNEE_LABEL : key,
        tasks: sortTasksByMode(map.get(key) || [], effectiveSortMode),
      }));
      const unassigned = map.get(UNASSIGNED_ASSIGNEE_KEY);
      if (unassigned && !sections.find((s) => s.key === UNASSIGNED_ASSIGNEE_KEY)) {
        sections.push({ key: UNASSIGNED_ASSIGNEE_KEY, columnId: `assignee:${UNASSIGNED_ASSIGNEE_KEY}`, label: UNASSIGNED_ASSIGNEE_LABEL, tasks: sortTasksByMode(unassigned, effectiveSortMode) });
      }
      return sections;
    }
    if (kanbanGroupBy === 'tag') {
      const map = new Map();
      conditionFilteredTasks.forEach((task) => {
        const tags = Array.isArray(task.tags) && task.tags.length > 0 ? task.tags : [DEFAULT_TAG_LABEL];
        tags.forEach((tag) => {
          if (!map.has(tag)) map.set(tag, []);
          map.get(tag).push(task);
        });
      });
      return [...map.entries()].map(([key, tasks]) => ({
        key,
        columnId: `tag:${key}`,
        label: key,
        tasks: sortTasksByMode(tasks, effectiveSortMode),
      }));
    }
    return [];
  }, [layout, kanbanGroupBy, conditionFilteredTasks, sortMode, derivedCategories, derivedAssignees]);

  const orderedKanbanSections = useMemo(() => {
    const order = kanbanColumnOrder[kanbanGroupBy];
    if (!order || order.length === 0) return kanbanSections;
    return [...kanbanSections].sort((a, b) => {
      const ai = order.indexOf(a.columnId);
      const bi = order.indexOf(b.columnId);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [kanbanSections, kanbanColumnOrder, kanbanGroupBy]);

  const kanbanCollisionDetection = useCallback((args) => {
    const activeId = String(args.active.id);
    if (activeId.startsWith('col:')) {
      const colDroppables = args.droppableContainers.filter((dc) => String(dc.id).startsWith('colpos:'));
      return closestCenter({ ...args, droppableContainers: colDroppables });
    }
    const taskDroppables = args.droppableContainers.filter((dc) => !String(dc.id).startsWith('colpos:'));
    return closestCenter({ ...args, droppableContainers: taskDroppables });
  }, []);

  const assigneeColumns = useMemo(() => {
    if (layout !== 'assignee') {
      return [];
    }
    const effectiveSortMode = sortMode === 'statusDeadline' ? 'deadlineAsc' : sortMode;
    const grouped = groupTasksByAssignee(conditionFilteredTasks);
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
  }, [layout, conditionFilteredTasks, selectedAssignees, derivedAssignees, includeUnassignedColumn, sortMode]);

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

  const handleEmailParsed = ({ title, description, tags }) => {
    setSelectedTask({
      title: title || '',
      description: description || '',
      status: 'Started',
      priority: 'Medium',
      importance: 1,
      category:
        selectedCategories[0] && selectedCategories[0] !== DEFAULT_CATEGORY_LABEL
          ? selectedCategories[0]
          : null,
      assignees: [],
      assignee: null,
      tags: tags || ['PM案件'],
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

  const handleDragEnd = useCallback(({ active, over }) => {
    setDndActiveTaskId(null);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    // 列の並び替え
    if (activeId.startsWith('col:') && overId.startsWith('colpos:')) {
      const draggedColId = activeId.slice(4);
      const targetColId = overId.slice(7);
      if (draggedColId === targetColId) return;
      setKanbanColumnOrder((prev) => {
        const base = (prev[kanbanGroupBy] && prev[kanbanGroupBy].length > 0)
          ? prev[kanbanGroupBy]
          : kanbanSections.map((s) => s.columnId);
        const fromIdx = base.indexOf(draggedColId);
        const toIdx = base.indexOf(targetColId);
        if (fromIdx === -1 || toIdx === -1) return prev;
        const next = [...base];
        next.splice(fromIdx, 1);
        next.splice(toIdx, 0, draggedColId);
        return { ...prev, [kanbanGroupBy]: next };
      });
      return;
    }

    const taskId = activeId;
    const task = tasks.find((t) => String(t.id) === taskId);
    if (!task) return;
    const colonIdx = overId.indexOf(':');
    if (colonIdx === -1) return;
    const groupField = overId.slice(0, colonIdx);
    const groupValue = overId.slice(colonIdx + 1);
    let updatedTask;
    if (groupField === 'status') {
      if (task.status === groupValue) return;
      updatedTask = { ...task, status: groupValue };
    } else if (groupField === 'category') {
      const newCategory = groupValue === DEFAULT_CATEGORY_LABEL ? null : groupValue;
      if ((task.category || null) === newCategory) return;
      updatedTask = { ...task, category: newCategory };
    } else if (groupField === 'assignee') {
      if (groupValue === UNASSIGNED_ASSIGNEE_KEY) {
        if (!task.assignees?.length) return;
        updatedTask = { ...task, assignees: [], assignee: null };
      } else {
        if (task.assignees?.[0] === groupValue) return;
        const rest = (task.assignees || []).filter((a) => a !== groupValue);
        updatedTask = { ...task, assignees: [groupValue, ...rest], assignee: groupValue };
      }
    } else {
      return;
    }
    setTasks((prev) => prev.map((t) => String(t.id) === taskId ? normalizeTask(updatedTask) : t));
    axios
      .put(`${API_URL}/UpdateTask/${taskId}`, updatedTask)
      .then((res) => {
        const saved = normalizeTask(res.data);
        setTasks((prev) => prev.map((t) => String(t.id) === taskId ? saved : t));
      })
      .catch(() => {
        setTasks((prev) => prev.map((t) => String(t.id) === taskId ? task : t));
      });
  }, [tasks, kanbanGroupBy, kanbanSections]);

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

      const nextStatus = getNextTaskStatus(baseTask.status, baseTask.category);
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

  const handleOpenSaveViewDialog = () => {
    setSaveViewName('');
    setSaveViewDialogOpen(true);
  };

  const handleSaveView = async () => {
    const name = saveViewName.trim();
    if (!name) return;
    const viewToSave = {
      name,
      layout: preferences.layout,
      sortMode: preferences.sortMode,
      selectedCategories: preferences.selectedCategories,
      selectedAssignees: preferences.selectedAssignees,
      includeUnassignedColumn: preferences.includeUnassignedColumn,
      categoryGroupByTag: preferences.categoryGroupByTag,
      categoryTaskOrder: preferences.categoryTaskOrder,
      kanbanGroupBy,
      secondaryGroupBy,
      kanbanColumnOrder: kanbanColumnOrder[kanbanGroupBy] || [],
    };
    try {
      const { data } = await axios.post(`${API_URL}/SaveView`, viewToSave);
      setSavedViews(data);
      setSaveViewDialogOpen(false);
    } catch (err) {
      console.error('SaveView failed', err);
    }
  };

  const handleDeleteSavedView = async (viewId) => {
    setSavedViews((prev) => prev.filter((v) => v.id !== viewId));
    try {
      await axios.delete(`${API_URL}/DeleteSavedView/${viewId}`);
    } catch (err) {
      console.error('DeleteSavedView failed', err);
      const { data } = await axios.get(`${API_URL}/GetSavedViews`).catch(() => ({ data: [] }));
      setSavedViews(data);
    }
  };

  const handleApplySavedView = (view) => {
    updatePreferences((prev) => ({
      ...prev,
      layout: view.layout || prev.layout,
      sortMode: view.sortMode || prev.sortMode,
      selectedCategories: Array.isArray(view.selectedCategories) ? view.selectedCategories : prev.selectedCategories,
      selectedAssignees: Array.isArray(view.selectedAssignees) ? view.selectedAssignees : prev.selectedAssignees,
      includeUnassignedColumn: typeof view.includeUnassignedColumn === 'boolean' ? view.includeUnassignedColumn : prev.includeUnassignedColumn,
      categoryGroupByTag: typeof view.categoryGroupByTag === 'boolean' ? view.categoryGroupByTag : prev.categoryGroupByTag,
      categoryTaskOrder: view.categoryTaskOrder || prev.categoryTaskOrder,
    }));
    const groupBy = view.kanbanGroupBy || kanbanGroupBy;
    if (view.kanbanGroupBy) setKanbanGroupBy(view.kanbanGroupBy);
    setSecondaryGroupBy(view.secondaryGroupBy || '');
    if (Array.isArray(view.kanbanColumnOrder) && view.kanbanColumnOrder.length > 0) {
      setKanbanColumnOrder((prev) => ({ ...prev, [groupBy]: view.kanbanColumnOrder }));
    }
    setFilterConditions([]);
    setListPanelTask(null);
    setKanbanPanelTask(null);
  };

  const handleSortModeChange = (event) => {
    const value = event.target.value;
    updatePreferences((prev) => ({
      ...prev,
      sortMode: ALLOWED_SORT_MODES.has(value) ? value : prev.sortMode,
    }));
  };

  const handleCategoryTaskOrderChange = (event) => {
    const value = event.target.value;
    updatePreferences((prev) => ({
      ...prev,
      categoryTaskOrder: ALLOWED_CATEGORY_TASK_ORDERS.has(value) ? value : prev.categoryTaskOrder,
    }));
  };

  const handleToggleCategoryGroupByTag = (_event, checked) => {
    updatePreferences((prev) => ({
      ...prev,
      categoryGroupByTag: Boolean(checked),
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
    const isBlocked = Array.isArray(task.blockedBy) && task.blockedBy.length > 0;
    const normalizedTaskId =
      task?.id != null ? String(task.id) : task?.taskId != null ? String(task.taskId) : null;
    const nextStatus = getNextTaskStatus(task.status, task.category);
    const nextStatusLabel = nextStatus ? getStatusLabel(nextStatus) : null;
    const isAdvancing = normalizedTaskId ? statusUpdatingIds.includes(normalizedTaskId) : false;
    const currentStatusLabel = getStatusLabel(task.status);
    const advanceTooltip = nextStatus
      ? `${currentStatusLabel} → ${nextStatusLabel}`
      : t('taskView.actions.statusMax');
    const isSubtaskExpanded = normalizedTaskId ? expandedSubtaskIds.has(normalizedTaskId) : false;

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
              {isBlocked && (
                <Chip label={`ブロック中 (${task.blockedBy.length})`} size="small" color="warning" variant="outlined" />
              )}
              {Array.isArray(task.assignees) && task.assignees.length > 0 && (
                <Chip label={`担当: ${task.assignees.join(', ')}`} size="small" />
              )}
              {task.deadline && (
                <Chip label={`期限: ${getDeadlineLabel(task.deadline)}`} size="small" />
              )}
              <Chip label={`進捗: ${currentStatusLabel}`} size="small" variant="outlined" />
              {hasSubtasks && (
                <Chip
                  label={
                    isPMTask(task)
                      ? `PMフェーズ: ${subtaskSummary.completed}/4`
                      : `サブタスク: ${subtaskSummary.completed}/${subtaskSummary.total}`
                  }
                  size="small"
                  color={subtaskSummary.completed === subtaskSummary.total ? 'success' : isPMTask(task) ? 'warning' : 'default'}
                  onClick={(e) => { e.stopPropagation(); handleToggleSubtaskExpand(normalizedTaskId); }}
                  onDelete={(e) => { e.stopPropagation(); handleToggleSubtaskExpand(normalizedTaskId); }}
                  deleteIcon={isSubtaskExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                  sx={{ cursor: 'pointer' }}
                />
              )}
            </Stack>
          </Box>
        </Box>

        {hasSubtasks && isSubtaskExpanded ? (
          isPMTask(task) ? (
            /* ── PM フェーズ ステッパー ── */
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                {task.subtasks.map((subtask, index) => {
                  const firstUncompletedIndex = task.subtasks.findIndex((s) => !s.completed);
                  const isCompleted = subtask.completed;
                  const isCurrent = index === firstUncompletedIndex;
                  return (
                    <Tooltip
                      key={subtask.id}
                      title={`フェーズ${index + 1}: ${subtask.title}`}
                      placement="top"
                    >
                      <Box
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSubtaskCompletion(task.id, subtask.id);
                        }}
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          bgcolor: isCompleted
                            ? 'primary.main'
                            : isCurrent
                            ? 'warning.light'
                            : 'grey.200',
                          border: '2px solid',
                          borderColor: isCompleted
                            ? 'primary.dark'
                            : isCurrent
                            ? 'warning.main'
                            : 'grey.400',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                          '&:hover': { opacity: 0.75, transform: 'scale(1.12)' },
                        }}
                      >
                        {isCompleted ? (
                          <CheckCircleIcon sx={{ fontSize: '0.85rem', color: 'white' }} />
                        ) : (
                          <Typography
                            sx={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              color: isCurrent ? 'warning.dark' : 'text.disabled',
                              lineHeight: 1,
                            }}
                          >
                            {index + 1}
                          </Typography>
                        )}
                      </Box>
                    </Tooltip>
                  );
                })}
                <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                  {subtaskSummary.completed === subtaskSummary.total
                    ? '全フェーズ完了 ✓'
                    : `フェーズ ${subtaskSummary.completed + 1} 進行中`}
                </Typography>
              </Stack>
              {subtaskSummary.completed < subtaskSummary.total && (
                <Box>
                  <Chip
                    label={`次のフェーズへ進む → フェーズ${subtaskSummary.completed + 1}`}
                    size="small"
                    color="warning"
                    variant="outlined"
                    onClick={(e) => {
                      e.stopPropagation();
                      const nextSubtask = task.subtasks.find((s) => !s.completed);
                      if (nextSubtask) handleToggleSubtaskCompletion(task.id, nextSubtask.id);
                    }}
                    sx={{ '& .MuiChip-label': { fontSize: '0.72rem' } }}
                  />
                </Box>
              )}
            </Box>
          ) : (
            /* ── 通常サブタスク表示 ── */
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
                      alignItems: 'flex-start',
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
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.25,
                        flexGrow: 1,
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          textDecoration: subtask.completed ? 'line-through' : 'none',
                          color: subtask.completed ? 'text.disabled' : 'text.primary',
                        }}
                      >
                        {subtask.title || '未設定のサブタスク'}
                      </Typography>
                      {subtask.buyerLink ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <LinkIcon sx={{ fontSize: '0.75rem', color: 'info.main' }} />
                          <Typography variant="caption" color="info.main">
                            {subtask.buyerLink.displayName}
                          </Typography>
                        </Box>
                      ) : null}
                      {subtask.memo ? (
                        <Typography
                          variant="caption"
                          color={subtask.completed ? 'text.disabled' : 'text.secondary'}
                          sx={{ whiteSpace: 'pre-wrap' }}
                        >
                          {subtask.memo}
                        </Typography>
                      ) : null}
                      {Array.isArray(subtask.tags) && subtask.tags.length > 0 ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
                          {subtask.tags.map((tag) => (
                            <Chip
                              key={tag}
                              label={tag}
                              size="small"
                              sx={{ fontSize: '0.65rem', height: 18 }}
                            />
                          ))}
                        </Box>
                      ) : null}
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Box>
          )
        ) : null}

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

    return (
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: { xs: 2, md: 3 },
          alignItems: 'stretch',
        }}
      >
        {selectedCategories.map((category) => {
          const tagsInCategory = categoryToTagsMap[category] || {};
          const sortedTags = Object.keys(tagsInCategory).sort(sortByName);
          const tasksInCategory = conditionFilteredTasks.filter(
            (task) => getTaskCategoryKey(task) === category,
          );
          const totalCount = categoryGroupByTag
            ? Object.values(tagsInCategory).reduce((count, items) => count + items.length, 0)
            : tasksInCategory.length;
          const sectionsForCategory = prepareTasksForDisplay(tasksInCategory, categoryTaskOrder);
          const hasCategoryTasks = tasksInCategory.length > 0;

          return (
            <Box
              key={`category-card-${category}`}
              sx={{ flex: '1 1 280px', minWidth: 240, maxWidth: 360, display: 'flex' }}
            >
              <Paper
                sx={{
                  p: { xs: 2, md: 3 },
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  flex: 1,
                  minHeight: 260,
                  maxHeight: 700,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h6" noWrap>{getCategoryLabel(category)}</Typography>
                  <Chip label={`${totalCount} 件`} size="small" />
                </Box>
                <Divider />

                <Box sx={{ flexGrow: 1, minHeight: 0, overflow: 'hidden' }}>
                  {categoryGroupByTag ? (
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        height: '100%',
                        overflowY: 'auto',
                        pr: 1,
                      }}
                    >
                      {sortedTags.map((tag) => {
                        const tasksForTag = tagsInCategory[tag] || [];
                        const sections = prepareTasksForDisplay(tasksForTag, categoryTaskOrder);
                        const hasTasks = tasksForTag.length > 0;

                        return (
                          <Paper
                            key={`${category}-${tag}`}
                            variant="outlined"
                            sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                              <Typography variant="subtitle1" noWrap>{getTagLabel(tag)}</Typography>
                              <Chip label={`${tasksForTag.length} 件`} size="small" />
                            </Box>
                            {hasTasks ? (
                              <Box sx={{ maxHeight: 200, overflowY: 'auto', pr: 0.5 }}>
                                <Stack spacing={1.5}>
                                  {sections.map((section) => (
                                    <Box
                                      key={`${category}-${tag}-${section.key}`}
                                      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
                                    >
                                      {sections.length > 1 && (
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <Typography variant="subtitle2" color="text.secondary" noWrap>
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
                              </Box>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                タスクはありません。
                              </Typography>
                            )}
                          </Paper>
                        );
                      })}
                    </Box>
                  ) : hasCategoryTasks ? (
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        height: '100%',
                        overflowY: 'auto',
                        pr: 1,
                      }}
                    >
                      <Stack spacing={1.5}>
                        {sectionsForCategory.map((section) => (
                          <Box
                            key={`${category}-${section.key}`}
                            sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
                          >
                            {sectionsForCategory.length > 1 && (
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="subtitle2" color="text.secondary" noWrap>
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
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      タスクはありません。
                    </Typography>
                  )}
                </Box>
              </Paper>
            </Box>
          );
        })}
      </Box>
    );
  };
const renderListLayout = () => {
    const allTasks = conditionFilteredTasks;
    if (allTasks.length === 0) {
      return (
        <Paper sx={{ p: { xs: 3, md: 4 } }}>
          <Typography color="text.secondary">表示できるタスクがありません。</Typography>
        </Paper>
      );
    }

    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 380px' }, gap: 2, alignItems: 'start' }}>
        {/* Left: status-grouped list */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {statusSections.map((section) => (
            <Paper key={section.key} variant="outlined" sx={{ overflow: 'hidden' }}>
              <Box sx={{ px: 2, py: 1.25, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle2">{section.label}</Typography>
                <Chip label={`${section.tasks.length} 件`} size="small" />
              </Box>
              {(() => {
                const renderListRow = (task) => {
                  const isSelected = listPanelTask?.id === task.id;
                  return (
                    <Box
                      key={task.id}
                      onClick={() => setListPanelTask(isSelected ? null : task)}
                      sx={{
                        px: 2, py: 1.25,
                        cursor: 'pointer',
                        bgcolor: isSelected ? 'primary.main' : 'transparent',
                        color: isSelected ? 'primary.contrastText' : 'inherit',
                        display: 'flex', alignItems: 'center', gap: 1.5,
                        '&:hover': { bgcolor: isSelected ? 'primary.dark' : 'action.hover' },
                        transition: 'background 0.12s',
                      }}
                    >
                      <CircleIcon sx={{ color: isSelected ? 'rgba(255,255,255,0.6)' : getStatusColor(task.status), fontSize: '0.75rem', flexShrink: 0 }} />
                      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                          {task.title || 'タイトル未設定'}
                        </Typography>
                        {task.deadline && (
                          <Typography variant="caption" sx={{ opacity: isSelected ? 0.8 : 0.6 }}>
                            期限: {getDeadlineLabel(task.deadline)}
                          </Typography>
                        )}
                      </Box>
                      {Array.isArray(task.assignees) && task.assignees.length > 0 && (
                        <Typography variant="caption" noWrap sx={{ flexShrink: 0, opacity: isSelected ? 0.8 : 0.6, maxWidth: 100 }}>
                          {task.assignees[0]}
                        </Typography>
                      )}
                    </Box>
                  );
                };
                if (secondaryGroupBy) {
                  const subGroups = groupTasksSecondary(section.tasks, secondaryGroupBy) || [];
                  return subGroups.map((group) => (
                    <Box key={group.key}>
                      <Box sx={{ px: 2, py: 0.5, bgcolor: 'action.selected' }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>{group.label}</Typography>
                      </Box>
                      <Stack divider={<Divider />}>
                        {group.tasks.map(renderListRow)}
                      </Stack>
                    </Box>
                  ));
                }
                return (
                  <Stack divider={<Divider />}>
                    {section.tasks.map(renderListRow)}
                  </Stack>
                );
              })()}
            </Paper>
          ))}
        </Box>

        {/* Right: detail panel */}
        <Paper
          sx={{
            p: 2.5,
            position: { md: 'sticky' },
            top: { md: 24 },
            alignSelf: 'start',
            minHeight: 200,
          }}
        >
          {listPanelTask ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                  {listPanelTask.title || 'タイトル未設定'}
                </Typography>
                <Tooltip title="編集">
                  <IconButton size="small" onClick={() => handleEditTask(listPanelTask)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>

              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label={getStatusLabel(listPanelTask.status)} size="small" sx={{ color: getStatusColor(listPanelTask.status), borderColor: getStatusColor(listPanelTask.status) }} variant="outlined" />
                {listPanelTask.deadline && <Chip label={`期限: ${getDeadlineLabel(listPanelTask.deadline)}`} size="small" />}
                {Array.isArray(listPanelTask.assignees) && listPanelTask.assignees.length > 0 && (
                  <Chip label={`担当: ${listPanelTask.assignees.join(', ')}`} size="small" />
                )}
              </Stack>

              {listPanelTask.category && (
                <Typography variant="caption" color="text.secondary">
                  カテゴリ: {getCategoryLabel(listPanelTask.category)}
                </Typography>
              )}

              {listPanelTask.description && (
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {listPanelTask.description}
                </Typography>
              )}

              {Array.isArray(listPanelTask.tags) && listPanelTask.tags.length > 0 && (
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  {listPanelTask.tags.map((tag) => (
                    <Chip key={tag} label={tag} size="small" variant="outlined" />
                  ))}
                </Stack>
              )}

              {Array.isArray(listPanelTask.subtasks) && listPanelTask.subtasks.length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                    サブタスク ({listPanelTask.subtasks.filter((s) => s.completed).length}/{listPanelTask.subtasks.length})
                  </Typography>
                  <Stack spacing={0.5}>
                    {listPanelTask.subtasks.map((subtask) => (
                      <Box key={subtask.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {subtask.completed
                          ? <CheckCircleIcon sx={{ fontSize: '0.9rem', color: 'success.main' }} />
                          : <RadioButtonUncheckedIcon sx={{ fontSize: '0.9rem', color: 'action.disabled' }} />}
                        <Typography
                          variant="body2"
                          sx={{ textDecoration: subtask.completed ? 'line-through' : 'none', color: subtask.completed ? 'text.disabled' : 'text.primary' }}
                        >
                          {subtask.title}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}

              <Divider />
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button size="small" variant="outlined" onClick={() => handleEditTask(listPanelTask)} startIcon={<EditIcon />}>
                  編集
                </Button>
                <Button size="small" color="error" onClick={() => { handleDeleteTask(listPanelTask.id); setListPanelTask(null); }} startIcon={<DeleteIcon />}>
                  削除
                </Button>
              </Stack>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 160, gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                左のリストからタスクを選択してください
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
    );
  };

    const renderKanbanCard = (task) => {
    const subtaskSummary = calculateSubtaskSummary(task.subtasks);
    const hasSubtasks = subtaskSummary.total > 0;
    const normalizedTaskId = task?.id != null ? String(task.id) : null;
    const nextStatus = getNextTaskStatus(task.status, task.category);
    const isAdvancing = normalizedTaskId ? statusUpdatingIds.includes(normalizedTaskId) : false;
    const currentStatusLabel = getStatusLabel(task.status);
    const nextStatusLabel = nextStatus ? getStatusLabel(nextStatus) : null;
    const advanceTooltip = nextStatus ? `${currentStatusLabel} → ${nextStatusLabel}` : t('taskView.actions.statusMax');

    return (
      <Paper
        key={task.id}
        variant="outlined"
        sx={{
          p: 1.25,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.75,
          cursor: 'pointer',
          '&:hover': { boxShadow: 2 },
          transition: 'box-shadow 0.15s',
        }}
        onClick={() => setKanbanPanelTask((prev) => (prev?.id === task.id ? null : task))}
      >
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {task.title || 'タイトル未設定'}
        </Typography>

        <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.25 }}>
          {task.deadline && (
            <Chip label={getDeadlineLabel(task.deadline)} size="small" sx={{ height: 18, fontSize: '0.68rem' }} />
          )}
          {Array.isArray(task.assignees) && task.assignees.length > 0 && (
            <Chip label={task.assignees[0]} size="small" sx={{ height: 18, fontSize: '0.68rem', maxWidth: 100 }} />
          )}
          {hasSubtasks && (
            <Chip
              label={`${subtaskSummary.completed}/${subtaskSummary.total}`}
              size="small"
              color={subtaskSummary.completed === subtaskSummary.total ? 'success' : 'default'}
              sx={{ height: 18, fontSize: '0.68rem' }}
            />
          )}
        </Stack>

        {hasSubtasks && (
          <LinearProgress
            variant="determinate"
            value={subtaskSummary.percent}
            sx={{ height: 3, borderRadius: 2 }}
          />
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.25, mt: 0.25 }} onClick={(e) => e.stopPropagation()}>
          <Tooltip title={advanceTooltip}>
            <span>
              <IconButton
                size="small"
                color="primary"
                onClick={() => handleAdvanceTaskStatus(task)}
                disabled={!nextStatus || isAdvancing}
                sx={{ p: 0.4 }}
              >
                {isAdvancing ? <CircularProgress size={14} /> : <ArrowForwardIcon sx={{ fontSize: '0.9rem' }} />}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="編集">
            <IconButton size="small" onClick={() => handleEditTask(task)} sx={{ p: 0.4 }}>
              <EditIcon sx={{ fontSize: '0.9rem' }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>
    );
  };

  const renderGalleryLayout = () => {
    if (conditionFilteredTasks.length === 0) {
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
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 2,
        }}
      >
        {conditionFilteredTasks.map((task) => {
          const { total, completed, percent } = calculateSubtaskSummary(task.subtasks);
          const coverAttachment = Array.isArray(task.attachments)
            ? task.attachments.find((a) => a.type?.startsWith('image/'))
            : null;
          const importanceColor = task.importance === 2 ? 'error.main' : task.importance === 1 ? 'warning.main' : 'success.main';
          const importanceLabel = task.importance === 2 ? '高' : task.importance === 1 ? '中' : '低';

          return (
            <Paper
              key={task.id}
              variant="outlined"
              sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 0.15s', '&:hover': { boxShadow: 4 } }}
              onClick={() => handleEditTask(task)}
            >
              {/* Cover image or status-colored band */}
              {coverAttachment ? (
                <Box
                  component="img"
                  src={coverAttachment.url || coverAttachment.data}
                  alt=""
                  sx={{ width: '100%', height: 120, objectFit: 'cover' }}
                />
              ) : (
                <Box sx={{ height: 6, bgcolor: getStatusColor(task.status) }} />
              )}

              <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1, flexGrow: 1 }}>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                >
                  {task.title || 'タイトル未設定'}
                </Typography>

                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  <Chip
                    label={STATUS_LABEL_JA[task.status] ?? task.status ?? '未設定'}
                    size="small"
                    sx={{ height: 18, fontSize: '0.65rem', bgcolor: getStatusColor(task.status), color: '#fff' }}
                  />
                  <Chip
                    label={`重要度: ${importanceLabel}`}
                    size="small"
                    sx={{ height: 18, fontSize: '0.65rem', color: importanceColor, borderColor: importanceColor }}
                    variant="outlined"
                  />
                </Stack>

                {Array.isArray(task.assignees) && task.assignees.length > 0 && (
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {task.assignees.slice(0, 2).join(' · ')}{task.assignees.length > 2 ? ` +${task.assignees.length - 2}` : ''}
                  </Typography>
                )}

                {task.deadline && (
                  <Typography variant="caption" color="text.secondary">
                    期限: {getDeadlineLabel(task.deadline)}
                  </Typography>
                )}

                {total > 0 && (
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                      <Typography variant="caption" color="text.secondary">サブタスク</Typography>
                      <Typography variant="caption" color="text.secondary">{completed}/{total}</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={percent} sx={{ height: 4, borderRadius: 2 }} />
                  </Box>
                )}

                {Array.isArray(task.attachments) && task.attachments.length > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <AttachFileIcon sx={{ fontSize: '0.75rem', color: 'text.disabled' }} />
                    <Typography variant="caption" color="text.disabled">{task.attachments.length}</Typography>
                  </Box>
                )}
              </Box>

              <Box
                sx={{ px: 1.5, py: 0.75, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}
                onClick={(e) => e.stopPropagation()}
              >
                <Tooltip title="編集">
                  <IconButton size="small" onClick={() => handleEditTask(task)}><EditIcon fontSize="small" /></IconButton>
                </Tooltip>
                <Tooltip title="削除">
                  <IconButton size="small" onClick={() => handleDeleteTask(task.id)}><DeleteIcon fontSize="small" /></IconButton>
                </Tooltip>
              </Box>
            </Paper>
          );
        })}
      </Box>
    );
  };

  const groupTasksSecondary = (tasks, groupBy) => {
    if (!groupBy) return null;
    const groups = new Map();
    tasks.forEach((task) => {
      let key;
      let label;
      if (groupBy === 'category') {
        key = (task.category || DEFAULT_CATEGORY_LABEL).trim();
        label = key;
      } else if (groupBy === 'importance') {
        const imp = task.importance ?? 1;
        key = String(imp);
        label = imp === 2 ? '重要度: 高' : imp === 1 ? '重要度: 中' : '重要度: 低';
      } else if (groupBy === 'status') {
        key = task.status || 'Started';
        label = STATUS_LABEL_JA[key] ?? key;
      } else if (groupBy === 'assignee') {
        key = task.assignees?.[0] || UNASSIGNED_ASSIGNEE_KEY;
        label = key === UNASSIGNED_ASSIGNEE_KEY ? UNASSIGNED_ASSIGNEE_LABEL : key;
      } else if (groupBy === 'tag') {
        key = (Array.isArray(task.tags) && task.tags.length > 0) ? task.tags[0] : DEFAULT_TAG_LABEL;
        label = key === DEFAULT_TAG_LABEL ? 'タグ未設定' : key;
      } else {
        return;
      }
      if (!groups.has(key)) groups.set(key, { key, label, tasks: [] });
      groups.get(key).tasks.push(task);
    });
    const result = Array.from(groups.values());
    if (groupBy === 'status') {
      result.sort((a, b) => (statusOrderMap[a.key] ?? 999) - (statusOrderMap[b.key] ?? 999));
    } else {
      result.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    }
    return result;
  };

  const renderStatusLayout = () => {
    if (kanbanSections.length === 0) {
      return (
        <Paper sx={{ p: { xs: 3, md: 4 } }}>
          <Typography color="text.secondary">表示できるタスクがありません。</Typography>
        </Paper>
      );
    }

    const activeTask = dndActiveTaskId ? tasks.find((t) => String(t.id) === String(dndActiveTaskId)) : null;
    const tagDnd = kanbanGroupBy !== 'tag';

    return (
      <>
        {/* グループ軸セレクター */}
        <Box sx={{ display: 'flex', gap: 1, mb: 1.5, alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>グループ:</Typography>
          {[
            { value: 'status', label: 'ステータス' },
            { value: 'category', label: 'カテゴリ' },
            { value: 'assignee', label: '担当者' },
            { value: 'tag', label: 'タグ' },
          ].map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              size="small"
              variant={kanbanGroupBy === opt.value ? 'filled' : 'outlined'}
              color={kanbanGroupBy === opt.value ? 'primary' : 'default'}
              onClick={() => setKanbanGroupBy(opt.value)}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Box>

        <DndContext
          sensors={dndSensors}
          collisionDetection={kanbanCollisionDetection}
          onDragStart={({ active }) => setDndActiveTaskId(active.id)}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDndActiveTaskId(null)}
        >
          <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2, alignItems: 'flex-start' }}>
            {orderedKanbanSections.map((section) => (
              <DroppableColumnSlot key={section.columnId} columnId={section.columnId}>
                <Paper
                  variant="outlined"
                  sx={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 320px)', minHeight: 120 }}
                >
                  <Box
                    sx={{
                      px: 1.5, py: 1.25, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0, bgcolor: 'action.hover',
                    }}
                  >
                    <DraggableColumnHeader columnId={section.columnId}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                        {kanbanGroupBy === 'status' && (
                          <CircleIcon sx={{ color: getStatusColor(section.key), fontSize: '0.7rem', flexShrink: 0 }} />
                        )}
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{section.label}</Typography>
                      </Box>
                    </DraggableColumnHeader>
                    <Chip label={section.tasks.length} size="small" sx={{ height: 20, fontSize: '0.7rem', flexShrink: 0, ml: 0.5 }} />
                  </Box>
                  <KanbanDropColumn columnId={tagDnd ? section.columnId : `__nodrop_${section.columnId}`}>
                    {section.tasks.length === 0 ? (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', py: 2 }}>
                        タスクはありません
                      </Typography>
                    ) : secondaryGroupBy ? (
                      <Stack spacing={1.5}>
                        {(groupTasksSecondary(section.tasks, secondaryGroupBy) || []).map((group) => (
                          <Box key={group.key}>
                            <Typography variant="caption" sx={{ display: 'block', px: 0.25, pb: 0.5, color: 'text.secondary', fontWeight: 600, borderBottom: '1px solid', borderColor: 'divider', mb: 0.75 }}>
                              {group.label}
                            </Typography>
                            <Stack spacing={1}>
                              {group.tasks.map((task) => (
                                tagDnd ? (
                                  <DraggableTaskCard key={task.id} taskId={task.id}>
                                    {renderKanbanCard(task)}
                                  </DraggableTaskCard>
                                ) : (
                                  <Box key={task.id}>{renderKanbanCard(task)}</Box>
                                )
                              ))}
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    ) : (
                      <Stack spacing={1}>
                        {section.tasks.map((task) => (
                          tagDnd ? (
                            <DraggableTaskCard key={task.id} taskId={task.id}>
                              {renderKanbanCard(task)}
                            </DraggableTaskCard>
                          ) : (
                            <Box key={task.id}>{renderKanbanCard(task)}</Box>
                          )
                        ))}
                      </Stack>
                    )}
                  </KanbanDropColumn>
                </Paper>
              </DroppableColumnSlot>
            ))}
          </Box>
          <DragOverlay dropAnimation={null}>
            {(() => {
              const aid = dndActiveTaskId ? String(dndActiveTaskId) : null;
              if (!aid) return null;
              if (aid.startsWith('col:')) {
                const sec = kanbanSections.find((s) => s.columnId === aid.slice(4));
                return sec ? (
                  <Paper variant="outlined" sx={{ px: 2, py: 1, opacity: 0.9, boxShadow: 8, bgcolor: 'action.hover', width: 260 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{sec.label}</Typography>
                  </Paper>
                ) : null;
              }
              const activeTask = tasks.find((t) => String(t.id) === aid);
              return activeTask ? (
                <Box sx={{ opacity: 0.9, transform: 'rotate(1.5deg)', boxShadow: 6, borderRadius: 1 }}>
                  {renderKanbanCard(activeTask)}
                </Box>
              ) : null;
            })()}
          </DragOverlay>
        </DndContext>
      </>
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 3 }, minHeight: '100%' }}>

      {/* ── HEADER ── */}
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
          <Typography variant="h4" component="h1">タスク管理</Typography>
          <Typography variant="body2" color="text.secondary">
            カテゴリやタグごとにチームの状況を把握できます。表示ビューはユーザーごとに自動保存されます。
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ flex: { xs: '1 1 100%', md: '1 1 240px' }, flexWrap: 'wrap' }}>
          <Chip label={`総数 ${conditionFilteredTasks.length} 件`} color="primary" size="small" />
          {STATUS_DEFINITIONS.map((definition) => {
            const count = statusSummary[definition.value] || 0;
            if (count === 0) return null;
            return (
              <Chip
                key={definition.value}
                label={`${definition.label}: ${count} 件`}
                size="small"
                icon={<CircleIcon sx={{ color: getStatusColor(definition.value), fontSize: '0.875rem !important' }} />}
                variant="outlined"
                sx={{ color: getStatusColor(definition.value), borderColor: getStatusColor(definition.value) }}
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
        <TextField
          size="small"
          placeholder="キーワードで検索…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          sx={{ flex: { xs: '1 1 100%', md: '0 0 220px' }, alignSelf: 'center' }}
        />
        <Button startIcon={<EmailIcon />} variant="outlined" onClick={() => setEmailImportOpen(true)}
          sx={{ alignSelf: { xs: 'stretch', md: 'center' }, flex: { xs: '1 1 100%', md: '0 0 auto' } }}>
          メールから作成
        </Button>
        <Button startIcon={<AddIcon />} variant="contained" onClick={handleOpenCreateModal}
          sx={{ alignSelf: { xs: 'stretch', md: 'center' }, flex: { xs: '1 1 100%', md: '0 0 auto' } }}>
          タスクを追加
        </Button>
      </Paper>

      {/* ── TAB BAR ── */}
      <Paper sx={{ px: { xs: 2, md: 2.5 }, py: 1.25, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <ToggleButtonGroup
          value={PRIMARY_VIEW_TABS.some((t) => t.value === layout) ? layout : null}
          exclusive
          onChange={(_, val) => { if (val) updatePreferences((prev) => ({ ...prev, layout: val })); }}
          size="small"
        >
          {PRIMARY_VIEW_TABS.map((tab) => (
            <ToggleButton
              key={tab.value}
              value={tab.value}
              sx={{
                px: 2.5,
                fontWeight: 600,
                fontSize: '0.8rem',
                letterSpacing: '0.02em',
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: '#fff',
                  '&:hover': { bgcolor: 'primary.dark' },
                },
              }}
            >
              {tab.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Box sx={{ flex: 1 }} />

        <Tooltip title="現在のフィルター設定を保存">
          <IconButton size="small" onClick={handleOpenSaveViewDialog}>
            <BookmarkAddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="フィルター・表示設定">
          <IconButton size="small" onClick={() => setFilterOpen((prev) => !prev)} color={filterOpen ? 'primary' : 'default'}>
            <FilterListIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Paper>

      {/* ── FILTER PANEL (collapsible) ── */}
      {filterOpen && (
        <Paper sx={{ p: { xs: 2, md: 2.5 }, display: 'flex', flexWrap: 'wrap', gap: 2.5, alignItems: 'flex-start' }}>
          {savedViews.length > 0 && (
            <Box sx={{ flex: '1 1 100%' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>保存済みビュー</Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75}>
                {savedViews.map((view) => (
                  <Box
                    key={view.id}
                    onClick={() => handleApplySavedView(view)}
                    sx={{
                      display: 'inline-flex', alignItems: 'center', gap: 0.5,
                      border: '1px solid', borderColor: 'primary.main', borderRadius: 4,
                      px: 1, py: 0.25, cursor: 'pointer',
                      '&:hover': { bgcolor: 'primary.main', '& *': { color: '#fff' } },
                      transition: 'background-color 0.15s',
                    }}
                  >
                    <BookmarkIcon sx={{ fontSize: '0.85rem', color: 'primary.main' }} />
                    <Typography variant="caption" sx={{ color: 'primary.main', lineHeight: 1.5 }}>{view.name}</Typography>
                    <IconButton
                      size="small"
                      sx={{ p: 0.125, ml: 0.25, color: 'primary.main' }}
                      onClick={(e) => { e.stopPropagation(); handleDeleteSavedView(view.id); }}
                      aria-label={`${view.name}を削除`}
                    >
                      <CloseIcon sx={{ fontSize: '0.75rem' }} />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* ── AND/OR Filter Conditions ── */}
          <Box sx={{ flex: '1 1 100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
              <Typography variant="caption" color="text.secondary">フィルター条件</Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={addFilterCondition} sx={{ minWidth: 0, px: 1 }}>
                条件を追加
              </Button>
            </Box>
            {filterConditions.length === 0 && (
              <Typography variant="caption" color="text.disabled">条件なし（全件表示）</Typography>
            )}
            <Stack spacing={0.75}>
              {filterConditions.map((cond, idx) => {
                const operators = FILTER_OPERATORS[cond.field] || [];
                const needsValue = cond.operator !== 'isEmpty' && cond.operator !== 'isNotEmpty';
                return (
                  <Box key={cond.id} sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                    {idx > 0 && (
                      <Select
                        size="small"
                        value={cond.logic}
                        onChange={(e) => updateFilterCondition(cond.id, { logic: e.target.value })}
                        sx={{ minWidth: 64 }}
                      >
                        <MenuItem value="AND">AND</MenuItem>
                        <MenuItem value="OR">OR</MenuItem>
                      </Select>
                    )}
                    {idx === 0 && <Box sx={{ minWidth: 64 }} />}
                    <Select
                      size="small"
                      value={cond.field}
                      onChange={(e) => updateFilterCondition(cond.id, { field: e.target.value })}
                      sx={{ minWidth: 100 }}
                    >
                      {FILTER_FIELDS.map((f) => (
                        <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
                      ))}
                    </Select>
                    <Select
                      size="small"
                      value={cond.operator}
                      onChange={(e) => updateFilterCondition(cond.id, { operator: e.target.value })}
                      sx={{ minWidth: 120 }}
                    >
                      {operators.map((op) => (
                        <MenuItem key={op.value} value={op.value}>{op.label}</MenuItem>
                      ))}
                    </Select>
                    {needsValue && cond.field === 'status' && (
                      <Select
                        size="small"
                        value={cond.value}
                        onChange={(e) => updateFilterCondition(cond.id, { value: e.target.value })}
                        sx={{ minWidth: 140 }}
                        displayEmpty
                      >
                        <MenuItem value=""><em>選択</em></MenuItem>
                        {STATUS_DEFINITIONS.map((s) => (
                          <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                        ))}
                      </Select>
                    )}
                    {needsValue && cond.field === 'importance' && (
                      <Select
                        size="small"
                        value={cond.value}
                        onChange={(e) => updateFilterCondition(cond.id, { value: e.target.value })}
                        sx={{ minWidth: 80 }}
                        displayEmpty
                      >
                        <MenuItem value=""><em>選択</em></MenuItem>
                        {IMPORTANCE_FILTER_OPTIONS.map((opt) => (
                          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                        ))}
                      </Select>
                    )}
                    {needsValue && cond.field === 'deadline' && (
                      <TextField
                        size="small"
                        type="date"
                        value={cond.value}
                        onChange={(e) => updateFilterCondition(cond.id, { value: e.target.value })}
                        sx={{ minWidth: 140 }}
                      />
                    )}
                    {needsValue && cond.field === 'category' && (
                      <Select
                        size="small"
                        value={cond.value}
                        onChange={(e) => updateFilterCondition(cond.id, { value: e.target.value })}
                        sx={{ minWidth: 140 }}
                        displayEmpty
                      >
                        <MenuItem value=""><em>選択</em></MenuItem>
                        {derivedCategories.map((cat) => (
                          <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                        ))}
                      </Select>
                    )}
                    {needsValue && (cond.field === 'assignee' || cond.field === 'tag') && (
                      <TextField
                        size="small"
                        placeholder={cond.field === 'tag' ? 'タグ名' : '担当者名'}
                        value={cond.value}
                        onChange={(e) => updateFilterCondition(cond.id, { value: e.target.value })}
                        sx={{ minWidth: 120 }}
                      />
                    )}
                    <IconButton size="small" onClick={() => removeFilterCondition(cond.id)} color="default">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                );
              })}
            </Stack>
          </Box>

          {/* Category filter */}
          <Box sx={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Autocomplete
              multiple
              size="small"
              options={categoryOptions}
              value={selectedCategories}
              onChange={handleCategorySelectionChange}
              renderInput={(params) => <TextField {...params} label="カテゴリ選択" placeholder="カテゴリ名" />}
            />
            <Button variant="outlined" size="small" onClick={handleResetSelection}>すべて表示</Button>
          </Box>

          {/* Sort + layout-specific options */}
          <Box sx={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <FormControl size="small" fullWidth>
              <InputLabel id="task-sort-mode-label">並び順</InputLabel>
              <Select labelId="task-sort-mode-label" value={sortMode} label="並び順" onChange={handleSortModeChange}>
                {TASK_SORT_OPTIONS.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
              </Select>
            </FormControl>
            {(layout === 'status' || layout === 'list') && (
              <FormControl size="small" fullWidth>
                <InputLabel id="secondary-group-label">グループ化</InputLabel>
                <Select
                  labelId="secondary-group-label"
                  value={secondaryGroupBy}
                  label="グループ化"
                  onChange={(e) => setSecondaryGroupBy(e.target.value)}
                >
                  <MenuItem value="">なし</MenuItem>
                  <MenuItem value="status">ステータス</MenuItem>
                  <MenuItem value="category">カテゴリ</MenuItem>
                  <MenuItem value="importance">重要度</MenuItem>
                  <MenuItem value="assignee">担当者</MenuItem>
                  <MenuItem value="tag">タグ</MenuItem>
                </Select>
              </FormControl>
            )}
            {layout === 'category' && (
              <>
                <FormControlLabel
                  control={<Switch size="small" checked={categoryGroupByTag} onChange={handleToggleCategoryGroupByTag} />}
                  label="タグでグループ化"
                />
                <FormControl size="small" fullWidth>
                  <InputLabel id="category-task-order-label">カテゴリ内の並び順</InputLabel>
                  <Select labelId="category-task-order-label" value={categoryTaskOrder} label="カテゴリ内の並び順" onChange={handleCategoryTaskOrderChange}>
                    {CATEGORY_TASK_ORDER_OPTIONS.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </>
            )}
            {layout === 'assignee' && (
              <>
                <Autocomplete
                  multiple
                  size="small"
                  options={derivedAssignees}
                  value={selectedAssignees}
                  onChange={handleAssigneeSelectionChange}
                  renderInput={(params) => <TextField {...params} label="担当者選択" placeholder="担当者名" />}
                />
                <FormControlLabel
                  control={<Switch checked={includeUnassignedColumn} onChange={handleToggleIncludeUnassigned} size="small" />}
                  label="未担当の列を表示"
                />
              </>
            )}
          </Box>

        </Paper>
      )}

      {/* ── MAIN CONTENT ── */}
      <Box sx={{ flexGrow: 1 }}>
        {layout === 'category' && renderCategoryLayout()}
        {layout === 'status' && renderStatusLayout()}
        {layout === 'list' && renderListLayout()}
        {layout === 'gallery' && renderGalleryLayout()}
        {layout === 'calendar' && (
          <Paper sx={{ p: 0, overflow: 'hidden', height: 680 }}>
            <TaskCalendar tasks={conditionFilteredTasks} onTaskSelect={handleEditTask} />
          </Paper>
        )}
        {layout === 'assignee' && renderAssigneeLayout()}
        {layout === 'timeline' && (
          <TaskTimelineView tasks={conditionFilteredTasks} onEditTask={handleEditTask} />
        )}
      </Box>

      {/* ── KANBAN RIGHT PANEL ── */}
      <Drawer
        anchor="right"
        open={Boolean(kanbanPanelTask)}
        onClose={() => setKanbanPanelTask(null)}
        PaperProps={{ sx: { width: { xs: '90vw', sm: 400 }, p: 2.5 } }}
      >
        {kanbanPanelTask && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.4, flex: 1 }}>
                {kanbanPanelTask.title || 'タイトル未設定'}
              </Typography>
              <IconButton size="small" onClick={() => setKanbanPanelTask(null)} sx={{ mt: -0.25 }}>
                ✕
              </IconButton>
            </Box>
            <Stack direction="row" flexWrap="wrap" gap={0.75}>
              <Chip label={getStatusLabel(kanbanPanelTask.status)} size="small" variant="outlined"
                sx={{ color: getStatusColor(kanbanPanelTask.status), borderColor: getStatusColor(kanbanPanelTask.status) }} />
              {kanbanPanelTask.deadline && <Chip label={`期限: ${getDeadlineLabel(kanbanPanelTask.deadline)}`} size="small" />}
              {Array.isArray(kanbanPanelTask.assignees) && kanbanPanelTask.assignees.length > 0 && (
                <Chip label={`担当: ${kanbanPanelTask.assignees.join(', ')}`} size="small" />
              )}
            </Stack>
            {kanbanPanelTask.category && (
              <Typography variant="caption" color="text.secondary">
                カテゴリ: {getCategoryLabel(kanbanPanelTask.category)}
              </Typography>
            )}
            {kanbanPanelTask.description && (
              <Box
                sx={{ fontSize: '0.85rem', lineHeight: 1.6, color: 'text.primary', '& h2': { fontSize: '1rem', fontWeight: 700, my: 0.5 }, '& ul, & ol': { pl: 2 }, '& p': { my: 0.25 } }}
                dangerouslySetInnerHTML={{ __html: kanbanPanelTask.description }}
              />
            )}
            {Array.isArray(kanbanPanelTask.tags) && kanbanPanelTask.tags.length > 0 && (
              <Stack direction="row" flexWrap="wrap" gap={0.5}>
                {kanbanPanelTask.tags.map((tag) => (
                  <Chip key={tag} label={tag} size="small" variant="outlined" />
                ))}
              </Stack>
            )}
            {Array.isArray(kanbanPanelTask.subtasks) && kanbanPanelTask.subtasks.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  サブタスク ({kanbanPanelTask.subtasks.filter((s) => s.completed).length}/{kanbanPanelTask.subtasks.length})
                </Typography>
                <Stack spacing={0.5}>
                  {kanbanPanelTask.subtasks.map((sub) => (
                    <Box key={sub.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      {sub.completed ? <CheckCircleIcon color="success" sx={{ fontSize: '1rem' }} /> : <RadioButtonUncheckedIcon color="disabled" sx={{ fontSize: '1rem' }} />}
                      <Typography variant="caption" sx={{ textDecoration: sub.completed ? 'line-through' : 'none', color: sub.completed ? 'text.disabled' : 'text.primary' }}>
                        {sub.title}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}
            <Box sx={{ flex: 1 }} />
            <Divider />
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="contained" onClick={() => { handleEditTask(kanbanPanelTask); setKanbanPanelTask(null); }} startIcon={<EditIcon />}>
                編集
              </Button>
              <Button size="small" color="error" variant="outlined" onClick={() => { handleDeleteTask(kanbanPanelTask.id); setKanbanPanelTask(null); }} startIcon={<DeleteIcon />}>
                削除
              </Button>
            </Stack>
          </Box>
        )}
      </Drawer>

      {/* ── MODALS ── */}
      <EmailImportModal open={emailImportOpen} onClose={() => setEmailImportOpen(false)} onParsed={handleEmailParsed} />

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onSave={handleSaveTask}
          onClose={() => setSelectedTask(null)}
          assigneeOptions={assigneeOptions}
          categoryOptions={categoryOptions.map((category) => category === DEFAULT_CATEGORY_LABEL ? '' : category)}
          automationRules={automationRules}
          tagOptions={tagOptions}
          allTasks={tasks}
        />
      )}

      <Dialog open={saveViewDialogOpen} onClose={() => setSaveViewDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>ビューを保存</DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          <TextField
            autoFocus
            fullWidth
            label="ビュー名"
            placeholder="例: 自分の進行中タスク"
            value={saveViewName}
            onChange={e => setSaveViewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveView(); }}
            helperText="現在のレイアウト・カテゴリ・担当者フィルターを名前付きで保存します"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveViewDialogOpen(false)}>キャンセル</Button>
          <Button variant="contained" onClick={handleSaveView} disabled={!saveViewName.trim()}>保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
