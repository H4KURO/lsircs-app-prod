const { app } = require('@azure/functions');

app.http('PingTest', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    return { status: 200, jsonBody: { pong: true, ts: new Date().toISOString() } };
  },
});
