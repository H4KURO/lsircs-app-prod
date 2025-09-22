const { CosmosClient } = require('@azure/cosmos');

let cachedClient;

function resolveConnectionString() {
  return (
    process.env.CosmosDbConnectionString ||
    process.env.CosmosDBConnectionString ||
    process.env.COSMOS_DB_CONNECTION_STRING ||
    null
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

function getContainer(databaseId, containerId) {
  return getCosmosClient().database(databaseId).container(containerId);
}

module.exports = {
  getCosmosClient,
  getContainer,
};