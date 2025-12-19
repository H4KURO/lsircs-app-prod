const { ensureNamedContainer } = require('./cosmosClient');

const CONTAINER_KEYS = [
  'COSMOS_SERVICE_ESTIMATES_CONTAINER',
  'CosmosServiceEstimatesContainer',
  'COSMOS_SERVICE_COST_ESTIMATES_CONTAINER',
  'CosmosServiceCostEstimatesContainer',
];

const PARTITION_KEY = '/partitionKey';
const DEFAULT_PARTITION_VALUE = 'shared';

async function serviceEstimatesContainer() {
  return ensureNamedContainer('ServiceEstimates', {
    overrideKeys: CONTAINER_KEYS,
    partitionKey: PARTITION_KEY,
  });
}

function resolvePartitionKey(details = {}) {
  const region =
    (typeof details.region === 'string' && details.region.trim()) ||
    (typeof details.prefecture === 'string' && details.prefecture.trim()) ||
    null;
  return region || DEFAULT_PARTITION_VALUE;
}

module.exports = {
  serviceEstimatesContainer,
  resolvePartitionKey,
  DEFAULT_PARTITION_VALUE,
};
