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
  1: { kanji: '第一次', ordinal: '第一回目', ratio: 0.05 },
  2: { kanji: '第二次', ordinal: '第二回目', ratio: 0.05 },
  3: { kanji: '第三次', ordinal: '第三回目', ratio: 0.10 },
};

// ── スタイル定数 ──────────────────────────────────────────────────
const NAVY       = 'FF1A3A6B';   // セクションヘッダー背景
const LABEL_BG   = 'FFF2F2F2';  // ラベルセル背景
const PRICE_BG   = 'FFEAF0F8';  // 購入価格テーブル背景
const FONT_NAME  = 'ＭＳ ゴシック';

const thin  = (color = 'FF999999') => ({ style: 'thin',   color: { argb: color } });
const med   = (color = 'FF555555') => ({ style: 'medium', color: { argb: color } });
const allThin = () => ({ top: thin(), left: thin(), bottom: thin(), right: thin() });
const allMed  = () => ({ top: med(), left: med(), bottom: med(), right: med() });

function fill(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function baseFont(size = 10, bold = false, color = 'FF000000') {
  return { name: FONT_NAME, size, bold, color: { argb: color } };
}

function applyCell(cell, value, opts = {}) {
  cell.value = value;
  cell.font  = baseFont(opts.size || 10, opts.bold || false, opts.color || 'FF000000');
  if (opts.fill)     cell.fill      = fill(opts.fill);
  if (opts.border)   cell.border    = opts.border;
  if (opts.align)    cell.alignment = opts.align;
}

// ── buildSheet ────────────────────────────────────────────────────
function buildSheet(ws, buyer, round, settings) {
  const pName  = settings.propertyName || '';
  const price  = parseFloat(buyer.purchasePrice) || 0;
  const d1     = Math.round(price * 0.05);
  const d2     = Math.round(price * 0.05);
  const d3     = Math.round(price * 0.10);
  const dAmt   = Math.round(price * round.ratio);
  const escrow = String(buyer.escrowNo || '').trim();
  const remark = escrow
    ? `${escrow}   ${settings.escrowRemarkSuffix || ''}`.trimEnd()
    : (settings.escrowRemarkSuffix || '');

  const fmt = (n) => n > 0 ? '$' + n.toLocaleString('en-US') : '';

  // 列幅
  ws.getColumn(1).width = 32;  // A: ラベル/長文
  ws.getColumn(2).width = 18;  // B: サブラベル or 値
  ws.getColumn(3).width = 38;  // C: 値 (連絡事項)
  ws.getColumn(4).width = 12;  // D: unit値
  ws.getColumn(5).width = 24;  // E: 右テーブル ラベル
  ws.getColumn(6).width = 16;  // F: 右テーブル 値
  ws.getColumn(7).width = 2;   // G: マージン

  const r = (n) => ws.getRow(n);
  const c = (row, col) => ws.getRow(row).getCell(col);

  // ── R1: タイトル ──────────────────────────────────────────
  ws.getRow(1).height = 28;
  applyCell(c(1,1), `${pName}　${round.kanji}手付金送金のご案内`, {
    size: 14, bold: true,
    align: { horizontal: 'left', vertical: 'middle' },
  });
  ws.mergeCells('A1:F1');

  // ── R2: 空白行 ──────────────────────────────────────────────
  ws.getRow(2).height = 6;

  // ── R3: 宛名 ────────────────────────────────────────────────
  ws.getRow(3).height = 22;
  applyCell(c(3,1), buyer.ownerNameEn || '', {
    size: 13, bold: true,
    align: { horizontal: 'left', vertical: 'middle' },
  });
  applyCell(c(3,3), '様', {
    size: 12,
    align: { horizontal: 'left', vertical: 'middle' },
  });

  // ── R4: 空白行 ──────────────────────────────────────────────
  ws.getRow(4).height = 6;

  // ── R5-8: 購入価格テーブル (左: 物件/Unit、右: 各デポジット) ──
  // Row 5 header
  ws.getRow(5).height = 18;
  applyCell(c(5,1), pName, {
    fill: PRICE_BG, border: allThin(), bold: true,
    align: { horizontal: 'center', vertical: 'middle' },
  });
  ws.mergeCells('A5:B5');
  applyCell(c(5,3), 'Unit #', {
    fill: LABEL_BG, border: allThin(),
    align: { horizontal: 'center', vertical: 'middle' },
  });
  applyCell(c(5,4), buyer.unitNo || '', {
    border: allThin(),
    align: { horizontal: 'center', vertical: 'middle' },
  });
  applyCell(c(5,5), '購入価格', {
    fill: LABEL_BG, border: allThin(),
    align: { horizontal: 'center', vertical: 'middle' },
  });
  applyCell(c(5,6), fmt(price), {
    border: allThin(),
    align: { horizontal: 'right', vertical: 'middle' },
  });

  const depositRows = [
    { r: 6, label: '第１デポジット(5%)', val: fmt(d1) },
    { r: 7, label: '第２デポジット(5%)', val: fmt(d2) },
    { r: 8, label: '第３デポジット(10%)', val: fmt(d3) },
  ];
  depositRows.forEach(({ r: rowN, label, val }) => {
    ws.getRow(rowN).height = 17;
    // A-D: 空白 (マージ)
    applyCell(c(rowN, 1), '', { border: { right: thin() } });
    ws.mergeCells(`A${rowN}:D${rowN}`);
    applyCell(c(rowN, 5), label, {
      fill: LABEL_BG, border: allThin(),
      align: { horizontal: 'left', vertical: 'middle' },
    });
    applyCell(c(rowN, 6), val, {
      border: allThin(),
      align: { horizontal: 'right', vertical: 'middle' },
    });
  });

  // ── R9: 備考（購入諸経費） ──────────────────────────────────
  ws.getRow(9).height = 14;
  applyCell(c(9,1), '※決済時には残金に加え購入価格の約2%の購入諸経費が必要です。', {
    size: 9, color: 'FF666666',
    align: { horizontal: 'left', vertical: 'middle' },
  });
  ws.mergeCells('A9:F9');

  // ── R10: 空白 ─────────────────────────────────────────────────
  ws.getRow(10).height = 6;

  // ── R11: 案内文 ────────────────────────────────────────────────
  ws.getRow(11).height = 16;
  const sentence = `${round.ordinal}の手付金として物件購入金額の${Math.round(round.ratio*100)}%の金額を、以下のエスクロー口座にご送金いただきます。`;
  applyCell(c(11,1), sentence, {
    align: { horizontal: 'left', vertical: 'middle' },
  });
  ws.mergeCells('A11:F11');

  // ── R12: セクションヘッダー「送金依頼書への記入情報」 ─────────
  ws.getRow(12).height = 20;
  applyCell(c(12,1), '送金依頼書への記入情報', {
    bold: true, size: 10, fill: NAVY, color: 'FFFFFFFF',
    border: allMed(),
    align: { horizontal: 'left', vertical: 'middle' },
  });
  ws.mergeCells('A12:F12');

  // R13: 期日
  ws.getRow(13).height = 18;
  applyCell(c(13,1), '期日', {
    fill: LABEL_BG, border: allThin(),
    align: { horizontal: 'center', vertical: 'middle' },
  });
  applyCell(c(13,2), buyer.depositDate || '', {
    border: allThin(),
    align: { horizontal: 'left', vertical: 'middle' },
  });
  ws.mergeCells('B13:F13');

  // R14: 送金額
  ws.getRow(14).height = 18;
  applyCell(c(14,1), '送金額', {
    fill: LABEL_BG, border: allThin(),
    align: { horizontal: 'center', vertical: 'middle' },
  });
  applyCell(c(14,2), fmt(dAmt), {
    border: allThin(), bold: true,
    align: { horizontal: 'left', vertical: 'middle' },
  });
  ws.mergeCells('B14:F14');

  // ── R15: 空白 ─────────────────────────────────────────────────
  ws.getRow(15).height = 6;

  // ── R16: セクションヘッダー「受取人へのご連絡事項」 ──────────
  ws.getRow(16).height = 20;
  applyCell(c(16,1), '受取人へのご連絡事項', {
    bold: true, size: 10, fill: NAVY, color: 'FFFFFFFF',
    border: allMed(),
    align: { horizontal: 'left', vertical: 'middle' },
  });
  ws.mergeCells('A16:F16');

  // R17-21: 連絡事項テーブル
  const contactRows = [
    ['物件名',     pName                     ],
    ['ユニット番号', buyer.unitNo || ''         ],
    ['物件住所',    settings.propertyAddress || ''],
    ['名義人名',    buyer.titleName || ''       ],
    ['備考',       remark                     ],
  ];
  contactRows.forEach(([label, val], i) => {
    const rowN = 17 + i;
    ws.getRow(rowN).height = 17;
    applyCell(c(rowN, 1), label, {
      fill: LABEL_BG, border: allThin(),
      align: { horizontal: 'center', vertical: 'middle' },
    });
    applyCell(c(rowN, 2), val, {
      border: allThin(),
      align: { horizontal: 'left', vertical: 'middle' },
    });
    ws.mergeCells(`B${rowN}:F${rowN}`);
  });

  // R22: 英語表記注記
  ws.getRow(22).height = 14;
  applyCell(c(22,1), '※上記情報を英語表記にてご記入願います', {
    size: 9, color: 'FF666666',
    align: { horizontal: 'left', vertical: 'middle' },
  });
  ws.mergeCells('A22:F22');

  // ── R23: 空白 ────────────────────────────────────────────────
  ws.getRow(23).height = 6;

  // ── R24: セクションヘッダー「送金先情報」 ────────────────────
  ws.getRow(24).height = 20;
  applyCell(c(24,1), '送金先情報', {
    bold: true, size: 10, fill: NAVY, color: 'FFFFFFFF',
    border: allMed(),
    align: { horizontal: 'left', vertical: 'middle' },
  });
  ws.mergeCells('A24:F24');

  // R25-36: 送金先テーブル
  const bankRows = [
    ['受取人名',                    settings.recipientName         || ''],
    ['受取人住所',                  settings.recipientAddress       || ''],
    ['電話番号',                    settings.recipientPhone         || ''],
    ['受取銀行',                    settings.bankName               || ''],
    ['支店',                       settings.bankBranch             || ''],
    ['支店住所',                    settings.bankBranchAddress      || ''],
    ['口座種類',                    settings.accountType            || ''],
    ['口座番号',                    settings.accountNo              || ''],
    ['USA  ABA',                   settings.abaNo                  || ''],
    ['Swift Code',                  settings.swiftCode              || ''],
    ['銀行に登録されている\n当該口座の住所', settings.bankRegisteredAddress || ''],
    ['送金通貨',                    settings.currency               || 'USドル'],
  ];
  bankRows.forEach(([label, val], i) => {
    const rowN = 25 + i;
    const isWrap = label.includes('\n');
    ws.getRow(rowN).height = isWrap ? 30 : 17;
    applyCell(c(rowN, 1), label, {
      fill: LABEL_BG, border: allThin(),
      align: { horizontal: 'center', vertical: 'middle', wrapText: isWrap },
    });
    applyCell(c(rowN, 2), val, {
      border: allThin(),
      align: { horizontal: 'left', vertical: 'middle' },
    });
    ws.mergeCells(`B${rowN}:F${rowN}`);
  });

  // ── R38: 空白 ─────────────────────────────────────────────────
  ws.getRow(38).height = 10;

  // ── R39-41: 注記 ─────────────────────────────────────────────
  const notes = [
    '※送金目的を証明するために銀行より売買契約書の提示を求められる場合がございます。',
    '※着金確認の為、送金依頼書の控えのコピーをEメールまたはファックス（03-6457-9495）で担当者までお送りいただけますようお願い申し上げます。',
    '※経由銀行手数料を送金者様負担でお願い申し上げます。',
  ];
  notes.forEach((note, i) => {
    const rowN = 39 + i;
    ws.getRow(rowN).height = 14;
    applyCell(c(rowN, 1), `　　${note}`, {
      size: 9, color: 'FF555555',
      align: { horizontal: 'left', vertical: 'middle' },
    });
    ws.mergeCells(`A${rowN}:F${rowN}`);
  });

  // シートの印刷設定
  ws.pageSetup = {
    paperSize: 9,        // A4
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.7, right: 0.7, top: 0.9, bottom: 0.9, header: 0.3, footer: 0.3 },
  };
}

// ── Handler ───────────────────────────────────────────────────────
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
        }))
        .filter(b => b.ownerNameEn);

      if (buyers.length === 0) {
        return { status: 400, body: '対象バイヤーが見つかりませんでした。列マッピングを確認してください。' };
      }

      const roundInfo = ROUNDS[round];
      const workbook  = new ExcelJS.Workbook();
      workbook.creator = 'lsir-cs';

      for (const buyer of buyers) {
        const safeName = (buyer.ownerNameEn || 'Owner').replace(/[\\/*?[\]:]/g, '').substring(0, 31);
        buildSheet(workbook.addWorksheet(safeName), buyer, roundInfo, settings);
      }

      const buffer   = Buffer.from(await workbook.xlsx.writeBuffer());
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
