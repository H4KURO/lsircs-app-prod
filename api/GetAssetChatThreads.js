const { app } = require('@azure/functions');
const { ensureNamedContainer } = require('./cosmosClient');

const threadsContainer = () =>
  ensureNamedContainer('AssetChatThreads', { overrideKeys: ['COSMOS_ASSET_CHAT_THREADS_CONTAINER'] });

app.http('GetAssetChatThreads', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const container = await threadsContainer();
      const { resources } = await container.items
        .query('SELECT * FROM c')
        .fetchAll();

      resources.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

      return { status: 200, jsonBody: resources };
    } catch (error) {
      const message = error.message || '';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('GetAssetChatThreads failed', error);
      return { status: 500, body: 'Error fetching chat threads.' };
    }
  },
});
