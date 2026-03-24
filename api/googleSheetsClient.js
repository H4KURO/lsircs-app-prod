const { google } = require('googleapis');

let cachedAuth = null;

/**
 * GOOGLE_SA_JSON_B64 (Base64 エンコードされたサービスアカウント JSON) から
 * Google Sheets クライアントを返す。
 * JSON.parse が private_key の \n を正しく実際の改行に変換するため
 * OpenSSL 3 / Node.js 20 環境での互換性問題を回避できる。
 */
function getSheetsClient() {
  if (!cachedAuth) {
    const b64 = process.env.GOOGLE_SA_JSON_B64;

    if (!b64) {
      throw new Error(
        'Google Service Account credentials are not configured. ' +
        'Set GOOGLE_SA_JSON_B64 environment variable.'
      );
    }

    let credentials;
    try {
      const json = Buffer.from(b64, 'base64').toString('utf8');
      credentials = JSON.parse(json);
    } catch (err) {
      throw new Error('GOOGLE_SA_JSON_B64 のデコードに失敗しました: ' + err.message);
    }

    cachedAuth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }

  return google.sheets({ version: 'v4', auth: cachedAuth });
}

module.exports = { getSheetsClient };
