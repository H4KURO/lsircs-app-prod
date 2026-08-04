const { app } = require('@azure/functions');

app.http('SlackTest', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    context.log('SlackTest called');
    return { status: 200, body: 'SlackTest OK' };
  },
});
