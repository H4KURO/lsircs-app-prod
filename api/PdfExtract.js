const { app } = require('@azure/functions');
const pdfParse = require('pdf-parse');
const axios = require('axios');
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
// ※ Azure東アジアからAnthropicへの直接接続はCloudflareにブロックされるため
//   n8nを経由してClaude APIを呼び出す
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

      const docType = documentTypes.find((d) => d.id === documentTypeId);
      if (!docType) {
        return { status: 400, body: `Unknown documentTypeId: ${documentTypeId}` };
      }

      // Step 1: pdf-parse でローカルテキスト抽出（無料・外部API不要）
      context.log(`PdfExtract: Extracting text for type=${documentTypeId} by ${clientPrincipal.userDetails}`);
      const pdfBuffer = Buffer.from(base64, 'base64');
      const pdfData = await pdfParse(pdfBuffer);
      const extractedText = pdfData.text;
      context.log(`PdfExtract: Text extracted (${extractedText.length} chars, ${pdfData.numpages} pages)`);

      // Step 2: n8n webhook 経由で Claude Haiku 呼び出し
      // ※ Azure東アジアからAnthropicへの直接呼び出しはネットワーク制限あり
      const webhookUrl = process.env.N8N_PDF_EXTRACT_WEBHOOK_URL;
      if (!webhookUrl) throw new Error('N8N_PDF_EXTRACT_WEBHOOK_URL is not set.');

      context.log(`PdfExtract: Calling n8n webhook for type=${documentTypeId}`);
      const n8nRes = await axios.post(
        webhookUrl,
        { text: extractedText, prompt: docType.claudePrompt },
        { timeout: 60000 },
      );

      const extractedFields = n8nRes.data.fields;
      context.log(`PdfExtract: Complete for type=${documentTypeId} by ${clientPrincipal.userDetails}`);

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
