const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { getNamedContainer } = require('./cosmosClient');

const propertiesContainer = () => getNamedContainer('Properties', ['COSMOS_PROPERTIES_CONTAINER']);
const customersContainer = () => getNamedContainer('Customers', ['COSMOS_CUSTOMERS_CONTAINER']);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try { return JSON.parse(Buffer.from(header, 'base64').toString('ascii')); } catch { return null; }
}

// Normalized edit distance for fuzzy matching
function editDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function normalize(s) {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function similarity(a, b) {
  const na = normalize(a), nb = normalize(b);
  if (!na || !nb) return 0;
  const dist = editDistance(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - dist / maxLen;
}

const FUZZY_THRESHOLD = 0.7;

app.http('SyncPropertiesToCRM', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) return { status: 401, body: 'Unauthorized' };

    try {
      const payload = await request.json();
      const dryRun = payload?.dryRun !== false; // default true
      const mappings = payload?.mappings || null; // [{propertyId, action:'link'|'create'|'skip', customerId?}]

      const propContainer = propertiesContainer();
      const custContainer = customersContainer();

      const { resources: properties } = await propContainer.items.query({ query: 'SELECT * FROM c' }).fetchAll();
      const { resources: customers } = await custContainer.items.query({ query: 'SELECT * FROM c' }).fetchAll();

      // Group properties by ownerName (one owner may have multiple properties)
      const ownerMap = new Map(); // ownerName → { ownerName, ownerPhone, propertyNames[] }
      for (const p of properties) {
        if (!p.ownerName) continue;
        const key = normalize(p.ownerName);
        if (!ownerMap.has(key)) {
          ownerMap.set(key, { ownerName: p.ownerName, ownerPhone: p.ownerPhone || null, propertyNames: [] });
        }
        ownerMap.get(key).propertyNames.push(p.propertyName);
      }

      // Analyze matches
      const analysis = [];
      for (const [, owner] of ownerMap) {
        const exactMatch = customers.find(c => normalize(c.name) === normalize(owner.ownerName));
        if (exactMatch) {
          analysis.push({ type: 'exact', owner, customer: exactMatch, action: 'link' });
          continue;
        }
        const fuzzyMatches = customers
          .map(c => ({ customer: c, score: similarity(owner.ownerName, c.name) }))
          .filter(x => x.score >= FUZZY_THRESHOLD)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);
        if (fuzzyMatches.length > 0) {
          analysis.push({ type: 'fuzzy', owner, candidates: fuzzyMatches, action: 'review' });
        } else {
          analysis.push({ type: 'new', owner, action: 'create' });
        }
      }

      if (dryRun) {
        return { status: 200, jsonBody: { dryRun: true, analysis } };
      }

      // Execute with mappings
      if (!mappings) return { status: 400, body: 'mappings required for execute mode' };

      const now = new Date().toISOString();
      const user = clientPrincipal.userDetails || clientPrincipal.userId;
      const results = [];

      for (const item of analysis) {
        const mapping = mappings.find(m => normalize(m.ownerName) === normalize(item.owner.ownerName));
        const action = mapping?.action || (item.type === 'exact' ? 'link' : 'skip');

        if (action === 'skip') {
          results.push({ ownerName: item.owner.ownerName, action: 'skipped' });
          continue;
        }

        const linkedPropertyNames = item.owner.propertyNames;

        if (action === 'create') {
          const newCustomer = {
            id: uuidv4(),
            name: item.owner.ownerName,
            phone: item.owner.ownerPhone || null,
            email: null, company: null, country: null, region: null,
            status: 'Lead',
            source: 'Appfolio',
            linkedPropertyNames,
            notes: null, buyerLink: null, assignedTo: null,
            propertyInterest: null, preferredBedrooms: null, budget: null,
            lastContactedAt: null, nextFollowUpAt: null,
            createdAt: now, updatedAt: now,
            createdBy: user, updatedBy: null,
          };
          await custContainer.items.create(newCustomer);
          results.push({ ownerName: item.owner.ownerName, action: 'created', id: newCustomer.id });
          continue;
        }

        // action === 'link' (exact or user-selected fuzzy match)
        const customerId = mapping?.customerId || item.customer?.id;
        if (!customerId) {
          results.push({ ownerName: item.owner.ownerName, action: 'skipped', reason: 'no customerId' });
          continue;
        }
        const { resource: existing } = await custContainer.item(customerId, customerId).read();
        if (!existing) {
          results.push({ ownerName: item.owner.ownerName, action: 'error', reason: 'customer not found' });
          continue;
        }
        const updated = {
          ...existing,
          // Fill empty fields only
          phone: existing.phone || item.owner.ownerPhone || null,
          source: existing.source || 'Appfolio',
          linkedPropertyNames: Array.from(new Set([...(existing.linkedPropertyNames || []), ...linkedPropertyNames])),
          updatedAt: now,
          updatedBy: user,
        };
        await custContainer.items.upsert(updated);
        results.push({ ownerName: item.owner.ownerName, action: 'linked', id: customerId });
      }

      return { status: 200, jsonBody: { dryRun: false, results } };
    } catch (e) {
      context.log('SyncPropertiesToCRM error', e);
      return { status: 500, body: e.message };
    }
  },
});
