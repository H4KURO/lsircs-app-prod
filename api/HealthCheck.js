const { app } = require('@azure/functions');

app.http('HealthCheck', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async () => ({ status: 200, body: 'API is alive!' }),
});

