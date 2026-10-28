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
    let _step = 0;
    try {
      // Load contract config
      _step = 1;
      const cfgContainer = projectsContainer();
      let config;
      try {
        const { resource } = await cfgContainer.item('contract-config', 'contract-config').read();
        config = resource;
      } catch (e) {
        return { status: 200, jsonBody: { success: false, error: '設定が見つかりません: ' + e.message, step: _step } };
      }

      _step = 2;
      if (!config?.spreadsheetId) {
        return { status: 200, jsonBody: { success: false, error: 'スプレッドシートIDが設定されていません', step: _step } };
      }

      _step = 3;
      const { spreadsheetId, tabHeaderRows = {} } = config;

      // Get tab list from the spreadsheet
      const sheets = getSheetsClient();
      _step = 4;
      const metaRes = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties.title',
      });
      const allTabNames = (metaRes.data.sheets || []).map((s) => s.properties.title);

      _step = 5;
      if (allTabNames.length === 0) {
        return { status: 200, jsonBody: { success: false, error: 'タブが見つかりません', step: _step } };
      }

      // Optional filter: only import specified tabs + per-tab headerRow override from request
      _step = 6;
      let body = {};
      try { body = await request.json(); } catch (_e) { body = { _parseError: _e?.message }; }
      _step = 7;
      const selectedTabs = Array.isArray(body.tabNames) && body.tabNames.length > 0
        ? body.tabNames
        : null;
      const tabNames = selectedTabs
        ? allTabNames.filter((t) => selectedTabs.includes(t))
        : allTabNames;

      if (tabNames.length === 0) {
        return { status: 200, jsonBody: { success: false, error: '指定されたタブが存在しません', step: _step } };
      }

      _step = 8;
      const now = new Date().toISOString();

      // Merge: request body tabHeaderRows override saved config values
      const effectiveHeaderRows = { ...tabHeaderRows, ...(body.tabHeaderRows || {}) };

      // Strip Cosmos DB system fields before upsert to avoid conflicts
      const { _etag, _rid, _self, _attachments, _ts, ...cleanConfig } = config;

      _step = 9;
      // Persist any overrides back to config so they are remembered for next time
      if (Object.keys(body.tabHeaderRows || {}).length > 0) {
        await cfgContainer.items.upsert({
          ...cleanConfig,
          tabHeaderRows: effectiveHeaderRows,
          updatedAt: now,
        });
      }

      _step = 10;
      // Ensure Contracts container exists (auto-creates if missing)
      const contractsContainer = await ensureNamedContainer('Contracts', {
        overrideKeys: ['COSMOS_CONTRACTS_CONTAINER'],
        partitionKey: '/projectTab',
      });
      _step = 11;
      const results = [];

      for (const tabName of tabNames) {
        const headerRow = Math.max(1, effectiveHeaderRows[tabName] || 1);
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
      context.log('ImportContractData failed at step', _step, msg);
      return {
        status: 200,
        jsonBody: { success: false, error: `[step${_step}] ${msg}`, step: _step },
      };
    }
  },
});
