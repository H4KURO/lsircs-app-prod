const { app } = require('@azure/functions');
const { google } = require('googleapis');
const { getNamedContainer, ensureNamedContainer } = require('./cosmosClient');

// Prevent background SDK rejections from crashing the worker process
process.on('unhandledRejection', (reason) => {
  console.error('[ImportContractData] unhandledRejection suppressed:', reason && reason.message);
});

function buildSheetsClient() {
  const credJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
  if (!credJson) throw new Error('GOOGLE_SHEETS_CREDENTIALS is not set.');
  const credentials = JSON.parse(credJson);
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}

// Cosmos DB document IDs cannot contain /, \, #, or ?
function safeId(tabName, rowIndex) {
  return `${tabName.replace(/[/\\#?]/g, '_')}-${rowIndex}`;
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

app.http('ImportContractData', {
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

      const { spreadsheetId, tabHeaderRows = {} } = config;

      const sheets = buildSheetsClient();
      const metaRes = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties.title',
      });
      const allTabNames = (metaRes.data.sheets || []).map((s) => s.properties.title);

      if (allTabNames.length === 0) {
        return { status: 400, body: 'スプレッドシートにタブが見つかりませんでした。' };
      }

      let body = {};
      try { body = await request.json(); } catch (_e) { /* no body */ }

      const selectedTabs = Array.isArray(body.tabNames) && body.tabNames.length > 0
        ? body.tabNames
        : null;
      const tabNames = selectedTabs
        ? allTabNames.filter((t) => selectedTabs.includes(t))
        : allTabNames;

      if (tabNames.length === 0) {
        return { status: 400, body: '指定されたタブがスプレッドシートに存在しません。' };
      }

      const now = new Date().toISOString();
      const effectiveHeaderRows = { ...tabHeaderRows, ...(body.tabHeaderRows || {}) };

      // Strip Cosmos DB system fields before upsert
      const { _etag, _rid, _self, _attachments, _ts, ...cleanConfig } = config;

      if (Object.keys(body.tabHeaderRows || {}).length > 0) {
        await cfgContainer.items.upsert({
          ...cleanConfig,
          tabHeaderRows: effectiveHeaderRows,
          updatedAt: now,
        });
      }

      const contractsContainer = await ensureNamedContainer('Contracts', {
        overrideKeys: ['COSMOS_CONTRACTS_CONTAINER'],
        partitionKey: '/projectTab',
      });

      const results = [];

      for (const tabName of tabNames) {
        const headerRow = Math.max(1, effectiveHeaderRows[tabName] || 1);
        try {
          const { headers, rows } = await fetchTabRows(sheets, spreadsheetId, tabName, headerRow);

          let imported = 0;
          let skipped = 0;

          for (const row of rows) {
            const hasData = headers.some((h) => row[h] !== '');
            if (!hasData) { skipped++; continue; }

            const doc = {
              id: safeId(tabName, row._rowIndex),
              projectTab: tabName,
              _rowIndex: row._rowIndex,
              _spreadsheetId: spreadsheetId,
              importedAt: now,
              updatedAt: now,
            };
            headers.forEach((h) => { doc[h] = row[h] ?? ''; });

            await contractsContainer.items.upsert(doc);
            imported++;
          }

          results.push({ tab: tabName, imported, skipped, error: null });
          context.log(`ImportContractData: ${tabName} → ${imported} imported, ${skipped} skipped`);
        } catch (e) {
          context.log(`ImportContractData: failed for tab "${tabName}"`, e);
          results.push({ tab: tabName, imported: 0, skipped: 0, error: e.message || 'エラーが発生しました' });
        }
      }

      const totalImported = results.reduce((s, r) => s + r.imported, 0);

      await cfgContainer.items.upsert({
        ...cleanConfig,
        tabHeaderRows: effectiveHeaderRows,
        lastImportedAt: now,
        updatedAt: now,
      });

      return {
        status: 200,
        jsonBody: { success: true, totalImported, results, importedAt: now },
      };
    } catch (error) {
      const msg = (error && error.message) ? error.message : String(error);
      context.log('ImportContractData failed', msg);
      return {
        status: 200,
        jsonBody: { success: false, error: `インポートに失敗しました: ${msg}` },
      };
    }
  },
});
