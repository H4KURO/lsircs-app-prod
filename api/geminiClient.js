const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY_KEYS = ['GEMINI_API_KEY', 'GOOGLE_GENAI_API_KEY', 'GENAI_API_KEY'];
const MODEL_KEYS = ['GEMINI_MODEL', 'GEMINI_MODEL_ID'];
const DEFAULT_MODEL = 'gemini-2.5-pro';
const API_VERSION_KEYS = ['GEMINI_API_VERSION', 'GENAI_API_VERSION'];
const DEFAULT_API_VERSION = 'v1'; // Force v1 unless explicitly overridden

function resolveSetting(keys, fallback = null) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return fallback;
}

function getGeminiApiKey() {
  return resolveSetting(API_KEY_KEYS, null);
}

function getModelId() {
  return resolveSetting(MODEL_KEYS, DEFAULT_MODEL);
}

function getApiVersion() {
  const version = resolveSetting(API_VERSION_KEYS, DEFAULT_API_VERSION);
  // If an invalid/empty value is provided, stick to v1 to avoid v1beta fallback.
  return version && typeof version === 'string' ? version.trim() || DEFAULT_API_VERSION : DEFAULT_API_VERSION;
}

function normaliseModelId(modelId) {
  const trimmed = (modelId || '').trim();
  if (!trimmed) {
    return `models/${DEFAULT_MODEL}`;
  }
  if (trimmed.startsWith('models/')) {
    return trimmed;
  }
  return `models/${trimmed}`;
}

function buildGenerativeModel() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    const error = new Error('Gemini API key is not configured.');
    error.code = 'MissingGeminiApiKey';
    throw error;
  }
  const apiVersion = getApiVersion();
  const client = new GoogleGenerativeAI(apiKey, { apiVersion });
  const model = normaliseModelId(getModelId());
  // Basic runtime log to confirm version/model resolution in Functions logs.
  // eslint-disable-next-line no-console
  console.log(`[Gemini] init model=${model}, apiVersion=${apiVersion}`);
  return client.getGenerativeModel({ model });
}

module.exports = {
  buildGenerativeModel,
  getGeminiApiKey,
  getModelId,
  getApiVersion,
};
