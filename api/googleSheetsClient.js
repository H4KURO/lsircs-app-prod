const { google } = require('googleapis');

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
    // Azure App Settings stores \n as literal \\n — normalize here
    const normalizedKey = privateKey.replace(/\\n/g, '\n');
    cachedAuth = new google.auth.JWT(
      clientEmail,
      null,
      normalizedKey,
      ['https://www.googleapis.com/auth/spreadsheets']
    );
  }

  return google.sheets({ version: 'v4', auth: cachedAuth });
}

module.exports = { getSheetsClient };
