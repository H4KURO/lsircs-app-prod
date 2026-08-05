const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');

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

app.http('DeleteAssetChatMessage', {
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
        return { status: 400, body: 'Message id is required.' };
      }

      const container = messagesContainer();

      const { resource: existing } = await container.item(id, id).read();
      if (!existing) {
        return { status: 404, body: 'Message not found.' };
      }
      if (existing.senderEmail !== clientPrincipal.userDetails) {
        return { status: 403, body: 'You can only delete your own messages.' };
      }

      await container.item(id, id).delete();

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
        return { status: 404, body: 'Message not found.' };
      }
      context.log('DeleteAssetChatMessage failed', error);
      return { status: 500, body: 'Error deleting chat message.' };
    }
  },
});
