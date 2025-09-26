const { CosmosClient } = require('@azure/cosmos');

let cachedClient;

function resolveSetting(keys, fallback) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return fallback;
}

function resolveConnectionString() {
  return resolveSetting(
    ['CosmosDbConnectionString', 'CosmosDBConnectionString', 'COSMOS_DB_CONNECTION_STRING', 'COSMOSDBCONNECTIONSTRING'],
    null,
  );
}

function getCosmosClient() {
  const connectionString = resolveConnectionString();
  if (!connectionString) {
    throw new Error('Cosmos DB connection string is not configured.');
  }

  if (!cachedClient) {
    cachedClient = new CosmosClient(connectionString);
  }

  return cachedClient;
}

function getConfigValue(possibleKeys, fallback) {
  return resolveSetting(possibleKeys, fallback);
}

const DEFAULT_DATABASE_ID = 'lsircs-database';

function getDatabaseId() {
  return getConfigValue(
    [
      'COSMOS_DATABASE_ID',
      'COSMOS_DB_DATABASE',
      'COSMOS_DB_NAME',
      'CosmosDatabaseId',
      'CosmosDbDatabaseId',
    ],
    DEFAULT_DATABASE_ID,
  );
}

function normaliseKeyFragment(value) {
  return value.replace(/[^A-Za-z0-9]/g, '_').toUpperCase();
}

function getContainerId(defaultId, overrideKeys = []) {
  const keyFragment = normaliseKeyFragment(defaultId);
  const fallbacks = [
    `COSMOS_${keyFragment}_CONTAINER`,
    `COSMOS_DB_${keyFragment}_CONTAINER`,
    `Cosmos${defaultId}Container`,
    `Cosmos${defaultId}Collection`,
  ];
  return getConfigValue([...overrideKeys, ...fallbacks], defaultId);
}

function getContainer(databaseId, containerId) {
  return getCosmosClient().database(databaseId).container(containerId);
}

function getNamedContainer(defaultId, overrideKeys = []) {
  const databaseId = getDatabaseId();
  const containerId = getContainerId(defaultId, overrideKeys);
  return getContainer(databaseId, containerId);
}

module.exports = {
  getCosmosClient,
  getContainer,
  getNamedContainer,
  getDatabaseId,
  getContainerId,
  ensureNamedContainer,
};

async function ensureNamedContainer(defaultId, { overrideKeys = [], partitionKey = '/id', throughput } = {}) {
  const databaseId = getDatabaseId();
  const containerId = getContainerId(defaultId, overrideKeys);
  const client = getCosmosClient();
  const database = client.database(databaseId);

  const containerDefinition = {
    id: containerId,
    partitionKey: {
      paths: [partitionKey],
      kind: 'Hash',
    },
  };

  const options = throughput ? { throughput } : undefined;
  await database.containers.createIfNotExists(containerDefinition, options);
  return database.container(containerId);
}
