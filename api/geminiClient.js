const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY_KEYS = ['GEMINI_API_KEY', 'GOOGLE_GENAI_API_KEY', 'GENAI_API_KEY'];
const MODEL_KEYS = ['GEMINI_MODEL', 'GEMINI_MODEL_ID'];
const DEFAULT_MODEL = 'gemini-1.5-flash';

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

function buildGenerativeModel() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    const error = new Error('Gemini API key is not configured.');
    error.code = 'MissingGeminiApiKey';
    throw error;
  }
  const client = new GoogleGenerativeAI(apiKey);
  return client.getGenerativeModel({ model: getModelId() });
}

module.exports = {
  buildGenerativeModel,
  getGeminiApiKey,
  getModelId,
};
