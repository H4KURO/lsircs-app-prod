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

// POST /api/GenerateRemittancePdf
// Body JSON: { projectId, depositRound, templateId }
app.http('GenerateRemittancePdf', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) return { status: 401, body: 'Unauthorized' };

    try {
      const { projectId, depositRound, templateId } = await request.json();
      if (!projectId)  return { status: 400, body: 'projectId is required' };
      if (!templateId) return { status: 400, body: 'templateId is required' };
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

      const ds = project.documentSettings || {};
      const cm = ds.columnMapping || {};
      const templates = Array.isArray(ds.pdfTemplates) ? ds.pdfTemplates : [];
      const template = templates.find(t => t.id === templateId);

      if (!template) return { status: 404, body: 'PDFテンプレートが見つかりません。' };
      const pdfFieldMapping = template.fieldMapping || {};

      // BLデータ取得
      const sheetName  = project.sheetName || 'Buyers list';
      const headerRows = project.headerRows ?? 3;
      const allValues  = project.spreadsheetId
        ? await getSheetValuesById(project.spreadsheetId, `'${sheetName}'`)
        : await getSheetValues(`'${sheetName}'`);

      const dataRows = allValues.slice(headerRows);

      const colIdx = (letter) => (letter ? columnLetterToIndex(String(letter)) : -1);
      const get = (row, idx) => (idx >= 0 && row ? String(row[idx] ?? '') : '');

      const nameIdx   = colIdx(cm.ownerNameEn);
      const priceIdx  = colIdx(cm.purchasePrice);
      const dateIdx   = colIdx([cm.deposit1Date, cm.deposit2Date, cm.deposit3Date][round - 1]);

      const buyers = dataRows
        .filter(row => row && row.some(v => v != null && v !== ''))
        .map(row => ({ _row: row, ownerNameEn: get(row, nameIdx) }))
        .filter(b => b.ownerNameEn);

      if (buyers.length === 0) {
        return { status: 400, body: '対象バイヤーが見つかりませんでした。列マッピングを確認してください。' };
      }

      const roundInfo = ROUNDS[round];
      const templateBuffer = await downloadPdfTemplate(template.blobName);
      const zip = new JSZip();

      for (const buyer of buyers) {
        const row = buyer._row;
        const price = parseFloat(get(row, priceIdx)) || 0;
        const dAmt  = Math.round(price * roundInfo.ratio);

        // 固定キーから値を解決する辞書（フィールド名が __xxx 形式の予約キーも使えるようにする）
        const builtins = {
          __ownerNameEn:   get(row, colIdx(cm.ownerNameEn)),
          __titleName:     get(row, colIdx(cm.titleName)),
          __escrowNo:      get(row, colIdx(cm.escrowNo)),
          __unitNo:        get(row, colIdx(cm.unitNo)),
          __purchasePrice: fmt(price),
          __depositDate:   get(row, dateIdx),
          __depositAmount: fmt(dAmt),
          __buyerEmail:    get(row, colIdx(cm.buyerEmail)),
          __agentEmail:    get(row, colIdx(cm.agentEmail)),
          __depositRound:  roundInfo.kanji,
          __propertyName:  ds.propertyName       || '',
          __propertyAddress: ds.propertyAddress  || '',
          __recipientName: ds.recipientName      || '',
          __recipientAddress: ds.recipientAddress || '',
          __recipientPhone: ds.recipientPhone    || '',
          __bankName:      ds.bankName           || '',
          __bankBranch:    ds.bankBranch         || '',
          __accountNo:     ds.accountNo          || '',
          __abaNo:         ds.abaNo              || '',
          __swiftCode:     ds.swiftCode          || '',
          __currency:      ds.currency           || 'USドル',
        };

        const pdfDoc = await PDFDocument.load(templateBuffer, { ignoreEncryption: true });
        const form = pdfDoc.getForm();

        for (const [fieldName, colLetterOrKey] of Object.entries(pdfFieldMapping)) {
          // colLetterOrKey が __xxx ならビルトイン辞書から、それ以外は列インデックスで取得
          const value = builtins[colLetterOrKey] !== undefined
            ? builtins[colLetterOrKey]
            : get(row, colIdx(colLetterOrKey));
          try {
            const field = form.getField(fieldName);
            if (field.constructor.name === 'PDFTextField') {
              field.setText(value);
            } else if (field.constructor.name === 'PDFCheckBox') {
              if (['true', '1', 'yes'].includes(value.toLowerCase())) field.check();
              else field.uncheck();
            }
          } catch {
            // フィールドが存在しない場合はスキップ
          }
        }

        form.flatten();

        const pdfBytes = await pdfDoc.save();
        const safe = buyer.ownerNameEn.replace(/[\\/*?<>|:"\r\n]/g, '_').substring(0, 60);
        zip.file(`${safe}.pdf`, pdfBytes);
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      const propName  = ds.propertyName || 'Property';
      const filename  = `${propName}_${roundInfo.kanji}手付金_${template.name}.zip`;

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
