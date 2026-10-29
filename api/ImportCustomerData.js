const { app } = require('@azure/functions');
const { google } = require('googleapis');
const { getNamedContainer, ensureNamedContainer } = require('./cosmosClient');

process.on('unhandledRejection', (reason) => {
  console.error('[ImportCustomerData] unhandledRejection suppressed:', reason && reason.message);
});

// Japanese sheet header → Customer field mapping
const COLUMN_MAP = {
  '名前': 'name',
  'お名前': 'name',
  '氏名': 'name',
  '名前（カナ）': 'nameKana',
  '名前(カナ)': 'nameKana',
  'フリガナ': 'nameKana',
  'カナ': 'nameKana',
  'メールアドレス': 'email',
  'メール': 'email',
  'mail': 'email',
  'email': 'email',
  '電話番号': 'phone',
  '電話': 'phone',
  '携帯': 'phone',
  '国': 'country',
  '国籍': 'country',
  '地域': 'region',
  '担当者': 'assignedTo',
  '担当': 'assignedTo',
  'ステータス': 'status',
  'status': 'status',
  'メモ': 'notes',
  '備考': 'notes',
  '物件関心': 'propertyInterest',
  '関心物件': 'propertyInterest',
};

function buildSheetsClient() {
  const credJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
  if (!credJson) throw new Error('GOOGLE_SHEETS_CREDENTIALS is not set.');
  const credentials = JSON.parse(credJson);
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}

function safeId(tabName, rowIndex) {
  return `customer-sheets-${tabName.replace(/[/\\#?]/g, '_')}-${rowIndex}`;
}

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
    headers.forEach((h, ci) => {
      obj[h] = row[ci] !== undefined ? String(row[ci]) : '';
    });
    return obj;
  });

  return { headers, rows };
}

app.http('ImportCustomerData', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const cfgContainer = projectsContainer();
      let config;
      try {
        const { resource } = await cfgContainer.item('customer-import-config', 'customer-import-config').read();
        config = resource;
      } catch (_) {
        return { status: 400, body: '顧客インポートの設定が見つかりません。先にスプレッドシートIDを設定してください。' };
      }

      if (!config?.spreadsheetId) {
        return { status: 400, body: 'スプレッドシートIDが設定されていません。' };
      }

      const { spreadsheetId, tabHeaderRows = {} } = config;
      let body = {};
      try { body = await request.json(); } catch (_) { /* no body */ }

      const sheets = buildSheetsClient();
      const metaRes = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
      const allTabNames = (metaRes.data.sheets || []).map((s) => s.properties.title);

      if (allTabNames.length === 0) {
        return { status: 400, body: 'スプレッドシートにタブが見つかりませんでした。' };
      }

      const selectedTabs = Array.isArray(body.tabNames) && body.tabNames.length > 0 ? body.tabNames : null;
      const tabNames = selectedTabs ? allTabNames.filter((t) => selectedTabs.includes(t)) : allTabNames;

      if (tabNames.length === 0) {
        return { status: 400, body: '指定されたタブがスプレッドシートに存在しません。' };
      }

      const now = new Date().toISOString();
      const effectiveHeaderRows = { ...tabHeaderRows, ...(body.tabHeaderRows || {}) };

      if (Object.keys(body.tabHeaderRows || {}).length > 0) {
        const { _etag, _rid, _self, _attachments, _ts, ...cleanConfig } = config;
        await cfgContainer.items.upsert({ ...cleanConfig, tabHeaderRows: effectiveHeaderRows, updatedAt: now });
      }

      const customersContainer = await ensureNamedContainer('Customers', {
        overrideKeys: ['COSMOS_CUSTOMERS_CONTAINER'],
        partitionKey: '/id',
      });

      const results = [];
      const PRESERVE_FIELDS = ['boxFolders', 'comments', 'status', 'assignedTo', 'notes'];

      for (const tabName of tabNames) {
        const headerRow = Math.max(1, effectiveHeaderRows[tabName] || 1);
        try {
          const { headers, rows } = await fetchTabRows(sheets, spreadsheetId, tabName, headerRow);

          let imported = 0;
          let skipped = 0;

          for (const row of rows) {
            // Map sheet columns to customer fields
            const mapped = {};
            for (const header of headers) {
              const field = COLUMN_MAP[header] || COLUMN_MAP[header.toLowerCase()];
              if (field && row[header] !== '') mapped[field] = row[header];
            }

            if (!mapped.name) { skipped++; continue; }

            const docId = safeId(tabName, row._rowIndex);

            // Merge: preserve fields that users manage manually
            let preservedData = {};
            let originalImportedAt = now;
            try {
              const { resource: existing } = await customersContainer.item(docId, docId).read();
              if (existing) {
                for (const f of PRESERVE_FIELDS) {
                  if (existing[f] !== undefined) preservedData[f] = existing[f];
                }
                if (existing.importedAt) originalImportedAt = existing.importedAt;
              }
            } catch (_) { /* new record */ }

            const doc = {
              ...preservedData,
              ...mapped,
              id: docId,
              importSource: 'sheets',
              sheetTab: tabName,
              _rowIndex: row._rowIndex,
              _spreadsheetId: spreadsheetId,
              status: preservedData.status || mapped.status || 'Lead',
              importedAt: originalImportedAt,
              updatedAt: now,
            };

            await customersContainer.items.upsert(doc);
            imported++;
          }

          results.push({ tab: tabName, imported, skipped, error: null });
          context.log(`ImportCustomerData: ${tabName} → ${imported} imported, ${skipped} skipped`);
        } catch (e) {
          context.log(`ImportCustomerData: failed for tab "${tabName}"`, e);
          results.push({ tab: tabName, imported: 0, skipped: 0, error: e.message || 'エラーが発生しました' });
        }
      }

      const { _etag, _rid, _self, _attachments, _ts, ...cleanConfig } = config;
      await cfgContainer.items.upsert({
        ...cleanConfig,
        tabHeaderRows: effectiveHeaderRows,
        lastImportedAt: now,
        updatedAt: now,
      });

      const totalImported = results.reduce((s, r) => s + r.imported, 0);
      return { status: 200, jsonBody: { success: true, totalImported, results, importedAt: now } };
    } catch (error) {
      const msg = error?.message || String(error);
      context.log('ImportCustomerData failed', msg);
      return { status: 200, jsonBody: { success: false, error: `インポートに失敗しました: ${msg}` } };
    }
  },
});
