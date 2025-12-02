const { app } = require('@azure/functions');
const { weeklyLeasingReportContainer } = require('./weeklyLeasingReportStore');
const { buildManualWeeklyReport } = require('./weeklyLeasingReportUtils');

async function recordExists(container, id, reportDate) {
  try {
    const { resource } = await container.item(id, reportDate).read();
    return Boolean(resource);
  } catch (error) {
    if (error?.code === 404 || error?.code === 'NotFound') {
      return false;
    }
    throw error;
  }
}

app.http('CreateWeeklyLeasingReport', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      let payload;
      try {
        payload = await request.json();
      } catch {
        return { status: 400, jsonBody: { message: 'Request body must be valid JSON.' } };
      }

      let document;
      try {
        document = buildManualWeeklyReport(payload);
      } catch (validationError) {
        return { status: 400, jsonBody: { message: validationError.message || 'Invalid payload.' } };
      }
      const container = await weeklyLeasingReportContainer();

      const alreadyExists = await recordExists(container, document.id, document.reportDate);
      if (alreadyExists) {
        return {
          status: 409,
          jsonBody: {
            message: 'A record for this unit already exists on the selected report date.',
          },
        };
      }

      const { resource } = await container.items.create(document);
      return { status: 201, jsonBody: resource };
    } catch (error) {
      const message = error?.message || 'Failed to add weekly leasing report row.';
      context.log('CreateWeeklyLeasingReport failed', error);
      return { status: 500, jsonBody: { message } };
    }
  },
});
