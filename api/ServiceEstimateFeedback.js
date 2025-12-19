const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { validationError, toTrimmedString } = require('./attachmentUtils');
const { serviceEstimatesContainer, DEFAULT_PARTITION_VALUE } = require('./serviceEstimateStore');

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

async function fetchEstimate(container, id) {
  try {
    const { resource } = await container.item(id, DEFAULT_PARTITION_VALUE).read();
    if (resource) {
      return resource;
    }
  } catch (error) {
    if (error?.code !== 404 && error?.code !== 'NotFound') {
      throw error;
    }
  }

  // Fallback to cross-partition query if partition is not the default
  const querySpec = {
    query: 'SELECT * FROM c WHERE c.id = @id',
    parameters: [{ name: '@id', value: id }],
  };
  const { resources } = await container.items.query(querySpec).fetchAll();
  return resources && resources[0] ? resources[0] : null;
}

app.http('ServiceEstimateFeedback', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const payload = await request.json();
      const estimateId = toTrimmedString(payload?.estimateId || payload?.id);
      if (!estimateId) {
        throw validationError('estimateId is required.');
      }

      const amount = normaliseNumber(payload?.finalAmount ?? payload?.amount ?? payload?.userAmount);
      if (amount === null) {
        throw validationError('修正後の金額を数値で指定してください。');
      }
      const notes = toTrimmedString(payload?.notes || payload?.comment);
      const source = toTrimmedString(payload?.source) || 'manual';

      const container = await serviceEstimatesContainer();
      const existing = await fetchEstimate(container, estimateId);
      if (!existing) {
        return { status: 404, body: 'estimate not found.' };
      }

      const now = new Date().toISOString();
      const aiAmount = normaliseNumber(existing?.estimate?.aiAmount);
      const diffFromAi = aiAmount !== null ? amount - aiAmount : null;

      const feedbackEntry = {
        id: uuidv4(),
        amount,
        notes,
        source,
        createdAt: now,
        diffFromAi,
      };

      const updated = {
        ...existing,
        status: 'finalized',
        estimate: {
          ...(existing.estimate || {}),
          aiAmount: aiAmount,
          userAmount: amount,
          userNotes: notes,
          userUpdatedAt: now,
        },
        feedbackHistory: [...(existing.feedbackHistory || []), feedbackEntry],
        updatedAt: now,
      };

      const partitionKey = existing.partitionKey || DEFAULT_PARTITION_VALUE;
      const { resource } = await container.items.upsert(updated, { partitionKey });

      return {
        status: 200,
        jsonBody: {
          estimateId,
          estimate: {
            aiAmount: resource?.estimate?.aiAmount ?? null,
            userAmount: resource?.estimate?.userAmount ?? amount,
            currency: resource?.estimate?.currency ?? 'JPY',
            rationale: resource?.estimate?.rationale ?? [],
            userNotes: resource?.estimate?.userNotes ?? notes,
          },
          feedbackHistory: resource?.feedbackHistory || [],
        },
      };
    } catch (error) {
      if (error?.code === 'ValidationError') {
        return { status: 400, body: error.message };
      }
      const message = error?.message || 'Failed to save feedback.';
      context.log('ServiceEstimateFeedback failed', error);
      return { status: 500, body: message.slice(0, 500) };
    }
  },
});
