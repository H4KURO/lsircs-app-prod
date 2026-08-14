const { app } = require('@azure/functions');
const { PDFDocument } = require('pdf-lib');
const JSZip = require('jszip');
const { downloadPdfTemplate } = require('./pdfTemplateStorage');
const { getSheetValuesById, getSheetValues, columnLetterToIndex } = require('./sheetsClient');
const { getNamedContainer } = require('./cosmosClient');

const projectsContainer = () => getNamedContainer('Projects', ['COSMOS_PROJECTS_CONTAINER']);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try { return JSON.parse(Buffer.from(header, 'base64').toString('ascii')); } catch { return null; }
}

const ROUNDS = {
  1: { kanji: '第一次', ratio: 0.05 },
  2: { kanji: '第二次', ratio: 0.05 },
  3: { kanji: '第三次', ratio: 0.10 },
};

function fmt(n) {
  return n > 0 ? '$' + n.toLocaleString('en-US') : '';
}

// BLデータから差し込み値マップを生成
function buildValueMap(buyer, round, settings) {
  const price = parseFloat(buyer.purchasePrice) || 0;
  const dAmt  = Math.round(price * round.ratio);
  const escrow = String(buyer.escrowNo || '').trim();
  const remark = escrow
    ? `${escrow}   ${settings.escrowRemarkSuffix || ''}`.trimEnd()
    : (settings.escrowRemarkSuffix || '');

  return {
    __ownerNameEn:   buyer.ownerNameEn   || '',
    __titleName:     buyer.titleName     || '',
    __escrowNo:      buyer.escrowNo      || '',
    __unitNo:        buyer.unitNo        || '',
    __purchasePrice: fmt(price),
    __depositDate:   buyer.depositDate   || '',
    __depositAmount: fmt(dAmt),
    __buyerEmail:    buyer.buyerEmail    || '',
    __agentEmail:    buyer.agentEmail    || '',
    __remark:        remark,
    __propertyName:  settings.propertyName       || '',
    __propertyAddress: settings.propertyAddress  || '',
    __recipientName: settings.recipientName      || '',
    __recipientAddress: settings.recipientAddress || '',
    __recipientPhone: settings.recipientPhone    || '',
    __bankName:      settings.bankName           || '',
    __bankBranch:    settings.bankBranch         || '',
    __bankBranchAddress: settings.bankBranchAddress || '',
    __accountType:   settings.accountType        || '',
    __accountNo:     settings.accountNo          || '',
    __abaNo:         settings.abaNo              || '',
    __swiftCode:     settings.swiftCode          || '',
    __bankRegisteredAddress: settings.bankRegisteredAddress || '',
    __currency:      settings.currency           || 'USドル',
    __depositRound:  round.kanji,
  };
}

// POST /api/GenerateRemittancePdf
app.http('GenerateRemittancePdf', {
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
        if (e.code === 404 || (e.message || '').includes('NotFound'))
          return { status: 404, body: 'Project not found' };
        throw e;
      }
      if (!project) return { status: 404, body: 'Project not found' };

      const settings = project.documentSettings || {};
      const cm = settings.columnMapping || {};
      const pdfFieldMapping = settings.pdfFieldMapping || {};  // { fieldName: columnLetter }

      if (!settings.pdfTemplateBlobName) {
        return { status: 400, body: 'PDFテンプレートがアップロードされていません。設定からアップロードしてください。' };
      }

      // BLデータ取得
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
          _row:          row,  // 全列データを保持
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

      // PDFテンプレートをBlobからダウンロード
      const templateBuffer = await downloadPdfTemplate(projectId);
      const roundInfo = ROUNDS[round];
      const zip = new JSZip();

      for (const buyer of buyers) {
        const valueMap = buildValueMap(buyer, roundInfo, settings);
        const pdfDoc = await PDFDocument.load(templateBuffer, { ignoreEncryption: true });
        const form = pdfDoc.getForm();

        // pdfFieldMappingに従ってフィールドを埋める
        // { fieldName: columnLetter } → フィールドに値をセット
        for (const [fieldName, colLetter] of Object.entries(pdfFieldMapping)) {
          const value = get(buyer._row, colIdx(colLetter));
          try {
            const field = form.getField(fieldName);
            const type = field.constructor.name;
            if (type === 'PDFTextField') {
              field.setText(value);
            } else if (type === 'PDFCheckBox') {
              if (value === 'true' || value === '1' || value === 'yes') field.check();
              else field.uncheck();
            }
          } catch {
            // フィールドが存在しない場合はスキップ
          }
        }

        // フォームをフラット化（編集不可にする）
        form.flatten();

        const pdfBytes = await pdfDoc.save();
        const safe = (buyer.ownerNameEn || 'Owner').replace(/[\\/*?<>|:"\r\n]/g, '_').substring(0, 60);
        zip.file(`${safe}.pdf`, pdfBytes);
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      const propName  = settings.propertyName || 'Property';
      const filename  = `${propName}_${roundInfo.kanji}手付金送金案内_PDF.zip`;

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
      context.log('GenerateRemittancePdf failed', error);
      return { status: 500, body: `Error: ${error.message}` };
    }
  },
});
