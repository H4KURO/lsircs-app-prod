const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const {
  usersContainer,
  parseClientPrincipal,
  getPrincipalUserId,
  getOrCreateUserProfile,
} = require('./userProfileStore');

const ALLOWED_LAYOUTS = new Set(['category', 'status', 'assignee']);
const ALLOWED_KANBAN_GROUP_BY = new Set(['status', 'category', 'assignee', 'tag']);
const ALLOWED_SORT_MODES = new Set(['statusDeadline', 'deadlineAsc', 'deadlineDesc', 'titleAsc', 'createdAtDesc', 'createdAtAsc']);
const ALLOWED_SECONDARY_GROUP_BY = new Set(['', 'status', 'category', 'importance', 'assignee', 'tag']);
const MAX_SAVED_VIEWS = 20;

function sanitizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(v => typeof v === 'string' && v.trim()).map(v => v.trim()).slice(0, 100);
}

app.http('SaveView', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const principal = parseClientPrincipal(request);
    if (!principal) return { status: 401, body: 'Not logged in' };
    const userId = getPrincipalUserId(principal);
    if (!userId) return { status: 400, body: 'Missing userId' };

    let body;
    try { body = await request.json(); } catch { return { status: 400, body: 'Invalid JSON' }; }

    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) return { status: 400, body: 'name is required' };

    const view = {
      id: body.id || uuidv4(),
      name,
      layout: ALLOWED_LAYOUTS.has(body.layout) ? body.layout : 'category',
      sortMode: ALLOWED_SORT_MODES.has(body.sortMode) ? body.sortMode : 'statusDeadline',
      selectedCategories: sanitizeStringArray(body.selectedCategories),
      selectedAssignees: sanitizeStringArray(body.selectedAssignees),
      includeUnassignedColumn: typeof body.includeUnassignedColumn === 'boolean' ? body.includeUnassignedColumn : true,
      categoryGroupByTag: typeof body.categoryGroupByTag === 'boolean' ? body.categoryGroupByTag : true,
      categoryTaskOrder: body.categoryTaskOrder || 'progress',
      kanbanGroupBy: ALLOWED_KANBAN_GROUP_BY.has(body.kanbanGroupBy) ? body.kanbanGroupBy : 'status',
      secondaryGroupBy: ALLOWED_SECONDARY_GROUP_BY.has(body.secondaryGroupBy) ? body.secondaryGroupBy : '',
      kanbanColumnOrder: sanitizeStringArray(body.kanbanColumnOrder),
      createdAt: new Date().toISOString(),
    };

    try {
      const container = await usersContainer();
      const { profile } = await getOrCreateUserProfile(container, principal, { context });
      const existing = Array.isArray(profile.savedViews) ? profile.savedViews : [];

      // 同名の既存ビューは上書き、そうでなければ追加（上限付き）
      const idx = existing.findIndex(v => v.id === view.id);
      let updated;
      if (idx >= 0) {
        updated = [...existing.slice(0, idx), view, ...existing.slice(idx + 1)];
      } else {
        updated = [...existing, view].slice(-MAX_SAVED_VIEWS);
      }

      const updatedProfile = { ...profile, savedViews: updated, updatedAt: view.createdAt };
      await container.item(profile.id, profile.id).replace(updatedProfile, { disableAutomaticIdGeneration: true });

      return { status: 200, jsonBody: updated };
    } catch (error) {
      context.log('SaveView failed', error);
      return { status: 500, body: 'Error saving view.' };
    }
  },
});
