const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { ensureNamedContainer, getNamedContainer } = require('./cosmosClient');

const messagesContainer = () =>
  ensureNamedContainer('AssetChatMessages', { overrideKeys: ['COSMOS_ASSET_CHAT_MESSAGES_CONTAINER'] });

const threadsContainer = () =>
  getNamedContainer('AssetChatThreads', ['COSMOS_ASSET_CHAT_THREADS_CONTAINER']);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

app.http('CreateAssetChatMessage', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      const payload = await request.json();

      const threadId = payload?.threadId?.trim();
      if (!threadId) {
        return { status: 400, body: 'threadId is required.' };
      }

      const body = payload?.body?.trim();
      if (!body) {
        return { status: 400, body: 'Message body is required.' };
      }

      const container = await messagesContainer();
      const now = new Date().toISOString();

      const message = {
        id: uuidv4(),
        threadId,
        senderEmail: clientPrincipal.userDetails,
        // 表示名はクライアント側で GetUserProfile から取得したものを渡す（無ければメールアドレスにフォールバック）
        senderName: payload.senderName?.trim() || clientPrincipal.userDetails,
        body,
        createdAt: now,
      };

      const { resource } = await container.items.create(message);

      // スレッド一覧を最新発言順に並べられるよう updatedAt を更新（失敗しても致命的ではない）
      try {
        const threads = threadsContainer();
        await threads.item(threadId, threadId).patch([{ op: 'set', path: '/updatedAt', value: now }]);
      } catch {
        // ignore
      }

      return { status: 201, jsonBody: resource };
    } catch (error) {
      const message = error.message || '';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('CreateAssetChatMessage failed', error);
      return { status: 500, body: 'Error creating chat message.' };
    }
  },
});
