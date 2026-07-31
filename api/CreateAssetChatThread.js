const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { ensureNamedContainer } = require('./cosmosClient');

const threadsContainer = () =>
  ensureNamedContainer('AssetChatThreads', { overrideKeys: ['COSMOS_ASSET_CHAT_THREADS_CONTAINER'] });

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

app.http('CreateAssetChatThread', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      const payload = await request.json();

      const title = payload?.title?.trim();
      if (!title) {
        return { status: 400, body: 'Thread title is required.' };
      }

      const container = await threadsContainer();
      const now = new Date().toISOString();

      const thread = {
        id: uuidv4(),
        // フェーズ3は社内スタッフ間チャットのみ。オーナー/顧客チャットはフェーズ4で権限モデルとあわせて追加予定
        type: 'staff',
        title,
        relatedPropertyId: payload.relatedPropertyId ?? null,
        createdAt: now,
        updatedAt: now,
        createdBy: clientPrincipal.userDetails,
      };

      const { resource } = await container.items.create(thread);

      return { status: 201, jsonBody: resource };
    } catch (error) {
      const message = error.message || '';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('CreateAssetChatThread failed', error);
      return { status: 500, body: 'Error creating chat thread.' };
    }
  },
});
