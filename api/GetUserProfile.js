const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const usersContainer = () =>
  getNamedContainer('Users', ['COSMOS_USERS_CONTAINER', 'COSMOS_USER_CONTAINER', 'CosmosUsersContainer']);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch (error) {
    return null;
  }
}

app.http('GetUserProfile', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const principal = parseClientPrincipal(request);
    if (!principal) {
      return { status: 401, body: 'Not logged in' };
    }

    try {
      const container = usersContainer();
      try {
        const { resource } = await container.item(principal.userId, principal.userId).read();
        return { status: 200, jsonBody: resource };
      } catch (error) {
        if (error?.code === 404) {
          const newUserProfile = {
            id: principal.userId,
            userId: principal.userId,
            identityProvider: principal.identityProvider,
            userDetails: principal.userDetails,
            displayName: principal.userDetails,
            createdAt: new Date().toISOString(),
          };
          const { resource: created } = await container.items.create(newUserProfile);
          return { status: 201, jsonBody: created };
        }
        throw error;
      }
    } catch (error) {
      const message = error.message || 'Error retrieving user profile.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('GetUserProfile failed', error);
      return { status: 500, body: 'Error retrieving user profile.' };
    }
  },
});

