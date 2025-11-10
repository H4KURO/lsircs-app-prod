const { ensureNamedContainer } = require('./cosmosClient');

const CONTAINER_KEYS = [
  'COSMOS_MANAGED_PROPERTIES_CONTAINER',
  'COSMOS_MANAGED_PROPERTY_CONTAINER',
  'CosmosManagedPropertiesContainer',
];
const PARTITION_KEY = '/id';

async function managedPropertiesContainer() {
  return ensureNamedContainer('ManagedProperties', {
    overrideKeys: CONTAINER_KEYS,
    partitionKey: PARTITION_KEY,
  });
}

module.exports = {
  managedPropertiesContainer,
};
