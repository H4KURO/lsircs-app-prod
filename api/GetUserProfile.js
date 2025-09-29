const { app } = require('@azure/functions');
const { ensureNamedContainer } = require('./cosmosClient');

const USER_CONTAINER_KEYS = ['COSMOS_USERS_CONTAINER', 'COSMOS_USER_CONTAINER', 'CosmosUsersContainer'];
const USER_PARTITION_KEY = '/id';

async function usersContainer() {
  return ensureNamedContainer('Users', {
    overrideKeys: USER_CONTAINER_KEYS,
    partitionKey: USER_PARTITION_KEY,
  });
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

app.http('GetUserProfile', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const principal = parseClientPrincipal(request);
    if (!principal) {
      return { status: 401, body: 'Not logged in' };
    }

    const userId = principal.userId;
    if (!userId) {
      context.log('Client principal is missing userId', principal);
      return { status: 400, body: 'Client principal did not include a userId.' };
    }

    try {
      const container = await usersContainer();

      try {
        const { resource } = await container.item(userId, userId).read();
        if (resource) {
          return { status: 200, jsonBody: resource };
        }
        context.log('User profile read returned empty resource', userId);
      } catch (readError) {
        if (readError?.code !== 404 && readError?.code !== 'NotFound') {
          throw readError;
        }
        context.log('User profile not found, provisioning new profile', userId);
      }

      const now = new Date().toISOString();
      const newUserProfile = {
        id: userId,
        userId,
        identityProvider: principal.identityProvider,
        userDetails: principal.userDetails,
        displayName: principal.userDetails,
        createdAt: now,
        updatedAt: now,
      };

      const { resource: created } = await container.items.create(newUserProfile, {
        disableAutomaticIdGeneration: true,
      });
      return { status: 201, jsonBody: created };
    } catch (error) {
      const message = error.message || 'Error retrieving user profile.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('GetUserProfile failed', error);
      return { status: 500, body: `Error retrieving user profile: ${message}` };
    }
  },
});
