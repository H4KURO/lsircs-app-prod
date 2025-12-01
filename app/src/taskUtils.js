export const DEFAULT_CATEGORY_LABEL = '未設定カテゴリ';
export const DEFAULT_TAG_LABEL = '未設定タグ';

export const TASK_STATUS_DEFINITIONS = Object.freeze([
  { value: 'Started', translationKey: 'taskView.statuses.started' },
  { value: 'Inprogress', translationKey: 'taskView.statuses.inProgress' },
  { value: 'Done', translationKey: 'taskView.statuses.done' },
]);

export const TASK_STATUS_VALUES = TASK_STATUS_DEFINITIONS.map((definition) => definition.value);

export const TASK_STATUS_INDEX_MAP = TASK_STATUS_VALUES.reduce((acc, status, index) => {
  acc[status] = index;
  return acc;
}, {});

export const getNextTaskStatus = (currentStatus) => {
  if (!currentStatus || !(currentStatus in TASK_STATUS_INDEX_MAP)) {
    return TASK_STATUS_VALUES[0] ?? null;
  }
  const currentIndex = TASK_STATUS_INDEX_MAP[currentStatus];
  const nextStatus = TASK_STATUS_VALUES[currentIndex + 1];
  return nextStatus ?? null;
};

export const generateSubtaskId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `subtask-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
};

const normalizeSubtask = (subtask, index) => {
  if (!subtask) {
    return {
      id: generateSubtaskId(),
      title: '',
      completed: false,
      order: index,
      memo: '',
    };
  }

  if (typeof subtask === 'string') {
    return {
      id: generateSubtaskId(),
      title: subtask.trim(),
      completed: false,
      order: index,
      memo: '',
    };
  }

  const title = typeof subtask.title === 'string' ? subtask.title.trim() : '';
  const completed = Boolean(subtask.completed);
  const memo = typeof subtask.memo === 'string' ? subtask.memo.trim() : '';
  const identifier =
    subtask.id ||
    subtask.subtaskId ||
    subtask.key ||
    (typeof subtask.title === 'string' && subtask.title ? `${subtask.title}-${index}` : null) ||
    generateSubtaskId();

  return {
    id: String(identifier),
    title,
    completed,
    order: typeof subtask.order === 'number' ? subtask.order : index,
    memo,
  };
};

export const normalizeTask = (task) => {
  if (!task || typeof task !== 'object') {
    return task;
  }

  const rawAssignees = [];
  if (Array.isArray(task.assignees)) {
    rawAssignees.push(...task.assignees);
  }
  if (typeof task.assignee === 'string') {
    rawAssignees.push(task.assignee);
  }

  const seenAssignee = new Set();
  const assignees = rawAssignees
    .map((name) => (typeof name === 'string' ? name.trim() : ''))
    .filter((name) => {
      if (!name) {
        return false;
      }
      if (seenAssignee.has(name)) {
        return false;
      }
      seenAssignee.add(name);
      return true;
    });

  const rawTags = Array.isArray(task.tags) ? task.tags : [];
  const seenTags = new Set();
  const tags = rawTags
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter((tag) => {
      if (!tag) {
        return false;
      }
      if (seenTags.has(tag)) {
        return false;
      }
      seenTags.add(tag);
      return true;
    });

  const rawSubtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
  const seenSubtaskIds = new Set();
  const subtasks = rawSubtasks.map((subtask, index) => normalizeSubtask(subtask, index)).map((subtask) => {
    if (seenSubtaskIds.has(subtask.id)) {
      return { ...subtask, id: generateSubtaskId() };
    }
    seenSubtaskIds.add(subtask.id);
    return subtask;
  });

  return {
    ...task,
    assignees,
    assignee: assignees.length > 0 ? assignees[0] : null,
    tags,
    subtasks,
    attachments: Array.isArray(task.attachments) ? task.attachments : [],
  };
};

export const normalizeTasks = (tasks = []) => tasks.map(normalizeTask);

export const extractCategoryList = (tasks = []) => {
  const categories = new Set();
  tasks.forEach((task) => {
    const category = task?.category?.trim();
    categories.add(category || DEFAULT_CATEGORY_LABEL);
  });
  return Array.from(categories);
};

export const extractTagList = (tasks = []) => {
  const tags = new Set();
  tasks.forEach((task) => {
    if (!Array.isArray(task?.tags)) {
      return;
    }
    task.tags.forEach((tag) => {
      const normalized = typeof tag === 'string' ? tag.trim() : '';
      if (normalized) {
        tags.add(normalized);
      }
    });
  });
  return Array.from(tags);
};

export const groupTasksByCategoryAndTag = (tasks = []) => {
  const grouped = {};

  tasks.forEach((task, taskIndex) => {
    if (!task || typeof task !== 'object') {
      return;
    }

    const categoryKey = task.category?.trim() || DEFAULT_CATEGORY_LABEL;
    if (!grouped[categoryKey]) {
      grouped[categoryKey] = {};
    }

    const tags = Array.isArray(task.tags) && task.tags.length > 0 ? task.tags : [DEFAULT_TAG_LABEL];

    tags.forEach((tag) => {
      const tagKey = typeof tag === 'string' && tag.trim() ? tag.trim() : DEFAULT_TAG_LABEL;
      if (!grouped[categoryKey][tagKey]) {
        grouped[categoryKey][tagKey] = [];
      }
      grouped[categoryKey][tagKey].push({ ...task, order: task.order ?? taskIndex });
    });
  });

  return grouped;
};
