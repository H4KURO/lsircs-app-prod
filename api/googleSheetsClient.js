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
  // --- 診断ログ（キーの中身は含めない）---
  const hasLiteralBackslashN = raw.includes('\\n');
  const hasActualNewline    = raw.includes('\n');
  console.log(`[SA Key] rawLen=${raw.length} literalBackslashN=${hasLiteralBackslashN} actualNewline=${hasActualNewline}`);

  // 1. literal \n → 実際の改行
  let pem = raw.replace(/\\n/g, '\n');

  // 2. \\n (ダブルエスケープ) → 実際の改行 (Azure が二重エスケープする場合)
  pem = pem.replace(/\\n/g, '\n');

  const headerOK = pem.startsWith('-----BEGIN PRIVATE KEY-----\n');
  console.log(`[SA Key] pemLen=${pem.length} headerOK=${headerOK} newlines=${(pem.match(/\n/g)||[]).length}`);

  try {
    const keyObj = crypto.createPrivateKey({ key: Buffer.from(pem), format: 'pem' });
    const pkcs1  = keyObj.export({ type: 'pkcs1', format: 'pem' }).toString();
    console.log('[SA Key] PKCS8→PKCS1 conversion: SUCCESS');
    return pkcs1;
  } catch (err) {
    console.log('[SA Key] PKCS8→PKCS1 conversion FAILED:', err.message);
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
