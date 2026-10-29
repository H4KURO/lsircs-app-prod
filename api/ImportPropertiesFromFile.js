const { app } = require('@azure/functions');
const { ensureNamedContainer } = require('./cosmosClient');

// Preserve fields managed by modals — not overwritten by re-import
const PRESERVE_FIELDS = ['paymentSchedule', 'comments', 'currency',
  'linkedCustomerId', 'linkedCustomerName', 'ownerName'];

// Cosmosが許可しないID文字を除去
function safeSlug(s) {
  return String(s || '').trim().replace(/[/\\#?&\s]/g, '_').slice(0, 80);
}

// Property column header → Cosmos field mapping
const COLUMN_MAP = {
  '物件コード': '_propertyCode',
  'タブ名': 'sheetTab',
  'プロジェクト名': 'projectName',
  '部屋番号': 'roomNumber',
  'オーナー名': 'ownerName',
  '契約日': 'contractDate',
  '購入金額': 'purchasePrice',
  '前払金': 'downPayment',
  '毎月中間金': 'paymentBaseAmount',
  '毎月金額': 'paymentBaseAmount',
  '支払い回数': 'paymentCount',
  '支払回数': 'paymentCount',
  '支払日': 'paymentDueDay',
  '支払い期日': 'paymentDueDay',
  '初回支払い日': 'paymentStartDate',
  '通貨': 'currency',
};

const NUMBER_FIELDS = new Set(['purchasePrice', 'downPayment', 'paymentBaseAmount', 'paymentCount', 'paymentDueDay']);

app.http('ImportPropertiesFromFile', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const rows = Array.isArray(body.rows) ? body.rows : [];
      const defaultSheetTab = body.sheetTab || 'インポート';

      if (rows.length === 0) {
        return { status: 400, body: 'rowsが空です。' };
      }

      const container = await ensureNamedContainer('Properties', {
        overrideKeys: ['COSMOS_PROPERTIES_CONTAINER'],
        partitionKey: '/id',
      });

      const now = new Date().toISOString();
      let imported = 0;
      let skipped = 0;
      const errors = [];

      for (let i = 0; i < rows.length; i++) {
        const raw = rows[i];

        // Map columns
        const mapped = {};
        for (const [header, value] of Object.entries(raw)) {
          const field = COLUMN_MAP[header.trim()];
          if (field && value !== '' && value !== null && value !== undefined) {
            mapped[field] = value;
          }
        }

        const sheetTab = mapped.sheetTab || defaultSheetTab;
        const propertyCode = mapped._propertyCode
          || [mapped.projectName, mapped.roomNumber].filter(Boolean).join('-')
          || `row-${i + 1}`;
        delete mapped._propertyCode;
        delete mapped.sheetTab;

        if (!mapped.projectName && !propertyCode) { skipped++; continue; }

        const docId = `property-file-${safeSlug(sheetTab)}-${safeSlug(propertyCode)}`;

        // Coerce number fields
        for (const f of NUMBER_FIELDS) {
          if (mapped[f] !== undefined) {
            const n = Number(String(mapped[f]).replace(/[^\d.-]/g, ''));
            mapped[f] = isNaN(n) ? null : n;
          }
        }

        // Merge upsert: preserve modal-managed fields
        let preserved = {};
        let importedAt = now;
        try {
          const { resource: existing } = await container.item(docId, docId).read();
          if (existing) {
            for (const f of PRESERVE_FIELDS) {
              if (existing[f] !== undefined) preserved[f] = existing[f];
            }
            if (existing.importedAt) importedAt = existing.importedAt;
          }
        } catch (_) { /* new record */ }

        const doc = {
          ...preserved,
          ...mapped,
          id: docId,
          sheetTab,
          propertyName: mapped.projectName || sheetTab,
          importSource: 'file',
          importedAt,
          updatedAt: now,
        };

        try {
          await container.items.upsert(doc);
          imported++;
        } catch (e) {
          errors.push(`行${i + 1}: ${e.message}`);
          skipped++;
        }
      }

      context.log(`ImportPropertiesFromFile: ${imported} imported, ${skipped} skipped`);
      return {
        status: 200,
        jsonBody: { success: true, imported, skipped, errors },
      };
    } catch (error) {
      context.log('ImportPropertiesFromFile failed', error);
      return { status: 200, jsonBody: { success: false, error: error.message || String(error) } };
    }
  },
});
