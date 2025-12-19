const axios = require('axios');

const API_KEY_KEYS = ['GEMINI_API_KEY', 'GOOGLE_GENAI_API_KEY', 'GENAI_API_KEY'];
const MODEL_KEYS = ['GEMINI_MODEL', 'GEMINI_MODEL_ID'];
// 2.5 はロケーション制限にかかりやすいためデフォルトを 1.5-flash に設定
const DEFAULT_MODEL = 'gemini-1.5-flash';
// API バージョンは v1 に固定（v1beta を避ける）
const DEFAULT_API_VERSION = 'v1';

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
  // 環境変数で上書き可能
  return resolveSetting(MODEL_KEYS, DEFAULT_MODEL);
}

function getApiVersion() {
  return DEFAULT_API_VERSION;
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

function extractTextFromResponse(data) {
  const candidates = data?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return '';
  }
  const parts = candidates[0]?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    return '';
  }
  const textPart = parts.find((p) => typeof p.text === 'string');
  return textPart?.text || '';
}

async function generateContent({ contents, generationConfig }) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    const error = new Error('Gemini API key is not configured.');
    error.code = 'MissingGeminiApiKey';
    throw error;
  }

  const model = normaliseModelId(getModelId());
  const apiVersion = getApiVersion();
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/${model}:generateContent`;

  const body = {
    contents,
    generationConfig,
  };

  // 基本ログ（Functions の Application Insights に出力）
  // eslint-disable-next-line no-console
  console.log(`[Gemini] init model=${model}, apiVersion=${apiVersion}`);

  try {
    const response = await axios.post(url, body, {
      params: { key: apiKey },
      headers: { 'Content-Type': 'application/json' },
    });
    const text = extractTextFromResponse(response.data);
    return { data: response.data, text };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Gemini] generateContent failed', error?.response?.data || error?.message);
    throw error;
  }
}

module.exports = {
  generateContent,
  getGeminiApiKey,
  getModelId,
  getApiVersion,
};
