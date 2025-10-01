const { v4: uuidv4 } = require('uuid');

function toStringOrEmpty(value) {
  if (typeof value === 'string') {
    return value.trim();
  }
  return '';
}

function normalizeSubtasksInput(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  const seenIds = new Set();
  const normalized = [];

  input.forEach((rawItem, index) => {
    let title = '';
    let completed = false;
    let providedId = null;
    let orderValue = Number.isFinite(rawItem?.order) ? rawItem.order : index;

    if (typeof rawItem === 'string') {
      title = rawItem.trim();
    } else if (rawItem && typeof rawItem === 'object') {
      title = toStringOrEmpty(rawItem.title);
      completed = Boolean(rawItem.completed);
      providedId = rawItem.id || rawItem.subtaskId || rawItem.key || null;
      if (Number.isFinite(rawItem.order)) {
        orderValue = rawItem.order;
      }
    }

    let id = providedId ? String(providedId) : uuidv4();
    while (seenIds.has(id)) {
      id = uuidv4();
    }
    seenIds.add(id);

    normalized.push({
      id,
      title,
      completed,
      order: orderValue,
    });
  });

  return normalized
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index }));
}

module.exports = {
  normalizeSubtasksInput,
};
