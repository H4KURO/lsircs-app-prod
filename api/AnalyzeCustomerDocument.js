const { app } = require('@azure/functions');
const { splitAttachmentsByUploadRequirement, validationError } = require('./attachmentUtils');
const { buildGenerativeModel, getModelId } = require('./geminiClient');

function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    throw validationError('Attachments must include encoded data.', 'InvalidAttachment');
  }
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) {
    throw validationError('Invalid attachment encoding.', 'InvalidAttachment');
  }
  return {
    mimeType: match[1],
    base64Data: match[2],
  };
}

function tryParseJson(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }
  const fencedMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fencedMatch ? fencedMatch[1] : text;
  try {
    return JSON.parse(candidate);
  } catch (error) {
    return null;
  }
}

function normalisePrice(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const digits = value.replace(/[^0-9.-]/g, '');
    const parsed = Number(digits);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function normaliseExtractedFields(raw = {}) {
  const fields = raw.fields || raw.extracted || raw;
  return {
    name: typeof fields?.name === 'string' ? fields.name.trim() : '',
    property: typeof fields?.property === 'string' ? fields.property.trim() : '',
    price: normalisePrice(fields?.price),
    owner: typeof fields?.owner === 'string' ? fields.owner.trim() : '',
  };
}

function parseModelResponse(text) {
  const parsed = tryParseJson(text) || {};
  const extracted = normaliseExtractedFields(parsed);
  const summary =
    typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
      ? parsed.summary.trim()
      : (text || '').trim();
  const notes = Array.isArray(parsed.notes)
    ? parsed.notes.filter((note) => typeof note === 'string' && note.trim().length > 0)
    : [];
  const missingFields = Object.entries(extracted)
    .filter(([, value]) => value === '' || value === null || value === undefined)
    .map(([key]) => key);

  return {
    summary: summary.slice(0, 800),
    extracted,
    notes,
    missingFields,
    raw: (text || '').slice(0, 4000),
  };
}

app.http('AnalyzeCustomerDocument', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const payload = await request.json();
      const { existingAttachments, newAttachments } = splitAttachmentsByUploadRequirement(
        payload?.attachments,
      );
      if (existingAttachments.length > 0) {
        return {
          status: 400,
          body: 'Only newly uploaded files can be analyzed. Please re-upload the PDFs or images.',
        };
      }
      if (newAttachments.length === 0) {
        return { status: 400, body: 'At least one PDF or image is required for analysis.' };
      }

      const model = buildGenerativeModel();
      const prompt = [
        'You are a bilingual assistant that reads Japanese/English PDFs or photos for property leasing.',
        'Extract the fields needed to register a customer in a CRM and summarize the document.',
        'Search both Japanese and English text. Look for: customer/recipient/company names, property/building names or addresses, price/amount,担当/owner/contact/agent names.',
        'If you cannot find a field, set it to null or an empty string (no guesses).',
        'Return a single JSON object only, no extra text, with this shape:',
        '{',
        '  "summary": "<120 characters in Japanese summarizing the document>",',
        '  "fields": {',
        '    "name": "Customer or company name",',
        '    "property": "Property/building/unit name or address if present",',
        '    "price": <number or null>,',
        '    "owner": "担当者/営業/primary contact name if present"',
        '  },',
        '  "notes": ["short bullet insights in Japanese"]',
        '}',
        'Use numbers only for price (JPY). Set missing items to null or empty strings.',
      ].join('\n');

      const parts = [{ text: prompt }];
      for (const attachment of newAttachments) {
        const { mimeType, base64Data } = parseDataUrl(attachment.dataUrl);
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: attachment.contentType || mimeType || 'application/octet-stream',
          },
        });
      }

      const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 512,
          responseMimeType: 'application/json',
        },
      });

      const responseText = result?.response?.text?.() || '';
      const parsed = parseModelResponse(responseText);

      return {
        status: 200,
        jsonBody: {
          summary: parsed.summary,
          extracted: parsed.extracted,
          notes: parsed.notes,
          missingFields: parsed.missingFields,
          rawModelText: parsed.raw,
          model: getModelId(),
        },
      };
    } catch (error) {
      const message = error?.message || 'Failed to analyze document.';
      const safeDetails = typeof message === 'string' ? message.slice(0, 500) : 'Unknown error';
      if (error?.code === 'ValidationError') {
        return { status: 400, body: safeDetails };
      }
      if (error?.code === 'MissingGeminiApiKey' || message.includes('Gemini API key')) {
        return { status: 500, body: safeDetails };
      }
      context.log('AnalyzeCustomerDocument failed', error);
      return {
        status: 500,
        body: safeDetails || 'Failed to analyze document.',
      };
    }
  },
});
