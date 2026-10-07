const { app } = require('@azure/functions');
const { getSheetsClient } = require('./googleSheetsClient');
const { getNamedContainer } = require('./cosmosClient');

const projectsContainer = () => getNamedContainer('Projects', ['COSMOS_PROJECTS_CONTAINER']);
const propertiesContainer = () => getNamedContainer('Properties', ['COSMOS_PROPERTIES_CONTAINER']);

app.http('SyncReportFromSheet', {
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
        if (e.code === 404) return { status: 400, body: '設定が見つかりません。' };
        throw e;
      }

      if (!config.spreadsheetId || !config.sheetTab) {
        return { status: 400, body: 'Spreadsheet IDとシートタブを設定してください。' };
      }

      const sheets = getSheetsClient();
      const headerRow = config.headerRow || 1;
      const sheetResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: `'${config.sheetTab}'!A:ZZ`,
      });
      const allRows = sheetResponse.data.values || [];

      if (allRows.length < headerRow) {
        return { status: 400, body: `ヘッダー行(${headerRow}行目)が存在しません。` };
      }

      const rawHeaders = allRows[headerRow - 1];
      let lastNonEmpty = rawHeaders.length - 1;
      while (lastNonEmpty >= 0 && !rawHeaders[lastNonEmpty]) lastNonEmpty--;
      const headers = rawHeaders.slice(0, lastNonEmpty + 1);

      const dataRows = allRows.slice(headerRow);
      const propertyColIdx = headers.findIndex((h) => h === 'Property');
      const unitColIdx = headers.findIndex((h) => h === 'Unit');

      if (propertyColIdx === -1) {
        return { status: 400, body: '"Property" 列が見つかりません。' };
      }

      const propContainer = propertiesContainer();
      const { resources: properties } = await propContainer.items
        .query('SELECT * FROM c')
        .fetchAll();

      const propLookup = {};
      properties.forEach((p) => {
        if (p.propertyName) propLookup[p.propertyName.toLowerCase()] = p;
      });

      let updatedCount = 0;
      let skippedCount = 0;

      for (const row of dataRows) {
        const propValue = (row[propertyColIdx] || '').trim();
        if (!propValue) continue;

        let property = null;

        if (reportType === 'vacancy') {
          const unitValue = unitColIdx >= 0 ? (row[unitColIdx] || '').trim() : '';
          const combined = `${propValue} ${unitValue}`.trim().toLowerCase();
          property = propLookup[combined];
          if (!property && unitValue) {
            property = Object.values(propLookup).find((p) => {
              const pn = (p.propertyName || '').toLowerCase();
              return pn.includes(propValue.toLowerCase()) && pn.includes(unitValue.toLowerCase());
            });
          }
        } else if (reportType === 'leaseRenewal') {
          const propKey = propValue.toLowerCase();
          property = propLookup[propKey];
          if (!property) {
            const shortKey = propKey.split(' - ')[0].trim();
            property = Object.values(propLookup).find((p) => {
              const pn = (p.propertyName || '').toLowerCase();
              return pn === shortKey || pn.startsWith(shortKey);
            });
          }
        }

        if (!property) {
          skippedCount++;
          continue;
        }

        const updates = {};

        if (reportType === 'vacancy') {
          const statusColIdx = headers.findIndex((h) => h === 'Status');
          const moDateColIdx = headers.findIndex((h) => h === 'MO Date');
          const onMarketColIdx = headers.findIndex((h) => h === 'On Market Date');
          const miDateColIdx = headers.findIndex((h) => h === 'MI Date');
          const mlsColIdx = headers.findIndex((h) => h === 'MLS');
          const approvedRentColIdx = headers.findIndex((h) => h === 'Approved Rent');
          const descColIdx = headers.findIndex((h) => h === 'Description/ Proposal');
          const showingColIdx = headers.findIndex((h) => h === 'Showing');
          const inquiryColIdx = headers.findIndex((h) => h === 'Inquiry');
          const applicationColIdx = headers.findIndex((h) => h === 'Application');

          if (statusColIdx >= 0 && row[statusColIdx] !== undefined) updates.tenantStatus = row[statusColIdx];

          const vacancyData = { ...(property.vacancyReportData || {}) };
          if (moDateColIdx >= 0 && row[moDateColIdx] !== undefined) vacancyData.moDate = row[moDateColIdx];
          if (onMarketColIdx >= 0 && row[onMarketColIdx] !== undefined) vacancyData.onMarketDate = row[onMarketColIdx];
          if (miDateColIdx >= 0 && row[miDateColIdx] !== undefined) vacancyData.miDate = row[miDateColIdx];
          if (mlsColIdx >= 0 && row[mlsColIdx] !== undefined) vacancyData.mls = row[mlsColIdx];
          if (approvedRentColIdx >= 0 && row[approvedRentColIdx] !== undefined) vacancyData.approvedRent = row[approvedRentColIdx];
          if (descColIdx >= 0 && row[descColIdx] !== undefined) vacancyData.description = row[descColIdx];
          if (showingColIdx >= 0 && row[showingColIdx] !== undefined) vacancyData.showings = row[showingColIdx];
          if (inquiryColIdx >= 0 && row[inquiryColIdx] !== undefined) vacancyData.inquiries = row[inquiryColIdx];
          if (applicationColIdx >= 0 && row[applicationColIdx] !== undefined) vacancyData.applications = row[applicationColIdx];

          updates.vacancyReportData = vacancyData;
        } else if (reportType === 'leaseRenewal') {
          const tenantColIdx = headers.findIndex((h) => h === 'Tenant');
          const newRentColIdx = headers.findIndex((h) => h === 'New Rent');
          const sentNoticeColIdx = headers.findIndex((h) => h === 'Sent Notice to Tenant');
          const sentDateColIdx = headers.findIndex((h) => h === 'date');
          const ownerDecisionColIdx = headers.findIndex((h) => h === "Owner's decision");
          const tenantDecisionColIdx = headers.findIndex((h) => h === "Tenant's Decision");
          const signedColIdx = headers.findIndex((h) => h === 'Signed agreement? (Y/N)');
          const leaseTermColIdx = headers.findIndex((h) => h === 'New Lease Term (MtM/6mo/1yr)');
          const moDateColIdx = headers.findIndex((h) => h === 'MO Date');
          const reportToOwnerColIdx = headers.findIndex((h) => h === 'Report to Owner');
          const memoColIdx = headers.findIndex((h) => h === 'Memo');

          if (tenantColIdx >= 0 && row[tenantColIdx]) updates.tenantName = row[tenantColIdx];

          const renewalData = { ...(property.leaseRenewalData || {}) };
          if (newRentColIdx >= 0 && row[newRentColIdx] !== undefined) renewalData.newRent = row[newRentColIdx];
          if (sentNoticeColIdx >= 0 && row[sentNoticeColIdx] !== undefined) renewalData.sentNotice = row[sentNoticeColIdx];
          if (sentDateColIdx >= 0 && row[sentDateColIdx] !== undefined) renewalData.sentNoticeDate = row[sentDateColIdx];
          if (ownerDecisionColIdx >= 0 && row[ownerDecisionColIdx] !== undefined) renewalData.ownerDecision = row[ownerDecisionColIdx];
          if (tenantDecisionColIdx >= 0 && row[tenantDecisionColIdx] !== undefined) renewalData.tenantDecision = row[tenantDecisionColIdx];
          if (signedColIdx >= 0 && row[signedColIdx] !== undefined) renewalData.signedAgreement = row[signedColIdx];
          if (leaseTermColIdx >= 0 && row[leaseTermColIdx] !== undefined) renewalData.newLeaseTerm = row[leaseTermColIdx];
          if (moDateColIdx >= 0 && row[moDateColIdx] !== undefined) renewalData.moDate = row[moDateColIdx];
          if (reportToOwnerColIdx >= 0 && row[reportToOwnerColIdx] !== undefined) renewalData.reportToOwner = row[reportToOwnerColIdx];
          if (memoColIdx >= 0 && row[memoColIdx] !== undefined) renewalData.memo = row[memoColIdx];

          updates.leaseRenewalData = renewalData;
        }

        if (Object.keys(updates).length > 0) {
          const updatedDoc = { ...property, ...updates, updatedAt: new Date().toISOString() };
          await propContainer.item(property.id, property.id).replace(updatedDoc);
          updatedCount++;
        }
      }

      return {
        status: 200,
        jsonBody: {
          updated: updatedCount,
          skipped: skippedCount,
          message: `${updatedCount}件更新、${skippedCount}件スキップしました。`,
        },
      };
    } catch (error) {
      context.log('SyncReportFromSheet failed', error);
      if (error.code === 403 || error.status === 403) {
        return { status: 403, body: 'アクセス拒否: サービスアカウントがスプレッドシートに共有されているか確認してください。' };
      }
      return { status: 500, body: `同期に失敗しました: ${error.message || error.toString()}` };
    }
  },
});
