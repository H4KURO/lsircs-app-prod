const { app } = require('@azure/functions');
const {
  usersContainer,
  parseClientPrincipal,
  getPrincipalUserId,
  getOrCreateUserProfile,
} = require('./userProfileStore');
const {
  PREFERENCES_SCHEMA_VERSION,
  createDefaultPreferences,
  normalizePreferences,
} = require('./taskViewPreferences');

app.http('GetTaskViewPreferences', {
  methods: ['GET'],
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

    try {
      const container = await usersContainer();
      const { profile, created } = await getOrCreateUserProfile(container, principal, { context });
      const now = new Date().toISOString();
      const existingPreferences = profile?.taskViewPreferences;

      let normalizedPreferences;
      let shouldPersist = false;

      if (existingPreferences) {
        normalizedPreferences = normalizePreferences(
          existingPreferences,
          existingPreferences.updatedAt || profile.updatedAt || now,
        );
        if (existingPreferences.schemaVersion !== PREFERENCES_SCHEMA_VERSION) {
          shouldPersist = true;
        }
      } else {
        normalizedPreferences = createDefaultPreferences(now);
        shouldPersist = true;
      }

      if (shouldPersist || created) {
        const updatedProfile = {
          ...profile,
          taskViewPreferences: normalizedPreferences,
          updatedAt: normalizedPreferences.updatedAt,
        };
        await container
          .item(profile.id, profile.id)
          .replace(updatedProfile, { disableAutomaticIdGeneration: true });
      }

      return { status: 200, jsonBody: normalizedPreferences };
    } catch (error) {
      const message = error.message || 'Error retrieving task view preferences.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('GetTaskViewPreferences failed', error);
      if (error.code === 'MissingUserId') {
        return { status: 400, body: 'Client principal did not include a userId.' };
      }
      return { status: 500, body: `Error retrieving task view preferences: ${message}` };
    }
  },
});
