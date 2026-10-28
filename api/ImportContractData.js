const { app } = require('@azure/functions');
const { getSheetsClient } = require('./googleSheetsClient');
const { getNamedContainer, ensureNamedContainer } = require('./cosmosClient');

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
      // Load contract config
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

      // Get tab list from the spreadsheet
      const sheets = getSheetsClient();
      const metaRes = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties.title',
      });
      const tabNames = (metaRes.data.sheets || []).map((s) => s.properties.title);

      if (tabNames.length === 0) {
        return { status: 400, body: 'スプレッドシートにタブが見つかりませんでした。' };
      }

      // Ensure Contracts container exists (auto-creates if missing)
      const contractsContainer = await ensureNamedContainer('Contracts', {
        overrideKeys: ['COSMOS_CONTRACTS_CONTAINER'],
        partitionKey: '/projectTab',
      });

      const now = new Date().toISOString();
      const results = [];

      for (const tabName of tabNames) {
        const headerRow = Math.max(1, tabHeaderRows[tabName] || 1);
        try {
          const { headers, rows } = await fetchTabRows(sheets, spreadsheetId, tabName, headerRow);

          let imported = 0;
          let skipped = 0;

          for (const row of rows) {
            // Skip rows where all data columns are empty
            const hasData = headers.some((h) => row[h] !== '');
            if (!hasData) { skipped++; continue; }

            const doc = {
              id: `${tabName}-${row._rowIndex}`,
              projectTab: tabName,
              _rowIndex: row._rowIndex,
              _spreadsheetId: spreadsheetId,
              importedAt: now,
              updatedAt: now,
            };
            // Store all sheet columns as top-level fields
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

      // Update contract-config with last import timestamp
      await cfgContainer.items.upsert({
        ...config,
        lastImportedAt: now,
        updatedAt: now,
      });

      return {
        status: 200,
        jsonBody: { success: true, totalImported, results, importedAt: now },
      };
    } catch (error) {
      context.log('ImportContractData failed', error);
      return { status: 500, body: `インポートに失敗しました: ${error.message || error.toString()}` };
    }
  },
});
