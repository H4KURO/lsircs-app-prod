const { app } = require('@azure/functions');
const {
  usersContainer,
  parseClientPrincipal,
  getPrincipalUserId,
  readUserProfile,
} = require('./userProfileStore');

app.http('UpdateUserProfile', {
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

    try {
      const updates = await request.json();
      const displayName = updates?.displayName?.trim();
      if (!displayName) {
        return { status: 400, body: 'Display name is required.' };
      }

      const container = await usersContainer();
      let existing;
      try {
        existing = await readUserProfile(container, userId);
      } catch (readError) {
        if (readError?.code === 404 || readError?.code === 'NotFound') {
          return { status: 404, body: 'User profile not found.' };
        }
        throw readError;
      }

      if (!existing) {
        return { status: 404, body: 'User profile not found.' };
      }

      const now = new Date().toISOString();
      const updatedProfile = { ...existing, displayName, updatedAt: now };
      const { resource } = await container
        .item(userId, userId)
        .replace(updatedProfile, { disableAutomaticIdGeneration: true });
      return { status: 200, jsonBody: resource };
    } catch (error) {
      if (error?.code === 404 || error?.code === 'NotFound') {
        return { status: 404, body: 'User profile not found.' };
      }
      const message = error.message || 'Error updating user profile.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('UpdateUserProfile failed', error);
      return { status: 500, body: `Error updating user profile: ${message}` };
    }
  },
});
