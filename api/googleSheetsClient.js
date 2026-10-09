const { google } = require('googleapis');

let cachedAuth = null;

function getSheetsClient() {
  if (!cachedAuth) {
    // GOOGLE_SA_JSON_B64 (Base64) を優先、なければ GOOGLE_SHEETS_CREDENTIALS (JSON文字列) を使用
    const b64 = process.env.GOOGLE_SA_JSON_B64;
    const rawJson = process.env.GOOGLE_SHEETS_CREDENTIALS;

    let credentials;
    if (b64) {
      try {
        credentials = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
      } catch (err) {
        throw new Error('GOOGLE_SA_JSON_B64 のデコードに失敗しました: ' + err.message);
      }
    } else if (rawJson) {
      try {
        credentials = JSON.parse(rawJson);
      } catch (err) {
        throw new Error('GOOGLE_SHEETS_CREDENTIALS のパースに失敗しました: ' + err.message);
      }
    } else {
      throw new Error(
        'Google Service Account credentials are not configured. ' +
        'Set GOOGLE_SA_JSON_B64 or GOOGLE_SHEETS_CREDENTIALS environment variable.'
      );
    }

    cachedAuth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }

  return google.sheets({ version: 'v4', auth: cachedAuth });
}

module.exports = { getSheetsClient };
