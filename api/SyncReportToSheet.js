const { app } = require('@azure/functions');
const { getSheetsClient } = require('./googleSheetsClient');
const { getNamedContainer } = require('./cosmosClient');

const projectsContainer = () => getNamedContainer('Projects', ['COSMOS_PROJECTS_CONTAINER']);
const propertiesContainer = () => getNamedContainer('Properties', ['COSMOS_PROPERTIES_CONTAINER']);

function colToLetter(index) {
  let letter = '';
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

function parsePropertyName(propertyName) {
  if (!propertyName) return { building: '', unit: '' };
  const hashIdx = propertyName.indexOf('#');
  if (hashIdx === -1) return { building: propertyName.trim(), unit: '' };
  return {
    building: propertyName.substring(0, hashIdx).trim(),
    unit: '#' + propertyName.substring(hashIdx + 1).trim(),
  };
}

app.http('SyncReportToSheet', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const { reportType } = body;
      if (!reportType) return { status: 400, body: 'reportType is required.' };

      const container = projectsContainer();
      const configId = `report-config-${reportType}`;
      let config;
      try {
        const { resource } = await container.item(configId, configId).read();
        config = resource;
      } catch (e) {
        if (e.code === 404) return { status: 400, body: '設定が見つかりません。先にSpreadsheet IDとシートタブを設定してください。' };
        throw e;
      }

      if (!config.spreadsheetId || !config.sheetTab) {
        return { status: 400, body: 'Spreadsheet IDとシートタブを設定してください。' };
      }

      const propContainer = propertiesContainer();
      const { resources: properties } = await propContainer.items
        .query('SELECT * FROM c')
        .fetchAll();

      const sheets = getSheetsClient();
      const headerRow = config.headerRow || 1;
      const sheetResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: `'${config.sheetTab}'!A:ZZ`,
      });
      const allRows = sheetResponse.data.values || [];

      if (allRows.length < headerRow) {
        return { status: 400, body: `シートのヘッダー行(${headerRow}行目)が存在しません。` };
      }

      const rawHeaders = allRows[headerRow - 1];
      // Trim trailing empty headers
      let lastNonEmpty = rawHeaders.length - 1;
      while (lastNonEmpty >= 0 && !rawHeaders[lastNonEmpty]) lastNonEmpty--;
      const headers = rawHeaders.slice(0, lastNonEmpty + 1);

      const propertyColIdx = headers.findIndex((h) => h === 'Property');
      const unitColIdx = headers.findIndex((h) => h === 'Unit');

      if (propertyColIdx === -1) {
        return { status: 400, body: 'シートに "Property" 列が見つかりません。ヘッダー行を確認してください。' };
      }

      const dataStartRow = headerRow + 1;
      const dataRows = allRows.slice(headerRow);
      const sheetKeyToRowNum = {};
      dataRows.forEach((row, i) => {
        const propVal = (row[propertyColIdx] || '').trim();
        const unitVal = unitColIdx >= 0 ? (row[unitColIdx] || '').trim() : '';
        const key = reportType === 'vacancy'
          ? `${propVal} ${unitVal}`.trim().toLowerCase()
          : propVal.toLowerCase();
        if (key) sheetKeyToRowNum[key] = dataStartRow + i;
      });

      let updated = 0;
      let appended = 0;

      if (reportType === 'vacancy') {
        const targetProps = properties.filter((p) => p.tenantStatus && p.tenantStatus !== 'Current');

        const statusColIdx = headers.findIndex((h) => h === 'Status');
        const moDateColIdx = headers.findIndex((h) => h === 'MO Date');
        const ownerColIdx = headers.findIndex((h) => h === "Owner's Name");

        for (const prop of targetProps) {
          const { building, unit } = parsePropertyName(prop.propertyName);
          const key = `${building} ${unit}`.trim().toLowerCase();
          const existingRow = sheetKeyToRowNum[key];

          if (existingRow) {
            const cellUpdates = [];
            if (statusColIdx >= 0) cellUpdates.push({ range: `'${config.sheetTab}'!${colToLetter(statusColIdx)}${existingRow}`, values: [[prop.tenantStatus || '']] });
            if (moDateColIdx >= 0) cellUpdates.push({ range: `'${config.sheetTab}'!${colToLetter(moDateColIdx)}${existingRow}`, values: [[prop.vacancyReportData?.moDate || '']] });
            if (ownerColIdx >= 0) cellUpdates.push({ range: `'${config.sheetTab}'!${colToLetter(ownerColIdx)}${existingRow}`, values: [[prop.ownerName || '']] });
            if (cellUpdates.length > 0) {
              await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: config.spreadsheetId,
                requestBody: { valueInputOption: 'USER_ENTERED', data: cellUpdates },
              });
              updated++;
            }
          } else {
            const newRow = new Array(headers.length).fill('');
            newRow[propertyColIdx] = building;
            if (unitColIdx >= 0) newRow[unitColIdx] = unit;
            if (statusColIdx >= 0) newRow[statusColIdx] = prop.tenantStatus || '';
            if (moDateColIdx >= 0) newRow[moDateColIdx] = prop.vacancyReportData?.moDate || '';
            if (ownerColIdx >= 0) newRow[ownerColIdx] = prop.ownerName || '';
            const approvedRentColIdx = headers.findIndex((h) => h === 'Approved Rent');
            if (approvedRentColIdx >= 0) newRow[approvedRentColIdx] = prop.monthlyRent ? `$${Number(prop.monthlyRent).toLocaleString()}` : '';
            await sheets.spreadsheets.values.append({
              spreadsheetId: config.spreadsheetId,
              range: `'${config.sheetTab}'!A:A`,
              valueInputOption: 'USER_ENTERED',
              requestBody: { values: [newRow] },
            });
            appended++;
          }
        }
      } else if (reportType === 'leaseRenewal') {
        const now = new Date();
        const cutoff = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
        const targetProps = properties.filter((p) => {
          if (!p.leaseEnd) return false;
          return new Date(p.leaseEnd) <= cutoff;
        });

        const tenantColIdx = headers.findIndex((h) => h === 'Tenant');
        const leaseExpiresColIdx = headers.findIndex((h) => h === 'Lease Expires');
        const currentRentColIdx = headers.findIndex((h) => h === 'Current Rent');

        for (const prop of targetProps) {
          const key = (prop.propertyName || '').trim().toLowerCase();
          const rentFormatted = prop.monthlyRent ? `$${Number(prop.monthlyRent).toLocaleString()}` : '';
          const existingRow = sheetKeyToRowNum[key];

          if (existingRow) {
            const cellUpdates = [];
            if (tenantColIdx >= 0) cellUpdates.push({ range: `'${config.sheetTab}'!${colToLetter(tenantColIdx)}${existingRow}`, values: [[prop.tenantName || '']] });
            if (leaseExpiresColIdx >= 0) cellUpdates.push({ range: `'${config.sheetTab}'!${colToLetter(leaseExpiresColIdx)}${existingRow}`, values: [[prop.leaseEnd || '']] });
            if (currentRentColIdx >= 0) cellUpdates.push({ range: `'${config.sheetTab}'!${colToLetter(currentRentColIdx)}${existingRow}`, values: [[rentFormatted]] });
            if (cellUpdates.length > 0) {
              await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: config.spreadsheetId,
                requestBody: { valueInputOption: 'USER_ENTERED', data: cellUpdates },
              });
              updated++;
            }
          } else {
            const newRow = new Array(headers.length).fill('');
            newRow[propertyColIdx] = prop.propertyName || '';
            if (tenantColIdx >= 0) newRow[tenantColIdx] = prop.tenantName || '';
            if (leaseExpiresColIdx >= 0) newRow[leaseExpiresColIdx] = prop.leaseEnd || '';
            if (currentRentColIdx >= 0) newRow[currentRentColIdx] = rentFormatted;
            await sheets.spreadsheets.values.append({
              spreadsheetId: config.spreadsheetId,
              range: `'${config.sheetTab}'!A:A`,
              valueInputOption: 'USER_ENTERED',
              requestBody: { values: [newRow] },
            });
            appended++;
          }
        }
      } else {
        return { status: 400, body: '無効なreportTypeです。' };
      }

      return {
        status: 200,
        jsonBody: {
          updated,
          appended,
          message: `${updated}件更新、${appended}件追加しました。`,
        },
      };
    } catch (error) {
      context.log('SyncReportToSheet failed', error);
      if (error.code === 403 || error.status === 403) {
        return { status: 403, body: 'アクセス拒否: サービスアカウントがスプレッドシートに共有されているか確認してください。' };
      }
      return { status: 500, body: `同期に失敗しました: ${error.message || error.toString()}` };
    }
  },
});
