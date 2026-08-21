const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { getNamedContainer } = require('./cosmosClient');

const customersContainer = () =>
  getNamedContainer('Customers', ['COSMOS_CUSTOMERS_CONTAINER']);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

function detectFieldIndex(columnLabels, patterns) {
  return columnLabels.findIndex((label) =>
    patterns.some((p) => label.toLowerCase().includes(p.toLowerCase()))
  );
}

function normalize(str) {
  return (str ?? '').trim().toLowerCase();
}

// POST /api/SyncBuyerToCRM
// Body: { projectId, projectName, sheetName, rowIndex, values, columnLabels }
// Response: { action: 'created' | 'linked', customer }
app.http('SyncBuyerToCRM', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      const payload = await request.json();
      const { projectId: rawProjectId, projectName, sheetName, rowIndex, values, columnLabels } = payload;
      const projectId = rawProjectId || null;

      if (!Array.isArray(values) || !Array.isArray(columnLabels)) {
        return { status: 400, body: 'values and columnLabels arrays are required.' };
      }

      // 列ラベルからname/email/phoneのインデックスを検出
      const nameIdx  = detectFieldIndex(columnLabels, ['氏名', 'ローマ字', 'name']);
      const emailIdx = detectFieldIndex(columnLabels, ['メール', 'email', 'e-mail']);
      const phoneIdx = detectFieldIndex(columnLabels, ['電話', 'phone', 'tel', 'mobile']);

      const name  = nameIdx  >= 0 ? String(values[nameIdx]  ?? '').trim() : '';
      const email = emailIdx >= 0 ? String(values[emailIdx] ?? '').trim() : '';
      const phone = phoneIdx >= 0 ? String(values[phoneIdx] ?? '').trim() : '';

      if (!name && !email && !phone) {
        return { status: 400, body: 'No identifiable fields (name/email/phone) found in the row.' };
      }

      const unitIdx = detectFieldIndex(columnLabels, ['unit', 'ユニット']);
      const unitNo  = unitIdx >= 0 ? String(values[unitIdx] ?? '').trim() : '';
      const displayName = [projectName, unitNo].filter(Boolean).join(' / ') || name || `Row ${rowIndex + 1}`;
      const buyerLink = {
        projectId: projectId ?? null,
        projectName: projectName ?? null,
        sheetName: sheetName ?? 'Buyers list',
        rowIndex,
        displayName,
      };

      const container = customersContainer();

      // 既存顧客を検索（email → phone → name の優先順）
      let existingCustomer = null;

      if (email) {
        const { resources } = await container.items
          .query({ query: 'SELECT * FROM c WHERE c.email = @email', parameters: [{ name: '@email', value: email }] })
          .fetchAll();
        if (resources.length > 0) existingCustomer = resources[0];
      }

      if (!existingCustomer && phone) {
        const { resources } = await container.items
          .query({ query: 'SELECT * FROM c WHERE c.phone = @phone', parameters: [{ name: '@phone', value: phone }] })
          .fetchAll();
        if (resources.length > 0) existingCustomer = resources[0];
      }

      if (!existingCustomer && name) {
        const { resources } = await container.items
          .query({ query: 'SELECT * FROM c WHERE c.name = @name', parameters: [{ name: '@name', value: name }] })
          .fetchAll();
        // 名前は重複の可能性があるため完全一致のみ
        const exact = resources.filter((r) => normalize(r.name) === normalize(name));
        if (exact.length > 0) existingCustomer = exact[0];
      }

      const now = new Date().toISOString();

      if (existingCustomer) {
        // 既存の buyerLinks を取得（旧 buyerLink 形式との後方互換）
        const existingLinks = Array.isArray(existingCustomer.buyerLinks)
          ? [...existingCustomer.buyerLinks]
          : (existingCustomer.buyerLink ? [existingCustomer.buyerLink] : []);
        // 同じ projectId + rowIndex の重複は上書き
        const dupIdx = existingLinks.findIndex(
          (l) => l.projectId === buyerLink.projectId && l.rowIndex === buyerLink.rowIndex
        );
        if (dupIdx >= 0) {
          existingLinks[dupIdx] = buyerLink;
        } else {
          existingLinks.push(buyerLink);
        }
        const updated = {
          ...existingCustomer,
          buyerLinks: existingLinks,
          buyerLink: existingLinks[0] ?? null,
          updatedAt: now,
          updatedBy: clientPrincipal.userDetails,
        };
        const { resource } = await container.item(existingCustomer.id, existingCustomer.id).replace(updated);
        context.log(`SyncBuyerToCRM: linked buyer row ${rowIndex} to existing customer ${existingCustomer.id}`);
        return { status: 200, jsonBody: { action: 'linked', customer: resource } };
      }

      // 新規顧客を作成
      const newCustomer = {
        id: uuidv4(),
        name: name || displayName,
        email: email || null,
        phone: phone || null,
        company: null,
        country: null,
        region: null,
        status: 'Lead',
        source: 'Buyers List',
        assignedTo: null,
        propertyInterest: null,
        preferredBedrooms: null,
        budget: null,
        lastContactedAt: null,
        nextFollowUpAt: null,
        notes: null,
        buyerLinks: [buyerLink],
        buyerLink,
        createdAt: now,
        updatedAt: now,
        createdBy: clientPrincipal.userDetails,
        updatedBy: null,
      };
      const { resource } = await container.items.create(newCustomer);
      context.log(`SyncBuyerToCRM: created new customer ${resource.id} from buyer row ${rowIndex}`);
      return { status: 201, jsonBody: { action: 'created', customer: resource } };

    } catch (error) {
      const message = error.message || '';
      context.log('SyncBuyerToCRM failed', error);
      if (message.includes('connection string') || message.includes('COSMOS')) {
        return { status: 500, body: `DB config error: ${message}` };
      }
      return { status: 500, body: `Error: ${message}` };
    }
  },
});
