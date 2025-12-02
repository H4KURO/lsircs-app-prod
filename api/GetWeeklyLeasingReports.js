const { app } = require('@azure/functions');
const { weeklyLeasingReportContainer } = require('./weeklyLeasingReportStore');

function normaliseReportDate(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }
  return null;
}

function getQueryParam(request, key) {
  if (request?.query?.get) {
    return request.query.get(key);
  }
  if (request?.query && typeof request.query === 'object') {
    return request.query[key];
  }
  return null;
}

async function fetchAvailableReportDates(container) {
  const { resources } = await container.items
    .query('SELECT c.reportDate FROM c WHERE IS_DEFINED(c.reportDate)')
    .fetchAll();

  const unique = Array.from(
    new Set((resources || []).map((item) => item.reportDate).filter((value) => typeof value === 'string' && value)),
  );
  unique.sort((a, b) => b.localeCompare(a));
  return unique;
}

app.http('GetWeeklyLeasingReports', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const container = await weeklyLeasingReportContainer();
      const reportDates = await fetchAvailableReportDates(container);

      if (reportDates.length === 0) {
        return { status: 200, jsonBody: { records: [], availableReportDates: [], reportDate: null } };
      }

      const requestedDate = normaliseReportDate(getQueryParam(request, 'reportDate'));
      const targetDate = requestedDate && reportDates.includes(requestedDate) ? requestedDate : reportDates[0];

      const querySpec = {
        query: 'SELECT * FROM c WHERE c.reportDate = @reportDate ORDER BY c.unit',
        parameters: [{ name: '@reportDate', value: targetDate }],
      };

      const { resources } = await container.items.query(querySpec, { partitionKey: targetDate }).fetchAll();

      return {
        status: 200,
        jsonBody: {
          records: resources || [],
          availableReportDates: reportDates,
          reportDate: targetDate,
        },
      };
    } catch (error) {
      context.log('GetWeeklyLeasingReports failed', error);
      return { status: 500, jsonBody: { message: 'Failed to load weekly leasing reports.' } };
    }
  },
});
