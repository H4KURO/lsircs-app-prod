const { app } = require('@azure/functions');
const {
  usersContainer,
  parseClientPrincipal,
  getPrincipalUserId,
  getOrCreateUserProfile,
} = require('./userProfileStore');

app.http('GetUserProfile', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const principal = parseClientPrincipal(request);
    if (!principal) {
      return { status: 401, body: 'Not logged in' };
    }

    const userId = getPrincipalUserId(principal);
    if (!userId) {
      context.log('Client principal is missing userId', principal);
      return { status: 400, body: 'Client principal did not include a userId.' };
    }

    try {
      const container = await usersContainer();
      const { profile, created } = await getOrCreateUserProfile(container, principal, { context });
      return {
        status: created ? 201 : 200,
        jsonBody: profile,
      };
    } catch (error) {
      const message = error.message || 'Error retrieving user profile.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('GetUserProfile failed', error);
      if (error.code === 'MissingUserId') {
        return { status: 400, body: 'Client principal did not include a userId.' };
      }
      return { status: 500, body: `Error retrieving user profile: ${message}` };
    }
  },
});
