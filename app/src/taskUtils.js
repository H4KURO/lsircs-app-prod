export const DEFAULT_CATEGORY_LABEL = '未設定カテゴリ';
export const DEFAULT_TAG_LABEL = '未設定タグ';

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

  return {
    ...task,
    assignees,
    assignee: assignees.length > 0 ? assignees[0] : null,
    tags,
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

  tasks.forEach((task) => {
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
      grouped[categoryKey][tagKey].push(task);
    });
  });

  return grouped;
};
