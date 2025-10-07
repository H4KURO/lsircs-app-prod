const { app } = require('@azure/functions');
const {
  usersContainer,
  parseClientPrincipal,
  getPrincipalUserId,
  getOrCreateUserProfile,
} = require('./userProfileStore');
const { normalizePreferences } = require('./taskViewPreferences');

app.http('UpdateTaskViewPreferences', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const principal = parseClientPrincipal(request);
    if (!principal) {
      return { status: 401, body: 'Not logged in' };
    }

    const userId = getPrincipalUserId(principal);
    if (!userId) {
      return { status: 400, body: 'Client principal did not include a userId.' };
    }

    let payload;
    try {
      payload = await request.json();
    } catch (error) {
      return { status: 400, body: 'Invalid JSON payload.' };
    }

    try {
      const timestamp = new Date().toISOString();
      const preferences = normalizePreferences(payload, timestamp);

      const container = await usersContainer();
      const { profile } = await getOrCreateUserProfile(container, principal, { context });
      const updatedProfile = {
        ...profile,
        taskViewPreferences: preferences,
        updatedAt: preferences.updatedAt,
      };

      const { resource } = await container
        .item(profile.id, profile.id)
        .replace(updatedProfile, { disableAutomaticIdGeneration: true });

      return { status: 200, jsonBody: resource.taskViewPreferences };
    } catch (error) {
      if (error?.code === 'MissingUserId') {
        return { status: 400, body: 'Client principal did not include a userId.' };
      }
      const message = error.message || 'Error updating task view preferences.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('UpdateTaskViewPreferences failed', error);
      return { status: 500, body: `Error updating task view preferences: ${message}` };
    }
  },
});
