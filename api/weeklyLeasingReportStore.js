const { ensureNamedContainer } = require('./cosmosClient');

const CONTAINER_KEYS = [
  'COSMOS_WEEKLY_LEASING_REPORTS_CONTAINER',
  'COSMOS_WEEKLY_REPORTS_CONTAINER',
  'CosmosWeeklyLeasingReportsContainer',
  'CosmosWeeklyReportsContainer',
];

const PARTITION_KEY = '/reportDate';

async function weeklyLeasingReportContainer() {
  return ensureNamedContainer('WeeklyLeasingReports', {
    overrideKeys: CONTAINER_KEYS,
    partitionKey: PARTITION_KEY,
  });
}

module.exports = {
  weeklyLeasingReportContainer,
};
