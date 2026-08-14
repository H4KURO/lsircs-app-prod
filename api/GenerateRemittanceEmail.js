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

const ROUNDS = {
  1: { kanji: '第一次', ordinal: '第一回目', ratio: 0.05 },
  2: { kanji: '第二次', ordinal: '第二回目', ratio: 0.05 },
  3: { kanji: '第三次', ordinal: '第三回目', ratio: 0.10 },
};

function fmt(n) {
  return n > 0 ? '$' + n.toLocaleString('en-US') : '';
}

function encodeSubject(str) {
  return `=?UTF-8?B?${Buffer.from(str, 'utf8').toString('base64')}?=`;
}

function buildEmailBody(buyer, round, settings) {
  const pName   = settings.propertyName || '';
  const price   = parseFloat(buyer.purchasePrice) || 0;
  const dAmt    = Math.round(price * round.ratio);
  const escrow  = String(buyer.escrowNo || '').trim();
  const remark  = escrow
    ? `${escrow}   ${settings.escrowRemarkSuffix || ''}`.trimEnd()
    : (settings.escrowRemarkSuffix || '');

  const lines = [
    `${buyer.ownerNameEn || ''} 様`,
    '',
    '平素よりお世話になっております。',
    'List Sotheby\'s International Realty Japanでございます。',
    '',
    `この度は${pName}のご購入誠におめでとうございます。`,
    `${round.ordinal}の手付金として物件購入金額の${Math.round(round.ratio * 100)}%の金額を、以下のエスクロー口座にご送金いただきますようお願い申し上げます。`,
    '',
    '■送金依頼書への記入情報',
    `期日　　：${buyer.depositDate || ''}`,
    `送金額　：${fmt(dAmt)}`,
    '',
    '■受取人へのご連絡事項',
    `物件名　　　：${pName}`,
    `ユニット番号：${buyer.unitNo || ''}`,
    `物件住所　　：${settings.propertyAddress || ''}`,
    `名義人名　　：${buyer.titleName || ''}`,
    `備考　　　　：${remark}`,
    '',
    '※上記情報を英語表記にてご記入願います。',
    '',
    '■送金先情報',
    `受取人名　　　　　　：${settings.recipientName || ''}`,
    `受取人住所　　　　　：${settings.recipientAddress || ''}`,
    `電話番号　　　　　　：${settings.recipientPhone || ''}`,
    `受取銀行　　　　　　：${settings.bankName || ''}`,
    `支店　　　　　　　　：${settings.bankBranch || ''}`,
    `支店住所　　　　　　：${settings.bankBranchAddress || ''}`,
    `口座種類　　　　　　：${settings.accountType || ''}`,
    `口座番号　　　　　　：${settings.accountNo || ''}`,
    `USA ABA　　　　　　：${settings.abaNo || ''}`,
    `Swift Code　　　　　：${settings.swiftCode || ''}`,
    `銀行登録住所　　　　：${settings.bankRegisteredAddress || ''}`,
    `送金通貨　　　　　　：${settings.currency || 'USドル'}`,
    '',
    `※決済時には残金に加え購入価格の約2%の購入諸経費が必要です。`,
    `※送金目的を証明するために銀行より売買契約書の提示を求められる場合がございます。`,
    `※着金確認の為、送金依頼書の控えのコピーをEメールまたはファックス（03-6457-9495）で担当者までお送りいただけますようお願い申し上げます。`,
    `※経由銀行手数料を送金者様負担でお願い申し上げます。`,
  ];

  return lines.join('\r\n');
}

function buildEml(buyer, round, settings) {
  const pName    = settings.propertyName || '';
  const subject  = `${pName} ${round.kanji}手付金送金のご案内`;
  const from     = buyer.agentEmail || '';
  const to       = buyer.buyerEmail || '';
  const body     = buildEmailBody(buyer, round, settings);
  const bodyB64  = Buffer.from(body, 'utf8').toString('base64');

  const eml = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    bodyB64,
  ].join('\r\n');

  return eml;
}

// POST /api/GenerateRemittanceEmail
app.http('GenerateRemittanceEmail', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) return { status: 401, body: 'Unauthorized' };

    try {
      const { projectId, depositRound } = await request.json();
      if (!projectId) return { status: 400, body: 'projectId is required' };
      const round = parseInt(depositRound, 10);
      if (![1, 2, 3].includes(round)) return { status: 400, body: 'depositRound must be 1, 2, or 3' };

      const container = projectsContainer();
      let project;
      try {
        const { resource } = await container.item(projectId, projectId).read();
        project = resource;
      } catch (e) {
        if (e.code === 404 || (e.message || '').includes('NotFound')) return { status: 404, body: 'Project not found' };
        throw e;
      }
      if (!project) return { status: 404, body: 'Project not found' };

      const settings = project.documentSettings || {};
      const cm = settings.columnMapping || {};

      const sheetName  = project.sheetName || 'Buyers list';
      const headerRows = project.headerRows ?? 3;
      const allValues  = project.spreadsheetId
        ? await getSheetValuesById(project.spreadsheetId, `'${sheetName}'`)
        : await getSheetValues(`'${sheetName}'`);

      const dataRows = allValues.slice(headerRows);

      const colIdx = (letter) => (letter ? columnLetterToIndex(String(letter)) : -1);
      const nameIdx   = colIdx(cm.ownerNameEn);
      const titleIdx  = colIdx(cm.titleName);
      const escrowIdx = colIdx(cm.escrowNo);
      const unitIdx   = colIdx(cm.unitNo);
      const priceIdx  = colIdx(cm.purchasePrice);
      const dateIdx   = colIdx([cm.deposit1Date, cm.deposit2Date, cm.deposit3Date][round - 1]);
      const buyerEmailIdx = colIdx(cm.buyerEmail);
      const agentEmailIdx = colIdx(cm.agentEmail);

      const get = (row, idx) => (idx >= 0 && row ? String(row[idx] ?? '') : '');

      const buyers = dataRows
        .filter(row => row && row.some(v => v != null && v !== ''))
        .map(row => ({
          ownerNameEn:   get(row, nameIdx),
          titleName:     get(row, titleIdx),
          escrowNo:      get(row, escrowIdx),
          unitNo:        get(row, unitIdx),
          purchasePrice: parseFloat(get(row, priceIdx)) || 0,
          depositDate:   get(row, dateIdx),
          buyerEmail:    get(row, buyerEmailIdx),
          agentEmail:    get(row, agentEmailIdx),
        }))
        .filter(b => b.ownerNameEn);

      if (buyers.length === 0) {
        return { status: 400, body: '対象バイヤーが見つかりませんでした。列マッピングを確認してください。' };
      }

      const roundInfo = ROUNDS[round];
      const zip = new JSZip();

      for (const buyer of buyers) {
        const eml  = buildEml(buyer, roundInfo, settings);
        const safe = (buyer.ownerNameEn || 'Owner').replace(/[\\/*?<>|:"\r\n]/g, '_').substring(0, 60);
        zip.file(`${safe}.eml`, eml);
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      const propName  = settings.propertyName || 'Property';
      const filename  = `${propName}_${roundInfo.kanji}手付金送金案内_メール.zip`;

      return {
        status: 200,
        body: zipBuffer,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
          'Content-Length': zipBuffer.byteLength.toString(),
        },
      };
    } catch (error) {
      context.log('GenerateRemittanceEmail failed', error);
      return { status: 500, body: `Error: ${error.message}` };
    }
  },
});
