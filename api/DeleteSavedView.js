const { app } = require('@azure/functions');
const {
  usersContainer,
  parseClientPrincipal,
  getPrincipalUserId,
  getOrCreateUserProfile,
} = require('./userProfileStore');

app.http('DeleteSavedView', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'DeleteSavedView/{id}',
  handler: async (request, context) => {
    const principal = parseClientPrincipal(request);
    if (!principal) return { status: 401, body: 'Not logged in' };
    const userId = getPrincipalUserId(principal);
    if (!userId) return { status: 400, body: 'Missing userId' };

    const viewId = request.params?.id;
    if (!viewId) return { status: 400, body: 'View id is required' };

    try {
      const container = await usersContainer();
      const { profile } = await getOrCreateUserProfile(container, principal, { context });
      const existing = Array.isArray(profile.savedViews) ? profile.savedViews : [];
      const updated = existing.filter(v => v.id !== viewId);

      const updatedProfile = { ...profile, savedViews: updated, updatedAt: new Date().toISOString() };
      await container.item(profile.id, profile.id).replace(updatedProfile, { disableAutomaticIdGeneration: true });

      return { status: 200, jsonBody: updated };
    } catch (error) {
      context.log('DeleteSavedView failed', error);
      return { status: 500, body: 'Error deleting saved view.' };
    }
  },
});
