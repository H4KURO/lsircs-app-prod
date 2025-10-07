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

function getPrincipalUserId(principal) {
  if (!principal || typeof principal.userId !== 'string') {
    return null;
  }
  const trimmed = principal.userId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildDefaultProfile(principal, userId, timestamp = new Date().toISOString()) {
  return {
    id: userId,
    userId,
    identityProvider: principal?.identityProvider,
    userDetails: principal?.userDetails,
    displayName: principal?.userDetails || '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

async function getOrCreateUserProfile(container, principal, { context } = {}) {
  const userId = getPrincipalUserId(principal);
  if (!userId) {
    const error = new Error('Client principal did not include a userId.');
    error.code = 'MissingUserId';
    throw error;
  }

  try {
    const { resource } = await container.item(userId, userId).read();
    if (resource) {
      return { profile: resource, created: false };
    }
  } catch (readError) {
    if (readError?.code !== 404 && readError?.code !== 'NotFound') {
      throw readError;
    }
  }

  const timestamp = new Date().toISOString();
  const newProfile = buildDefaultProfile(principal, userId, timestamp);
  const { resource } = await container.items.create(newProfile, {
    disableAutomaticIdGeneration: true,
  });
  if (context && typeof context.log === 'function') {
    context.log('Created user profile', userId);
  }
  return { profile: resource, created: true };
}

async function readUserProfile(container, userId) {
  const { resource } = await container.item(userId, userId).read();
  return resource;
}

module.exports = {
  usersContainer,
  parseClientPrincipal,
  getPrincipalUserId,
  buildDefaultProfile,
  getOrCreateUserProfile,
  readUserProfile,
};
