const { app } = require('@azure/functions');
const { weeklyLeasingReportContainer } = require('./weeklyLeasingReportStore');
const { notifyWeeklyReportRowDeleted } = require('./slackClient');

function getQueryParam(request, key) {
  if (request?.query?.get) {
    return request.query.get(key);
  }
  if (request?.query && typeof request.query === 'object') {
    return request.query[key];
  }
  return null;
}

app.http('DeleteWeeklyLeasingReport', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'DeleteWeeklyLeasingReport/{id}',
  handler: async (request, context) => {
    try {
      const id = request.params?.id;
      if (!id) {
        return { status: 400, jsonBody: { message: 'Record id is required.' } };
      }

      const reportDate = getQueryParam(request, 'reportDate');
      if (!reportDate) {
        return { status: 400, jsonBody: { message: 'reportDate query parameter is required.' } };
      }

      const container = await weeklyLeasingReportContainer();
      let existing;
      try {
        const { resource } = await container.item(id, reportDate).read();
        existing = resource;
      } catch (error) {
        if (error?.code === 404 || error?.code === 'NotFound') {
          return { status: 404, jsonBody: { message: 'Weekly report record not found.' } };
        }
        throw error;
      }

      await container.item(id, reportDate).delete();
      if (existing) {
        notifyWeeklyReportRowDeleted(existing, context).catch(() => {});
      }

      return { status: 204 };
    } catch (error) {
      if (error?.code === 404 || error?.code === 'NotFound') {
        return { status: 404, jsonBody: { message: 'Weekly report record not found.' } };
      }
      context.log('DeleteWeeklyLeasingReport failed', error);
      return { status: 500, jsonBody: { message: 'Failed to delete weekly report record.' } };
    }
  },
});
