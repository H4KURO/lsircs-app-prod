const { app } = require('@azure/functions');

app.http('HealthCheck', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async () => ({
    status: 200,
    jsonBody: {
      status: 'alive',
      ALLOWED_FUNCTIONS: process.env.ALLOWED_FUNCTIONS || null,
      NODE_ENV: process.env.NODE_ENV || null,
      ts: new Date().toISOString(),
    },
  }),
});

