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

function columnLetterToIndex(letter) {  // e.g. "EH" → 0-based index
  let result = 0;
  for (const char of letter.toUpperCase()) {
    result = result * 26 + (char.charCodeAt(0) - 64);
  }
  return result - 1;
}

function indexToColumnLetter(index) {  // 0-based → e.g. "EH"
  let letter = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

async function getSheetColumnNames(sheetName) {
  // Returns [{ letter: 'A', name: 'Buyer Name' }, ...]
  // Uses SHEET_HEADER_ROWS to know how many header rows to read
  // Builds label same way as buildColumnLabels in frontend: join unique non-empty values across header rows with ' / '
  const headerRows = SHEET_HEADER_ROWS[sheetName] ?? 1;
  const allValues = await getSheetValues(`'${sheetName}'!1:${headerRows}`);
  if (!allValues || allValues.length === 0) return [];
  const maxCols = Math.max(...allValues.map((r) => r?.length ?? 0));
  const result = [];
  for (let col = 0; col < maxCols; col++) {
    const parts = allValues
      .map((row) => (row?.[col] != null && row[col] !== '' ? String(row[col]).trim() : null))
      .filter(Boolean);
    const unique = [...new Set(parts)];
    result.push({ letter: indexToColumnLetter(col), name: unique.join(' / ') || `列${col + 1}` });
  }
  return result;
}

async function resolveColumnLetter(sheetName, columnName) {
  const columns = await getSheetColumnNames(sheetName);
  const found = columns.find((c) => c.name === columnName);
  return found?.letter ?? null;
}

module.exports = {
  SPREADSHEET_ID,
  getSheetValues,
  updateSheetValues,
  appendSheetValues,
  exportSpreadsheetAsExcel,
  getSheetDataRow,
  getBatchCellValues,
  columnLetterToIndex,
  indexToColumnLetter,
  getSheetColumnNames,
  resolveColumnLetter,
};
