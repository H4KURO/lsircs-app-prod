const PREFERENCES_SCHEMA_VERSION = 1;
const ALLOWED_LAYOUTS = new Set(['category', 'status', 'assignee']);
const ALLOWED_SORT_MODES = new Set(['statusDeadline', 'deadlineAsc', 'deadlineDesc', 'titleAsc']);
const MAX_LIST_LENGTH = 100;

function sanitizeStringArray(value) {
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
    if (result.length >= MAX_LIST_LENGTH) {
      break;
    }
  }
  return result;
}

function createDefaultPreferences(timestamp = new Date().toISOString()) {
  return {
    schemaVersion: PREFERENCES_SCHEMA_VERSION,
    layout: 'category',
    sortMode: 'statusDeadline',
    selectedCategories: [],
    selectedAssignees: [],
    includeUnassignedColumn: true,
    updatedAt: timestamp,
  };
}

function normalizePreferences(preferences = {}, timestamp = new Date().toISOString()) {
  const base = createDefaultPreferences(timestamp);

  const layout = typeof preferences.layout === 'string' && ALLOWED_LAYOUTS.has(preferences.layout)
    ? preferences.layout
    : base.layout;

  const sortMode = typeof preferences.sortMode === 'string' && ALLOWED_SORT_MODES.has(preferences.sortMode)
    ? preferences.sortMode
    : base.sortMode;

  const selectedCategories = sanitizeStringArray(preferences.selectedCategories);
  const selectedAssignees = sanitizeStringArray(preferences.selectedAssignees);

  const includeUnassignedColumn = typeof preferences.includeUnassignedColumn === 'boolean'
    ? preferences.includeUnassignedColumn
    : base.includeUnassignedColumn;

  const updatedAt = typeof preferences.updatedAt === 'string' && preferences.updatedAt.trim().length > 0
    ? preferences.updatedAt
    : timestamp;

  return {
    schemaVersion: PREFERENCES_SCHEMA_VERSION,
    layout,
    sortMode,
    selectedCategories,
    selectedAssignees,
    includeUnassignedColumn,
    updatedAt,
  };
}

module.exports = {
  PREFERENCES_SCHEMA_VERSION,
  createDefaultPreferences,
  normalizePreferences,
};
