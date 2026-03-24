const { google } = require('googleapis');
const crypto = require('crypto');

let cachedAuth = null;

function resolveSetting(keys, fallback = null) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return fallback;
}

/**
 * Azure App Settings の秘密鍵を正規化する。
 * 1. literal \n → 実際の改行に変換
 * 2. PKCS#8 → PKCS#1 (RSA PRIVATE KEY) へ変換
 *    Node.js 20 / OpenSSL 3 では PKCS#1 の方が互換性が高い
 */
function buildPrivateKey(raw) {
  const pem = raw.replace(/\\n/g, '\n');
  try {
    const keyObj = crypto.createPrivateKey({ key: pem, format: 'pem' });
    return keyObj.export({ type: 'pkcs1', format: 'pem' }).toString();
  } catch (_) {
    // 変換失敗時はそのまま使う
    return pem;
  }
}

function getSheetsClient() {
  const clientEmail = resolveSetting(['GOOGLE_SA_CLIENT_EMAIL']);
  const privateKey = resolveSetting(['GOOGLE_SA_PRIVATE_KEY']);

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Google Service Account credentials are not configured. ' +
        'Set GOOGLE_SA_CLIENT_EMAIL and GOOGLE_SA_PRIVATE_KEY environment variables.'
    );
  }

  if (!cachedAuth) {
    const finalKey = buildPrivateKey(privateKey);
    cachedAuth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: finalKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }

  return google.sheets({ version: 'v4', auth: cachedAuth });
}

module.exports = { getSheetsClient };
