const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

function getAuth() {
  const credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
  if (!credentialsJson) {
    throw new Error('GOOGLE_SHEETS_CREDENTIALS environment variable is not set.');
  }
  const credentials = JSON.parse(credentialsJson);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });
}

async function getSheetsClient() {
  const auth = getAuth();
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

// ── シートごとのヘッダー行数 ─────────────────────────────────
const SHEET_HEADER_ROWS = {
  'Buyers list': 3,
  'Xld': 3,
  'Comission & Referral': 1,
};

// rowIndex（0始まりのデータ行）をシートの行番号（1始まり）に変換
function getSheetDataRow(sheetName, rowIndex) {
  const headerRows = SHEET_HEADER_ROWS[sheetName] ?? 3;
  return headerRows + 1 + rowIndex;
}

// 複数セルを一括取得（バイヤー同期用）
async function getBatchCellValues(ranges) {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  return response.data.valueRanges || [];
}

// Google Drive API経由でスプレッドシートをxlsx形式でエクスポート
// 書式（枠線・色・結合セル・フォント等）がすべて保持される
async function exportSpreadsheetAsExcel(spreadsheetId) {
  const auth = getAuth();
  const client = await auth.getClient();
  const drive = google.drive({ version: 'v3', auth: client });
  const response = await drive.files.export(
    {
      fileId: spreadsheetId,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    { responseType: 'arraybuffer' },
  );
  return Buffer.from(response.data);
}

async function getSheetValues(range) {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  return response.data.values || [];
}

async function updateSheetValues(range, values) {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
  return response.data;
}

async function appendSheetValues(range, values) {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
  return response.data;
}

module.exports = {
  SPREADSHEET_ID,
  getSheetValues,
  updateSheetValues,
  appendSheetValues,
  exportSpreadsheetAsExcel,
  getSheetDataRow,
  getBatchCellValues,
};
