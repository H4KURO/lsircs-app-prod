const { app } = require('@azure/functions');
const Anthropic = require('@anthropic-ai/sdk');
const documentTypes = require('./pdfDocumentTypes');

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

// POST /api/PdfExtract
// Body: { base64: string, documentTypeId: string }
// Returns: { fields: { [key]: string }, documentType: object }
// ※ 個人情報を含む抽出結果はログに記録しない
app.http('PdfExtract', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) return { status: 401, body: 'Unauthorized' };

    let documentTypeId;
    try {
      const body = await request.json();
      const { base64, documentTypeId: dtId } = body;
      documentTypeId = dtId;

      if (!base64 || !documentTypeId) {
        return { status: 400, body: 'base64 and documentTypeId are required.' };
      }

      // ドキュメント種別の取得
      const docType = documentTypes.find((d) => d.id === documentTypeId);
      if (!docType) {
        return { status: 400, body: `Unknown documentTypeId: ${documentTypeId}` };
      }

      // Claude でPDF直接読み取り＋構造化（1ステップ）
      context.log(`PdfExtract: Starting Claude PDF extraction for type=${documentTypeId} by ${clientPrincipal.userDetails}`);
      const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
      if (!anthropicApiKey) throw new Error('ANTHROPIC_API_KEY is not set.');

      const anthropic = new Anthropic({ apiKey: anthropicApiKey });
      const claudeMessage = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: base64,
                },
              },
              {
                type: 'text',
                text: docType.claudePrompt,
              },
            ],
          },
        ],
      });

      const rawJson = claudeMessage.content[0].text.trim();
      // ※ 個人情報を含むため rawJson はログに出力しない

      // JSON パース
      let extractedFields;
      try {
        // コードブロック記号が混入した場合に除去
        const cleaned = rawJson.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
        extractedFields = JSON.parse(cleaned);
      } catch {
        context.log('PdfExtract: Claude returned non-JSON, using raw text');
        extractedFields = { rawText: rawJson };
      }

      context.log(`PdfExtract: Claude extraction complete for type=${documentTypeId} by ${clientPrincipal.userDetails}`);

      return {
        status: 200,
        jsonBody: {
          documentType: {
            id: docType.id,
            label: docType.label,
            labelJa: docType.labelJa,
            extractFields: docType.extractFields,
            registrationTarget: docType.registrationTarget,
          },
          fields: extractedFields,
        },
      };
    } catch (error) {
      context.log(`PdfExtract failed for type=${documentTypeId}:`, error.message);
      return { status: 500, body: `Error: ${error.message}` };
    }
  },
});
