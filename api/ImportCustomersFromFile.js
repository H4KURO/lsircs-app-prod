const { app } = require('@azure/functions');
const { ensureNamedContainer } = require('./cosmosClient');

const PRESERVE_FIELDS = ['boxFolders', 'comments', 'status', 'assignedTo', 'notes'];

function safeSlug(s) {
  return String(s || '').trim().replace(/[/\\#?&\s@.]/g, '_').slice(0, 100);
}

const COLUMN_MAP = {
  '顧客コード': '_customerCode',
  '名前': 'name',
  'お名前': 'name',
  '氏名': 'name',
  '名前（カナ）': 'nameKana',
  '名前(カナ)': 'nameKana',
  'フリガナ': 'nameKana',
  'カナ': 'nameKana',
  'メールアドレス': 'email',
  'メール': 'email',
  '電話番号': 'phone',
  '電話': 'phone',
  '携帯': 'phone',
  '国': 'country',
  '国籍': 'country',
  '地域': 'region',
  '担当者': 'assignedTo',
  '担当': 'assignedTo',
  'ステータス': 'status',
  'メモ': 'notes',
  '備考': 'notes',
  '物件関心': 'propertyInterest',
};

app.http('ImportCustomersFromFile', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const rows = Array.isArray(body.rows) ? body.rows : [];

      if (rows.length === 0) {
        return { status: 400, body: 'rowsが空です。' };
      }

      const container = await ensureNamedContainer('Customers', {
        overrideKeys: ['COSMOS_CUSTOMERS_CONTAINER'],
        partitionKey: '/id',
      });

      const now = new Date().toISOString();
      let imported = 0;
      let skipped = 0;
      const errors = [];

      for (let i = 0; i < rows.length; i++) {
        const raw = rows[i];

        const mapped = {};
        for (const [header, value] of Object.entries(raw)) {
          const field = COLUMN_MAP[header.trim()];
          if (field && value !== '' && value !== null && value !== undefined) {
            mapped[field] = value;
          }
        }

        if (!mapped.name) { skipped++; continue; }

        const customerCode = mapped._customerCode || mapped.email || mapped.name;
        delete mapped._customerCode;

        const docId = `customer-file-${safeSlug(customerCode)}`;

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
          status: preserved.status || mapped.status || 'Lead',
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

      context.log(`ImportCustomersFromFile: ${imported} imported, ${skipped} skipped`);
      return {
        status: 200,
        jsonBody: { success: true, imported, skipped, errors },
      };
    } catch (error) {
      context.log('ImportCustomersFromFile failed', error);
      return { status: 200, jsonBody: { success: false, error: error.message || String(error) } };
    }
  },
});
