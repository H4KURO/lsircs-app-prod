const { app } = require('@azure/functions');
const ExcelJS = require('exceljs');
const { getSheetValuesById, getSheetValues, columnLetterToIndex } = require('./sheetsClient');
const { getNamedContainer } = require('./cosmosClient');

const projectsContainer = () => getNamedContainer('Projects', ['COSMOS_PROJECTS_CONTAINER']);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try { return JSON.parse(Buffer.from(header, 'base64').toString('ascii')); } catch { return null; }
}

const ROUNDS = {
  1: { kanji: '第一次', ordinal: '第一回目', ratio: 0.05, depositLabel: '第１デポジット(5%)' },
  2: { kanji: '第二次', ordinal: '第二回目', ratio: 0.05, depositLabel: '第２デポジット(5%)' },
  3: { kanji: '第三次', ordinal: '第三回目', ratio: 0.10, depositLabel: '第３デポジット(10%)' },
};

function fmtUSD(n) {
  if (n == null || isNaN(n) || n === '' || n === 0) return '$0';
  return '$' + Number(n).toLocaleString('en-US');
}

function borderStyle() {
  const thin = { style: 'thin', color: { argb: 'FF999999' } };
  return { top: thin, left: thin, bottom: thin, right: thin };
}

function buildSheet(ws, buyer, round, settings) {
  const title = `${settings.propertyName || ''} ${round.kanji}手付金送金のご案内`;
  const price = parseFloat(buyer.purchasePrice) || 0;
  const d1 = Math.round(price * 0.05);
  const d2 = Math.round(price * 0.05);
  const d3 = Math.round(price * 0.10);
  const depositAmt = Math.round(price * round.ratio);
  const escrowNo = String(buyer.escrowNo || '').trim();
  const suffix = settings.escrowRemarkSuffix || '';
  const remark = escrowNo ? `${escrowNo}   ${suffix}`.trim() : suffix;

  // Column widths
  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 26;
  ws.getColumn(3).width = 42;
  ws.getColumn(4).width = 14;
  ws.getColumn(5).width = 22;
  ws.getColumn(6).width = 16;

  const setCell = (row, col, value, opts = {}) => {
    const cell = ws.getRow(row).getCell(col);
    cell.value = value;
    if (opts.bold) cell.font = { ...(cell.font || {}), bold: true, size: opts.size || 10 };
    if (opts.size) cell.font = { ...(cell.font || {}), size: opts.size };
    if (opts.border) cell.border = borderStyle();
    if (opts.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };
    if (opts.wrapText) cell.alignment = { wrapText: true, vertical: 'top' };
    if (opts.vMid) cell.alignment = { vertical: 'middle', ...cell.alignment };
  };

  // R1: Title
  setCell(1, 1, title, { bold: true, size: 12 });
  ws.mergeCells('A1:F1');

  // R2: Owner name + 様
  setCell(2, 1, buyer.ownerNameEn || '');
  ws.getRow(2).getCell(1).font = { size: 11 };
  setCell(2, 2, '様');
  ws.mergeCells('B2:F2');

  // R3: Property / Unit / Price header row
  setCell(3, 1, settings.propertyName || '', { border: true, fill: 'FFEEF2FF' });
  setCell(3, 3, 'Unit #', { border: true, fill: 'FFEEF2FF' });
  setCell(3, 4, buyer.unitNo || '', { border: true });
  setCell(3, 5, '購入価格', { border: true, fill: 'FFEEF2FF' });
  setCell(3, 6, fmtUSD(price), { border: true });

  // R4-6: Deposit schedule
  setCell(4, 5, '第１デポジット(5%)', { border: true, fill: 'FFEEF2FF' });
  setCell(4, 6, fmtUSD(d1), { border: true });
  setCell(5, 5, '第２デポジット(5%)', { border: true, fill: 'FFEEF2FF' });
  setCell(5, 6, fmtUSD(d2), { border: true });
  setCell(6, 1, '※決済時には残金に加え購入価格の約2%の購入諸経費が必要です。');
  ws.getRow(6).getCell(1).font = { size: 9, color: { argb: 'FF666666' } };
  setCell(6, 5, '第３デポジット(10%)', { border: true, fill: 'FFEEF2FF' });
  setCell(6, 6, fmtUSD(d3), { border: true });

  // R7: Instruction sentence
  const sentence = `${round.ordinal}の手付金として物件購入金額の${Math.round(round.ratio * 100)}%の金額を、以下のエスクロー口座にご送金いただきます。`;
  setCell(7, 1, sentence);
  ws.mergeCells('A7:F7');

  // R8: 送金依頼書 header
  setCell(8, 1, '送金依頼書への記入情報', { bold: true, fill: 'FFE8EAF6' });
  ws.mergeCells('A8:F8');
  ws.getRow(8).height = 18;

  // R9: 期日
  setCell(9, 1, '期日', { border: true, fill: 'FFEEF2FF' });
  setCell(9, 2, buyer.depositDate || '', { border: true });
  ws.mergeCells('B9:F9');

  // R10: 送金額
  setCell(10, 1, '送金額', { border: true, fill: 'FFEEF2FF' });
  setCell(10, 2, fmtUSD(depositAmt), { border: true });
  ws.mergeCells('B10:F10');

  // R11: 受取人ご連絡事項 header
  setCell(11, 1, '受取人へのご連絡事項', { bold: true, fill: 'FFE8EAF6' });
  ws.mergeCells('A11:F11');
  ws.getRow(11).height = 18;

  // R12-16: Contact info for recipient
  const contactRows = [
    ['物件名', settings.propertyName || ''],
    ['ユニット番号', buyer.unitNo || ''],
    ['物件住所', settings.propertyAddress || ''],
    ['名義人名', buyer.titleName || ''],
    ['備考', remark],
  ];
  contactRows.forEach(([label, val], i) => {
    const r = 12 + i;
    setCell(r, 2, label, { border: true, fill: 'FFEEF2FF' });
    setCell(r, 3, val, { border: true });
    ws.mergeCells(`C${r}:F${r}`);
  });
  setCell(17, 2, '※上記情報を英語表記にてご記入願います');
  ws.getRow(17).getCell(2).font = { size: 9, color: { argb: 'FF666666' } };
  ws.mergeCells('B17:F17');

  // R18: 送金先情報 header
  setCell(18, 1, '送金先情報', { bold: true, fill: 'FFE8EAF6' });
  ws.mergeCells('A18:F18');
  ws.getRow(18).height = 18;

  // R19-30: Bank info
  const bankRows = [
    ['受取人名', settings.recipientName || ''],
    ['受取人住所', settings.recipientAddress || ''],
    ['電話番号', settings.recipientPhone || ''],
    ['受取銀行', settings.bankName || ''],
    ['支店', settings.bankBranch || ''],
    ['支店住所', settings.bankBranchAddress || ''],
    ['口座種類', settings.accountType || ''],
    ['口座番号', settings.accountNo || ''],
    ['USA  ABA', settings.abaNo || ''],
    ['Swift Code', settings.swiftCode || ''],
    ['銀行に登録されている\n当該口座の住所', settings.bankRegisteredAddress || ''],
    ['送金通貨', settings.currency || 'USドル'],
  ];
  bankRows.forEach(([label, val], i) => {
    const r = 19 + i;
    setCell(r, 1, label, { border: true, fill: 'FFEEF2FF', wrapText: label.includes('\n') });
    setCell(r, 2, val, { border: true });
    ws.mergeCells(`B${r}:F${r}`);
    if (label.includes('\n')) ws.getRow(r).height = 28;
  });

  // Notes
  const notes = [
    '※送金目的を証明するために銀行より売買契約書の提示を求められる場合がございます。',
    '※着金確認の為、送金依頼書の控えのコピーをEメールまたはファックス（03-6457-9495）で担当者までお送りいただけますようお願い申し上げます。',
    '※経由銀行手数料を送金者様負担でお願い申し上げます。',
  ];
  notes.forEach((note, i) => {
    const r = 32 + i;
    setCell(r, 1, `　　　　${note}`);
    ws.getRow(r).getCell(1).font = { size: 9, color: { argb: 'FF555555' } };
    ws.mergeCells(`A${r}:F${r}`);
  });
}

app.http('GenerateRemittanceExcel', {
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

      const sheetName = project.sheetName || 'Buyers list';
      const headerRows = project.headerRows ?? 3;
      const allValues = project.spreadsheetId
        ? await getSheetValuesById(project.spreadsheetId, `'${sheetName}'`)
        : await getSheetValues(`'${sheetName}'`);

      const dataRows = allValues.slice(headerRows);

      const colIdx = (letter) => (letter ? columnLetterToIndex(String(letter)) : -1);
      const nameIdx   = colIdx(cm.ownerNameEn);
      const titleIdx  = colIdx(cm.titleName);
      const escrowIdx = colIdx(cm.escrowNo);
      const unitIdx   = colIdx(cm.unitNo);
      const priceIdx  = colIdx(cm.purchasePrice);
      const dateIdxMap = {
        1: colIdx(cm.deposit1Date),
        2: colIdx(cm.deposit2Date),
        3: colIdx(cm.deposit3Date),
      };
      const dateIdx = dateIdxMap[round];

      const get = (row, idx) => (idx >= 0 && row ? (row[idx] ?? '') : '');

      const buyers = dataRows
        .filter(row => row && row.some(v => v != null && v !== ''))
        .map(row => ({
          ownerNameEn:  get(row, nameIdx),
          titleName:    get(row, titleIdx),
          escrowNo:     get(row, escrowIdx),
          unitNo:       get(row, unitIdx),
          purchasePrice: parseFloat(get(row, priceIdx)) || 0,
          depositDate:  get(row, dateIdx),
        }))
        .filter(b => b.ownerNameEn);

      if (buyers.length === 0) {
        return { status: 400, body: '対象バイヤーが見つかりませんでした。列マッピングを確認してください。' };
      }

      const roundInfo = ROUNDS[round];
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'lsir-cs';

      for (const buyer of buyers) {
        const safeName = (buyer.ownerNameEn || 'Owner').replace(/[\\/*?[\]]/g, '').substring(0, 31);
        const ws = workbook.addWorksheet(safeName);
        buildSheet(ws, buyer, roundInfo, settings);
      }

      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
      const propName = settings.propertyName || 'Property';
      const filename = `${propName}_${roundInfo.kanji}手付金送金案内.xlsx`;

      return {
        status: 200,
        body: buffer,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
          'Content-Length': buffer.byteLength.toString(),
        },
      };
    } catch (error) {
      context.log('GenerateRemittanceExcel failed', error);
      return { status: 500, body: `Error: ${error.message}` };
    }
  },
});
