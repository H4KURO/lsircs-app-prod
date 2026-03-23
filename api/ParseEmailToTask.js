const { app } = require('@azure/functions');
const Anthropic = require('@anthropic-ai/sdk');

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

app.http('ParseEmailToTask', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { status: 500, body: 'ANTHROPIC_API_KEY is not configured.' };
    }

    let subject, body;
    try {
      const payload = await request.json();
      subject = typeof payload?.subject === 'string' ? payload.subject.trim() : '';
      body = typeof payload?.body === 'string' ? payload.body.trim() : '';
    } catch {
      return { status: 400, body: 'Invalid request body.' };
    }

    if (!subject && !body) {
      return { status: 400, body: 'Subject or body is required.' };
    }

    try {
      const client = new Anthropic({ apiKey });

      const prompt = `あなたはハワイの不動産管理会社（PM会社）から日本のオフィス宛に届いた英語メールを解析するアシスタントです。
以下のメールを日本語に翻訳し、タスク管理システム用の情報を抽出してください。

件名: ${subject || '（なし）'}
本文:
${body || '（なし）'}

以下のJSON形式で回答してください（他のテキストは不要です）:
{
  "title": "タスクのタイトル（日本語、50文字以内、物件名や案件の要点を含める）",
  "description": "タスクの詳細説明（日本語、メール内容を要約・翻訳したもの、300文字以内）",
  "originalSummary": "メール内容の日本語要約（オーナーへの報告用、150文字以内）"
}`;

      const message = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const responseText = message.content[0]?.text ?? '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        context.log('ParseEmailToTask: no JSON found in response', responseText);
        return { status: 500, body: 'Failed to parse AI response.' };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        status: 200,
        jsonBody: {
          title: typeof parsed.title === 'string' ? parsed.title : '',
          description: typeof parsed.description === 'string' ? parsed.description : '',
          originalSummary: typeof parsed.originalSummary === 'string' ? parsed.originalSummary : '',
          tags: ['PM案件'],
        },
      };
    } catch (error) {
      context.log('ParseEmailToTask failed', error);
      return { status: 500, body: 'Failed to analyze email.' };
    }
  },
});
