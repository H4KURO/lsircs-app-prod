const { app } = require('@azure/functions');
const { ensureNamedContainer } = require('./cosmosClient');

const messagesContainer = () =>
  ensureNamedContainer('AssetChatMessages', { overrideKeys: ['COSMOS_ASSET_CHAT_MESSAGES_CONTAINER'] });

app.http('GetAssetChatMessages', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const threadId = request.query.get('threadId');
      if (!threadId) {
        return { status: 400, body: 'threadId is required.' };
      }

      const container = await messagesContainer();
      const { resources } = await container.items
        .query({
          query: 'SELECT * FROM c WHERE c.threadId = @threadId',
          parameters: [{ name: '@threadId', value: threadId }],
        })
        .fetchAll();

      resources.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

      return { status: 200, jsonBody: resources };
    } catch (error) {
      const message = error.message || '';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('GetAssetChatMessages failed', error);
      return { status: 500, body: 'Error fetching chat messages.' };
    }
  },
});
