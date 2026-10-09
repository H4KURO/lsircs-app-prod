const { google } = require('googleapis');

let cachedClient = null;

function getSheetsClient() {
  if (!cachedClient) {
    const credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
    if (!credentialsJson) {
      throw new Error('GOOGLE_SHEETS_CREDENTIALS environment variable is not set.');
    }
    let credentials;
    try {
      credentials = JSON.parse(credentialsJson);
    } catch (err) {
      throw new Error('GOOGLE_SHEETS_CREDENTIALS のパースに失敗しました: ' + err.message);
    }
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    cachedClient = google.sheets({ version: 'v4', auth });
  }
  return cachedClient;
}

module.exports = { getSheetsClient };
