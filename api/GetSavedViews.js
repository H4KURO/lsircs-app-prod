const { app } = require('@azure/functions');
const {
  usersContainer,
  parseClientPrincipal,
  getPrincipalUserId,
  getOrCreateUserProfile,
} = require('./userProfileStore');

app.http('GetSavedViews', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const principal = parseClientPrincipal(request);
    if (!principal) return { status: 401, body: 'Not logged in' };
    const userId = getPrincipalUserId(principal);
    if (!userId) return { status: 400, body: 'Missing userId' };

    try {
      const container = await usersContainer();
      const { profile } = await getOrCreateUserProfile(container, principal, { context });
      return { status: 200, jsonBody: Array.isArray(profile.savedViews) ? profile.savedViews : [] };
    } catch (error) {
      context.log('GetSavedViews failed', error);
      return { status: 500, body: 'Error loading saved views.' };
    }
  },
});
