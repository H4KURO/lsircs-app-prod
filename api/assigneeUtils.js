const toList = (value) => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return [value];
  }
  return [];
};

const normalizeAssigneesPayload = (source) => {
  if (!source || typeof source !== 'object') {
    return [];
  }

  const combined = [
    ...toList(source.assignees),
    ...toList(source.assignee),
  ];

  const seen = new Set();
  const normalized = [];

  combined.forEach((entry) => {
    if (typeof entry !== 'string') {
      return;
    }
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  });

  return normalized;
};

const ensureAssigneesOnTask = (task) => {
  if (!task || typeof task !== 'object') {
    return task;
  }

  const assignees = normalizeAssigneesPayload(task);

  return {
    ...task,
    assignees,
    assignee: assignees.length > 0 ? assignees[0] : null,
  };
};

module.exports = {
  normalizeAssigneesPayload,
  ensureAssigneesOnTask,
};
