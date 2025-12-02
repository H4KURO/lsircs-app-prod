const { getNamedContainer } = require('./cosmosClient');
const { usersContainer } = require('./userProfileStore');
const { ensureAssigneesOnTask } = require('./assigneeUtils');
const { normaliseText } = require('./weeklyLeasingReportUtils');

const tasksContainer = () =>
  getNamedContainer('Tasks', ['COSMOS_TASKS_CONTAINER', 'CosmosTasksContainer']);

async function fetchTaskMetadata(taskId) {
  const trimmed = normaliseText(taskId);
  if (!trimmed) {
    return null;
  }
  try {
    const container = tasksContainer();
    const { resource } = await container.item(trimmed, trimmed).read();
    if (!resource) {
      return null;
    }
    const task = ensureAssigneesOnTask(resource);
    return {
      id: task.id,
      title: task.title || '',
      assignees: Array.isArray(task.assignees) ? task.assignees : [],
    };
  } catch (error) {
    if (error?.code === 404 || error?.code === 'NotFound') {
      return null;
    }
    throw error;
  }
}

async function fetchUserDisplayName(userId) {
  const trimmed = normaliseText(userId);
  if (!trimmed) {
    return null;
  }
  try {
    const container = await usersContainer();
    const { resource } = await container.item(trimmed, trimmed).read();
    if (!resource) {
      return null;
    }
    return resource.displayName || resource.userDetails || trimmed;
  } catch (error) {
    if (error?.code === 404 || error?.code === 'NotFound') {
      return null;
    }
    throw error;
  }
}

async function syncTaskAssignee(taskId, assigneeName, context) {
  const trimmedTaskId = normaliseText(taskId);
  const trimmedAssignee = normaliseText(assigneeName);
  if (!trimmedTaskId || !trimmedAssignee) {
    return;
  }
  try {
    const container = tasksContainer();
    const { resource } = await container.item(trimmedTaskId, trimmedTaskId).read();
    if (!resource) {
      return;
    }
    const task = ensureAssigneesOnTask(resource);
    const list = Array.isArray(task.assignees) ? [...task.assignees] : [];
    if (!list.includes(trimmedAssignee)) {
      list.unshift(trimmedAssignee);
    }
    task.assignees = list;
    task.assignee = list[0] || null;
    task.lastUpdatedAt = new Date().toISOString();
    task.lastUpdatedByName = 'Weekly Report Sync';
    task.lastUpdatedById = 'weekly-report-sync';
    await container.item(trimmedTaskId, trimmedTaskId).replace(task);
  } catch (error) {
    context?.log?.('Failed to sync task assignee from weekly report', error?.message || error);
  }
}

async function applyWeeklyAssociations(record, incoming = {}, { syncTask = false, context } = {}) {
  if (!record || typeof record !== 'object') {
    return record;
  }

  const updates = { ...incoming };

  if (Object.prototype.hasOwnProperty.call(updates, 'assigneeUserId')) {
    const displayName = await fetchUserDisplayName(updates.assigneeUserId);
    record.assigneeUserId = normaliseText(updates.assigneeUserId);
    record.assigneeName = displayName || normaliseText(updates.assigneeName);
  } else if (Object.prototype.hasOwnProperty.call(updates, 'assigneeName')) {
    record.assigneeName = normaliseText(updates.assigneeName);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'taskId')) {
    const taskMeta = await fetchTaskMetadata(updates.taskId);
    if (taskMeta) {
      record.taskId = taskMeta.id;
      record.taskTitle = taskMeta.title || record.taskTitle || '';
      if (!record.assigneeName && taskMeta.assignees.length > 0) {
        record.assigneeName = taskMeta.assignees[0];
      }
    } else {
      record.taskId = normaliseText(updates.taskId);
      if (!record.taskId) {
        record.taskTitle = '';
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'taskTitle')) {
    record.taskTitle = normaliseText(updates.taskTitle);
  }

  if (syncTask && record.taskId && record.assigneeName) {
    await syncTaskAssignee(record.taskId, record.assigneeName, context);
  }
  return record;
}

module.exports = {
  fetchTaskMetadata,
  fetchUserDisplayName,
  syncTaskAssignee,
  applyWeeklyAssociations,
};
