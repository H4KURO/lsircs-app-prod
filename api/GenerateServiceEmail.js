const { app } = require('@azure/functions');
const JSZip = require('jszip');
const { getSheetValuesById, getSheetValues, columnLetterToIndex } = require('./sheetsClient');
const { getNamedContainer } = require('./cosmosClient');

const projectsContainer = () => getNamedContainer('Projects', ['COSMOS_PROJECTS_CONTAINER']);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try { return JSON.parse(Buffer.from(header, 'base64').toString('ascii')); } catch { return null; }
}

// 料金テーブルマッチング
// row の各条件が空の場合は「any」として扱う
function matchRate(buyer, rateRow) {
  const { bedrooms, usage, sqftMin, sqftMax, floorMin, floorMax, stack } = rateRow;

  if (bedrooms && bedrooms !== '' && String(buyer.bedrooms).trim() !== String(bedrooms).trim()) return false;
  if (usage    && usage    !== '' && String(buyer.usage).trim().toLowerCase() !== String(usage).trim().toLowerCase()) return false;
  if (stack    && stack    !== '' && String(buyer.stack).trim() !== String(stack).trim()) return false;

  const sqft  = parseFloat(buyer.sqft)  || 0;
  const floor = parseFloat(buyer.floor) || 0;

  if (sqftMin  != null && sqftMin  !== '' && sqft  < parseFloat(sqftMin))  return false;
  if (sqftMax  != null && sqftMax  !== '' && sqft  > parseFloat(sqftMax))  return false;
  if (floorMin != null && floorMin !== '' && floor < parseFloat(floorMin)) return false;
  if (floorMax != null && floorMax !== '' && floor > parseFloat(floorMax)) return false;

  return true;
}

function findRate(buyer, rateTable) {
  if (!Array.isArray(rateTable)) return null;
  return rateTable.find(row => matchRate(buyer, row)) || null;
}

// テンプレート変数を置換
function renderTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

function encodeSubject(str) {
  return `=?UTF-8?B?${Buffer.from(str, 'utf8').toString('base64')}?=`;
}

function buildEml(from, to, subject, body) {
  const bodyB64 = Buffer.from(body, 'utf8').toString('base64');
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    bodyB64,
  ].join('\r\n');
}

// POST /api/GenerateServiceEmail
// Body JSON: { projectId, providerId }
app.http('GenerateServiceEmail', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) return { status: 401, body: 'Unauthorized' };

    try {
      const { projectId, providerId } = await request.json();
      if (!projectId)  return { status: 400, body: 'projectId is required' };
      if (!providerId) return { status: 400, body: 'providerId is required' };

      const container = projectsContainer();
      let project;
      try {
        const { resource } = await container.item(projectId, projectId).read();
        project = resource;
      } catch (e) {
        if (e.code === 404 || (e.message || '').includes('NotFound'))
          return { status: 404, body: 'Project not found' };
        throw e;
      }
      if (!project) return { status: 404, body: 'Project not found' };

      const ds = project.documentSettings || {};
      const cm = ds.columnMapping || {};
      const providers = Array.isArray(ds.serviceProviders) ? ds.serviceProviders : [];
      const provider = providers.find(p => p.id === providerId);
      if (!provider) return { status: 404, body: '業者が見つかりません。' };

      // BLデータ取得
      const sheetName  = project.sheetName || 'Buyers list';
      const headerRows = project.headerRows ?? 3;
      const allValues  = project.spreadsheetId
        ? await getSheetValuesById(project.spreadsheetId, `'${sheetName}'`)
        : await getSheetValues(`'${sheetName}'`);

      const dataRows = allValues.slice(headerRows);
      const colIdx = (letter) => (letter ? columnLetterToIndex(String(letter)) : -1);
      const get = (row, idx) => (idx >= 0 && row ? String(row[idx] ?? '') : '');

      const buyers = dataRows
        .filter(row => row && row.some(v => v != null && v !== ''))
        .map(row => ({
          ownerNameEn:  get(row, colIdx(cm.ownerNameEn)),
          unitNo:       get(row, colIdx(cm.unitNo)),
          buyerEmail:   get(row, colIdx(cm.buyerEmail)),
          agentEmail:   get(row, colIdx(cm.agentEmail)),
          bedrooms:     get(row, colIdx(cm.bedrooms)),
          sqft:         get(row, colIdx(cm.sqft)),
          usage:        get(row, colIdx(cm.usage)),
          floor:        get(row, colIdx(cm.floor)),
          stack:        get(row, colIdx(cm.stack)),
        }))
        .filter(b => b.ownerNameEn);

      if (buyers.length === 0) {
        return { status: 400, body: '対象バイヤーが見つかりませんでした。' };
      }

      const zip = new JSZip();
      const noMatchBuyers = [];

      for (const buyer of buyers) {
        const rateRow = findRate(buyer, provider.rateTable || []);

        if (!rateRow) {
          noMatchBuyers.push(buyer.ownerNameEn);
        }

        const fee = rateRow?.fee ?? '';
        const feeLabel = rateRow?.feeLabel ?? '';
        const feeNote = rateRow?.notes ?? '';

        const vars = {
          ownerNameEn:  buyer.ownerNameEn,
          unitNo:       buyer.unitNo,
          bedrooms:     buyer.bedrooms,
          sqft:         buyer.sqft,
          usage:        buyer.usage,
          floor:        buyer.floor,
          stack:        buyer.stack,
          fee:          fee ? `$${parseFloat(fee).toLocaleString('en-US')}` : '（条件不一致のため算出不可）',
          feeLabel:     feeLabel,
          feeNote:      feeNote,
          providerName: provider.name,
          providerType: provider.type === 'insurance' ? '保険' : 'インスペクション',
          propertyName: ds.propertyName || '',
          buyerEmail:   buyer.buyerEmail,
          agentEmail:   buyer.agentEmail,
        };

        const subject = renderTemplate(provider.emailSubject || `{{propertyName}} {{providerType}}見積もりのご案内`, vars);
        const body    = renderTemplate(provider.emailBody || '', vars);
        const eml     = buildEml(buyer.agentEmail, buyer.buyerEmail, subject, body);

        const safe = buyer.ownerNameEn.replace(/[\\/*?<>|:"\r\n]/g, '_').substring(0, 60);
        zip.file(`${safe}.eml`, eml);
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      const propName  = ds.propertyName || 'Property';
      const typeLabel = provider.type === 'insurance' ? '保険' : 'インスペクション';
      const filename  = `${propName}_${provider.name}_${typeLabel}見積もり案内.zip`;

      return {
        status: 200,
        body: zipBuffer,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
          'Content-Length': zipBuffer.byteLength.toString(),
          'X-No-Match-Buyers': noMatchBuyers.join(','),
        },
      };
    } catch (error) {
      context.log('GenerateServiceEmail failed', error);
      return { status: 500, body: `Error: ${error.message}` };
    }
  },
});
