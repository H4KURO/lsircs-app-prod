const { app } = require('@azure/functions');
const { ensureNamedContainer } = require('./cosmosClient');

const USER_CONTAINER_KEYS = ['COSMOS_USERS_CONTAINER', 'COSMOS_USER_CONTAINER', 'CosmosUsersContainer'];

async function usersContainer() {
  return ensureNamedContainer('Users', { overrideKeys: USER_CONTAINER_KEYS });
}

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

app.http('UpdateUserProfile', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const principal = parseClientPrincipal(request);
    if (!principal) {
      return { status: 401, body: 'Not logged in' };
    }

    try {
      const updates = await request.json();
      const displayName = updates?.displayName?.trim();
      if (!displayName) {
        return { status: 400, body: 'Display name is required.' };
      }

      const container = await usersContainer();
      const { resource: existing } = await container.item(principal.userId, principal.userId).read();
      if (!existing) {
        return { status: 404, body: 'User profile not found.' };
      }

      const now = new Date().toISOString();
      const updatedProfile = { ...existing, displayName, updatedAt: now };
      const { resource } = await container.item(principal.userId, principal.userId).replace(updatedProfile);
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
      return { status: 500, body: 'Error updating user profile.' };
    }
  },
});
