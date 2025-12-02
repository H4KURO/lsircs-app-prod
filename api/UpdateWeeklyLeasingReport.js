const { app } = require('@azure/functions');
const { weeklyLeasingReportContainer } = require('./weeklyLeasingReportStore');
const { applyWeeklyReportUpdates } = require('./weeklyLeasingReportUtils');

async function readWeeklyReport(container, id, reportDate) {
  try {
    const { resource } = await container.item(id, reportDate).read();
    return resource;
  } catch (error) {
    if (error?.code === 404 || error?.code === 'NotFound') {
      return null;
    }
    throw error;
  }
}

app.http('UpdateWeeklyLeasingReport', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'UpdateWeeklyLeasingReport/{id}',
  handler: async (request, context) => {
    try {
      const id = request.params?.id;
      if (!id) {
        return { status: 400, jsonBody: { message: 'Weekly report record id is required.' } };
      }

      let payload;
      try {
        payload = await request.json();
      } catch {
        return { status: 400, jsonBody: { message: 'Request body must be valid JSON.' } };
      }

      const reportDate = typeof payload?.reportDate === 'string' ? payload.reportDate.trim() : '';
      if (!reportDate) {
        return { status: 400, jsonBody: { message: 'reportDate is required to update this record.' } };
      }

      const container = await weeklyLeasingReportContainer();
      const existing = await readWeeklyReport(container, id, reportDate);
      if (!existing) {
        return { status: 404, jsonBody: { message: 'Weekly report record not found.' } };
      }

      const updates = { ...payload };
      delete updates.reportDate;

      const next = applyWeeklyReportUpdates(existing, updates);
      const { resource } = await container.item(id, reportDate).replace(next);
      return { status: 200, jsonBody: resource };
    } catch (error) {
      context.log('UpdateWeeklyLeasingReport failed', error);
      return { status: 500, jsonBody: { message: 'Failed to update weekly report record.' } };
    }
  },
});
