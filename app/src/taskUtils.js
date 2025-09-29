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

  const seen = new Set();
  const assignees = rawAssignees
    .map((name) => (typeof name === 'string' ? name.trim() : ''))
    .filter((name) => {
      if (!name) {
        return false;
      }
      if (seen.has(name)) {
        return false;
      }
      seen.add(name);
      return true;
    });

  return {
    ...task,
    assignees,
    assignee: assignees.length > 0 ? assignees[0] : null,
  };
};

export const normalizeTasks = (tasks = []) => tasks.map(normalizeTask);
