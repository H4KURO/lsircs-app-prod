const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { splitAttachmentsByUploadRequirement, toTrimmedString } = require('./attachmentUtils');
const { generateContent, getModelId } = require('./geminiClient');
const { serviceEstimatesContainer, resolvePartitionKey, DEFAULT_PARTITION_VALUE } = require('./serviceEstimateStore');

const MAX_EXAMPLES = 50;
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 16 * 1024 * 1024; // 16MB per file to accommodate PDFs

function safeJsonParse(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced ? fenced[1] : text;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function normaliseNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const digits = value.replace(/[^0-9.+-]/g, '');
    const parsed = Number(digits);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function normaliseAreaSqm(value) {
  const numeric = normaliseNumber(value);
  if (numeric !== null) {
    if (typeof value === 'string' && /坪/.test(value)) {
      return Math.round(numeric * 3.306);
    }
    return numeric;
  }
  return null;
}

function normaliseLayout(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function normaliseRegion(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed;
}

function mergePropertyDetails(userInput = {}, extracted = {}) {
  const areaSqm = normaliseAreaSqm(userInput.areaSqm ?? extracted.areaSqm);
  return {
    propertyId: toTrimmedString(userInput.propertyId || extracted.propertyId),
    name: toTrimmedString(userInput.name || extracted.name),
    layout: normaliseLayout(userInput.layout || extracted.layout),
    areaSqm,
    region: normaliseRegion(userInput.region || extracted.region),
    address: toTrimmedString(userInput.address || extracted.address),
    buildingType: toTrimmedString(userInput.buildingType || extracted.buildingType),
    rooms: normaliseNumber(userInput.rooms ?? extracted.rooms),
    yearBuilt: normaliseNumber(userInput.yearBuilt ?? extracted.yearBuilt),
    notes: toTrimmedString(userInput.notes || extracted.notes),
    features: Array.isArray(userInput.features) && userInput.features.length > 0
      ? userInput.features
      : Array.isArray(extracted.features) ? extracted.features : [],
    sourceSummary: toTrimmedString(extracted.summary),
  };
}

function attachmentParts(newAttachments = []) {
  return newAttachments.map((attachment) => ({
    inlineData: {
      data: attachment.dataUrl.slice(attachment.dataUrl.indexOf(',') + 1),
      mimeType: attachment.contentType || 'application/octet-stream',
    },
  }));
}

async function extractPropertyDetails(newAttachments) {
  const prompt = [
    '物件資料（PDF/画像）から見積り計算に必要な属性を抽出してください。',
    '日本語で回答し、JSONのみを返してください。キーは layout, areaSqm, region, address, buildingType, rooms, yearBuilt, summary, features。',
    'areaSqm は平方メートル数値。region は都道府県や市区。features は短い日本語の配列。未知の値は null。',
  ].join('\n');

  const parts = [{ text: prompt }, ...attachmentParts(newAttachments)];
  const { text: responseText } = await generateContent({
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 512,
      responseMimeType: 'application/json',
    },
  });
  const parsed = safeJsonParse(responseText) || {};
  const normalised = {
    layout: normaliseLayout(parsed.layout),
    areaSqm: normaliseAreaSqm(parsed.areaSqm),
    region: normaliseRegion(parsed.region),
    address: toTrimmedString(parsed.address),
    buildingType: toTrimmedString(parsed.buildingType),
    rooms: normaliseNumber(parsed.rooms),
    yearBuilt: normaliseNumber(parsed.yearBuilt),
    summary: toTrimmedString(parsed.summary),
    features: Array.isArray(parsed.features)
      ? parsed.features.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
      : [],
    rawModelText: responseText.slice(0, 4000),
  };
  return normalised;
}

async function loadRecentExamples(container) {
  const querySpec = {
    query: 'SELECT * FROM c WHERE c.type = @type ORDER BY c.createdAt DESC',
    parameters: [{ name: '@type', value: 'service-estimate' }],
  };
  const { resources } = await container.items.query(querySpec).fetchAll();
  return (resources || []).slice(0, MAX_EXAMPLES);
}

function getExampleAmount(example) {
  if (!example || !example.estimate) {
    return null;
  }
  return (
    normaliseNumber(example.estimate.userAmount) ??
    normaliseNumber(example.estimate.aiAmount) ??
    null
  );
}

function scoreExample(example, target) {
  let score = 0;
  const amount = getExampleAmount(example);
  if (amount !== null) {
    score += 1;
  }
  const exampleRegion = toTrimmedString(example?.property?.region).toLowerCase();
  const targetRegion = toTrimmedString(target.region).toLowerCase();
  if (exampleRegion && targetRegion && exampleRegion === targetRegion) {
    score += 3;
  } else if (exampleRegion && targetRegion && exampleRegion.includes(targetRegion)) {
    score += 1.5;
  }

  const exampleLayout = toTrimmedString(example?.property?.layout).toLowerCase();
  const targetLayout = toTrimmedString(target.layout).toLowerCase();
  if (exampleLayout && targetLayout && exampleLayout === targetLayout) {
    score += 1.5;
  }

  const exampleArea = normaliseAreaSqm(example?.property?.areaSqm);
  const targetArea = normaliseAreaSqm(target.areaSqm);
  if (exampleArea !== null && targetArea !== null) {
    const diff = Math.abs(exampleArea - targetArea);
    const maxArea = Math.max(exampleArea, targetArea, 1);
    const closeness = 1 - Math.min(diff / maxArea, 1);
    score += closeness * 2;
  }

  if (example.estimate?.userAmount) {
    score += 0.5;
  }

  return score;
}

function rankExamples(examples, target) {
  return examples
    .map((ex) => ({ example: ex, score: scoreExample(ex, target) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.example);
}

function computeBaselineEstimate(details, examples = []) {
  const amounts = examples
    .map(getExampleAmount)
    .filter((value) => typeof value === 'number' && Number.isFinite(value));

  if (amounts.length > 0) {
    const sorted = [...amounts].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
    return Math.round(median);
  }

  const area = normaliseAreaSqm(details.areaSqm) || 50;
  const ratePerSqm = 1200; // fallback heuristic JPY/㎡
  return Math.round(area * ratePerSqm);
}

function buildComparableSummary(examples) {
  return examples.map((ex) => ({
    id: ex.id,
    layout: ex?.property?.layout || null,
    areaSqm: normaliseAreaSqm(ex?.property?.areaSqm),
    region: ex?.property?.region || null,
    aiAmount: normaliseNumber(ex?.estimate?.aiAmount),
    userAmount: normaliseNumber(ex?.estimate?.userAmount),
    notes: ex?.estimate?.userNotes || (Array.isArray(ex?.estimate?.rationale) ? ex.estimate.rationale.join(' / ') : null),
    createdAt: ex?.createdAt,
  }));
}

async function generateEstimate(propertyDetails, comparableExamples, fallbackEstimate) {
  const comps = buildComparableSummary(comparableExamples);
  const prompt = [
    'あなたは不動産サービス費用の見積りアシスタントです。',
    '入力された物件条件と類似事例をもとに、日本円でサービス費用を算出してください。',
    '必ず JSON のみを返し、キーは estimate (number), currency, rationale (日本語配列), usedExampleIds, confidence (0-1) です。',
    '出力例: {"estimate": 123000, "currency": "JPY", "rationale": ["面積が60㎡で2LDK", "同地域の事例平均に近い"], "usedExampleIds": ["..."], "confidence": 0.62}',
    '根拠は最大4件に抑え、通貨は常に JPY。極端な金額は避けること。',
    `物件条件: ${JSON.stringify(propertyDetails)}`,
    `類似事例: ${JSON.stringify(comps)}`,
  ].join('\n');

  const { text: responseText } = await generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.15,
      maxOutputTokens: 512,
      responseMimeType: 'application/json',
    },
  });
  const parsed = safeJsonParse(responseText) || {};
  const amount =
    normaliseNumber(parsed.estimate ?? parsed.amount ?? parsed.price) ?? fallbackEstimate;
  const rationale = Array.isArray(parsed.rationale)
    ? parsed.rationale.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
    : [];
  const usedExampleIds = Array.isArray(parsed.usedExampleIds)
    ? parsed.usedExampleIds.filter((id) => typeof id === 'string' && id.trim())
    : [];
  const confidence = normaliseNumber(parsed.confidence);

  return {
    amount,
    currency: toTrimmedString(parsed.currency || 'JPY') || 'JPY',
    rationale,
    usedExampleIds,
    confidence: typeof confidence === 'number' && confidence >= 0 ? Math.min(confidence, 1) : null,
    rawModelText: responseText.slice(0, 4000),
  };
}

app.http('EstimateServiceCost', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const payload = await request.json();
      const { existingAttachments, newAttachments } = splitAttachmentsByUploadRequirement(
        payload?.attachments,
        { maxCount: MAX_ATTACHMENTS, maxBytes: MAX_ATTACHMENT_BYTES },
      );
      if (existingAttachments.length > 0) {
        return { status: 400, body: '既存の添付ではなく、新しいPDF/画像を送ってください。' };
      }

      const userPropertyInput = payload?.property || payload;
      context.log(`[EstimateServiceCost] model=${getModelId()} apiVersion=${process.env.GEMINI_API_VERSION || process.env.GENAI_API_VERSION || 'v1'}`);
      let extracted = {};

      if (newAttachments.length > 0) {
        extracted = await extractPropertyDetails(newAttachments);
      }

      const propertyDetails = mergePropertyDetails(userPropertyInput, extracted);
      if (!propertyDetails.layout && !propertyDetails.areaSqm && !propertyDetails.region) {
        return { status: 400, body: '間取り・面積・地域のいずれか、またはPDF/画像から抽出可能な情報を提供してください。' };
      }

      const container = await serviceEstimatesContainer();
      const recentExamples = await loadRecentExamples(container);
      const ranked = rankExamples(recentExamples, propertyDetails);
      const fallbackEstimate = computeBaselineEstimate(propertyDetails, ranked);
      const estimate = await generateEstimate(propertyDetails, ranked.slice(0, 6), fallbackEstimate);

      const now = new Date().toISOString();
      const id = uuidv4();
      const partitionKey = resolvePartitionKey(propertyDetails) || DEFAULT_PARTITION_VALUE;
      const record = {
        id,
        partitionKey,
        type: 'service-estimate',
        status: 'ai_draft',
        property: propertyDetails,
        attachmentsMeta: newAttachments.map((file) => ({
          id: file.id,
          name: file.name,
          contentType: file.contentType,
          size: file.size,
          uploadedAt: file.uploadedAt,
        })),
        estimate: {
          aiAmount: estimate.amount,
          currency: estimate.currency,
          rationale: estimate.rationale,
          usedExampleIds: estimate.usedExampleIds,
          confidence: estimate.confidence,
          model: getModelId(),
        },
        pdfExtraction: extracted?.rawModelText
          ? {
              summary: extracted.summary,
              rawModelText: extracted.rawModelText,
            }
          : null,
        similarExamples: buildComparableSummary(ranked.slice(0, 6)),
        createdAt: now,
        updatedAt: now,
        source: 'gemini',
      };

      await container.items.create(record);

      return {
        status: 200,
        jsonBody: {
          estimateId: id,
          estimate: {
            amount: estimate.amount,
            currency: estimate.currency,
            rationale: estimate.rationale,
            usedExampleIds: estimate.usedExampleIds,
            confidence: estimate.confidence,
          },
          property: propertyDetails,
          similarExamples: record.similarExamples,
        },
      };
    } catch (error) {
      if (error?.code === 'ValidationError') {
        return { status: 400, body: error.message };
      }
      if (error?.code === 'MissingGeminiApiKey') {
        return { status: 500, body: 'Gemini API key is not configured.' };
      }
      const message = error?.message || 'Failed to generate estimate.';
      context.log('EstimateServiceCost failed', error);
      return { status: 500, body: message.slice(0, 500) };
    }
  },
});
