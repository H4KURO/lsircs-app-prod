const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

const threadsContainer = () =>
  getNamedContainer('AssetChatThreads', ['COSMOS_ASSET_CHAT_THREADS_CONTAINER']);

const messagesContainer = () =>
  getNamedContainer('AssetChatMessages', ['COSMOS_ASSET_CHAT_MESSAGES_CONTAINER']);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

app.http('DeleteAssetChatThread', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      const payload = await request.json();
      const { id } = payload;
      if (!id) {
        return { status: 400, body: 'Thread id is required.' };
      }

      const container = threadsContainer();
      await container.item(id, id).delete();

      // スレッドに属するメッセージも合わせて削除する
      try {
        const msgContainer = messagesContainer();
        const { resources: messages } = await msgContainer.items
          .query({ query: 'SELECT c.id FROM c WHERE c.threadId = @threadId', parameters: [{ name: '@threadId', value: id }] })
          .fetchAll();
        await Promise.all(messages.map((m) => msgContainer.item(m.id, m.id).delete().catch(() => {})));
      } catch {
        // メッセージコンテナが無い/空でも致命的ではないため無視
      }

      return { status: 200, jsonBody: { success: true } };
    } catch (error) {
      const message = error.message || '';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      if (
        message.includes('Resource NotFound') ||
        message.includes('Resource Not Found') ||
        error.code === 404
      ) {
        return { status: 404, body: 'Thread not found.' };
      }
      context.log('DeleteAssetChatThread failed', error);
      return { status: 500, body: 'Error deleting chat thread.' };
    }
  },
});
