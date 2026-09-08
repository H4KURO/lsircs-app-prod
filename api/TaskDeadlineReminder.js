const { app } = require('@azure/functions');

app.http('TaskDeadlineReminder', {
  methods: ['POST', 'GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    context.log('TaskDeadlineReminder called');
    return { status: 200, jsonBody: { ok: true, message: 'alive' } };
  },
});
