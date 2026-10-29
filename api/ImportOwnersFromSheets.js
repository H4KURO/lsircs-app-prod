const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { google } = require('googleapis');
const { getNamedContainer, ensureNamedContainer } = require('./cosmosClient');

process.on('unhandledRejection', (reason) => {
  console.error('[ImportOwnersFromSheets] unhandledRejection suppressed:', reason && reason.message);
});

function buildSheetsClient() {
  const credJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
  if (!credJson) throw new Error('GOOGLE_SHEETS_CREDENTIALS is not set.');
  const credentials = JSON.parse(credJson);
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}

// Normalize Japanese / English column name to a Customer field key
const COLUMN_MAP = {
  // name
  '氏名': 'name', '名前': 'name', 'オーナー名': 'name', 'name': 'name',
  // email
  'メール': 'email', 'メールアドレス': 'email', 'email': 'email', 'Email': 'email',
  // phone
  '電話': 'phone', '電話番号': 'phone', 'phone': 'phone', 'Phone': 'phone',
  // company
  '会社': 'company', '会社名': 'company', 'company': 'company',
  // country
  '国': 'country', 'country': 'country',
  // region
  '地域': 'region', 'region': 'region',
  // notes
  '備考': 'notes', 'notes': 'notes',
};

const projectsContainer = () => getNamedContainer('Projects', ['COSMOS_PROJECTS_CONTAINER']);

async function fetchTabRows(sheets, spreadsheetId, tabName, headerRow) {
  const range = `'${tabName}'!A:ZZ`;
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const allRows = response.data.values || [];
  if (allRows.length < headerRow) return { headers: [], rows: [] };
  const rawHeaders = allRows[headerRow - 1];
  let lastNonEmpty = rawHeaders.length - 1;
  while (lastNonEmpty >= 0 && !rawHeaders[lastNonEmpty]) lastNonEmpty--;
  const headers = rawHeaders.slice(0, lastNonEmpty + 1).map((h) => String(h).trim());
  const rows = allRows.slice(headerRow).map((row, i) => {
    const obj = { _rowIndex: i + headerRow + 1 };
    headers.forEach((h, ci) => { obj[h] = row[ci] !== undefined ? String(row[ci]) : ''; });
    return obj;
  });
  return { headers, rows };
}

app.http('ImportOwnersFromSheets', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const cfgContainer = projectsContainer();
      let config;
      try {
        const { resource } = await cfgContainer.item('contract-config', 'contract-config').read();
        config = resource;
      } catch (e) {
        return { status: 400, body: '契約管理の設定が見つかりません。先にスプレッドシートIDを設定してください。' };
      }

      if (!config?.spreadsheetId) {
        return { status: 400, body: 'スプレッドシートIDが設定されていません。' };
      }

      const body = await request.json();
      const { tabName, headerRow = 1 } = body;
      if (!tabName) return { status: 400, body: 'tabName is required.' };

      const sheets = buildSheetsClient();
      const { headers, rows } = await fetchTabRows(sheets, config.spreadsheetId, tabName, Number(headerRow));

      const customersContainer = await ensureNamedContainer('Customers', {
        overrideKeys: ['COSMOS_CUSTOMERS_CONTAINER'],
        partitionKey: '/id',
      });

      const now = new Date().toISOString();
      let imported = 0;
      let skipped = 0;

      for (const row of rows) {
        const hasData = headers.some((h) => row[h] !== '');
        if (!hasData) { skipped++; continue; }

        // Map sheet columns to Customer fields
        const mapped = {};
        for (const h of headers) {
          const field = COLUMN_MAP[h];
          if (field && row[h]) mapped[field] = row[h];
        }
        if (!mapped.name) { skipped++; continue; }

        // Use a stable ID based on tab+row so re-import updates existing records
        const stableId = `sheets-owner-${tabName.replace(/[/\\#?]/g, '_')}-${row._rowIndex}`;

        // Preserve non-sheet fields on existing record
        let existing = {};
        try {
          const { resource } = await customersContainer.item(stableId, stableId).read();
          if (resource) existing = resource;
        } catch (_) { /* new */ }

        const customer = {
          ...existing,
          id: stableId,
          importSource: 'sheets',
          importedAt: existing.importedAt || now,
          updatedAt: now,
          status: existing.status || 'Lead',
          source: existing.source || 'Sheets',
          ...mapped,
        };

        await customersContainer.items.upsert(customer);
        imported++;
      }

      return { status: 200, jsonBody: { success: true, imported, skipped } };
    } catch (error) {
      context.log('ImportOwnersFromSheets failed', error);
      return { status: 500, body: `インポートに失敗しました: ${error.message}` };
    }
  },
});
