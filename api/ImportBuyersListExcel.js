const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const ExcelJS = require('exceljs');
const { getNamedContainer } = require('./cosmosClient');

const buyersListContainer = () =>
  getNamedContainer('BuyersList', ['COSMOS_BUYERSLIST_CONTAINER', 'CosmosBuyersListContainer']);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch (error) {
    return null;
  }
}

function parseExcelValue(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  if (typeof value === 'object' && value.text) {
    return value.text;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  // 数式の結果を取得
  if (typeof value === 'object' && value.result !== undefined) {
    return value.result;
  }
  return String(value);
}

function parsePrice(value) {
  if (!value) return 0;
  const stringValue = String(value).replace(/[$,]/g, '');
  const numValue = parseFloat(stringValue);
  return isNaN(numValue) ? 0 : numValue;
}

/**
 * ヘッダー行を解析して列番号マッピングを作成
 */
function buildHeaderIndex(worksheet) {
  const headerIndex = {};
  const row2 = worksheet.getRow(2);
  const row3 = worksheet.getRow(3);
  const row4 = worksheet.getRow(4);
  
  // 各列を処理
  row2.eachCell((cell, colNumber) => {
    const header2 = cell.value ? String(cell.value).trim() : '';
    const header3 = row3.getCell(colNumber).value ? String(row3.getCell(colNumber).value).trim() : '';
    const header4 = row4.getCell(colNumber).value ? String(row4.getCell(colNumber).value).trim() : '';
    
    // 単一ヘッダー（2行目のみ）
    if (header2) {
      headerIndex[header2] = colNumber;
    }
    
    // 階層ヘッダー（2行目 + 3行目）
    if (header2 && header3) {
      const composite = `${header2} > ${header3}`;
      headerIndex[composite] = colNumber;
    }
    
    // 3層ヘッダー（2行目 + 3行目 + 4行目）
    if (header2 && header3 && header4) {
      const composite = `${header2} > ${header3} > ${header4}`;
      headerIndex[composite] = colNumber;
    }
    
    // 3行目のみのヘッダー（結合セルの続き）
    if (!header2 && header3) {
      headerIndex[header3] = colNumber;
      
      // 4行目も追加
      if (header4) {
        headerIndex[`${header3} > ${header4}`] = colNumber;
      }
    }
    
    // 4行目のみのヘッダー
    if (!header2 && !header3 && header4) {
      headerIndex[header4] = colNumber;
    }
  });
  
  return headerIndex;
}

/**
 * 値を安全に取得
 */
function getValueByHeader(row, headerIndex, headerName) {
  const colNumber = headerIndex[headerName];
  if (!colNumber) return '';
  
  const cell = row.getCell(colNumber);
  let value = cell.value;
  
  // 数式の場合は計算結果を取得
  if (cell.formula) {
    value = cell.result;
  }
  
  return parseExcelValue(value);
}

app.http('ImportBuyersListExcel', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      const formData = await request.formData();
      const file = formData.get('file');
      
      if (!file) {
        return { status: 400, body: 'Excel file is required.' };
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.getWorksheet('Buyers list');
      if (!worksheet) {
        return { status: 400, body: 'Sheet "Buyers list" not found in Excel file.' };
      }

      // ヘッダー行を解析
      const headerIndex = buildHeaderIndex(worksheet);
      
      context.log('Header Index built:', Object.keys(headerIndex).length, 'headers found');
      context.log('Available headers:', Object.keys(headerIndex).slice(0, 20));

      const container = buyersListContainer();
      const now = new Date().toISOString();
      const importedItems = [];

      // 5行目以降のデータを読み込み（1-4行目はヘッダー）
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 4) return; // ヘッダー行をスキップ

        // ユニット番号を取得（必須）
        const unitNumber = getValueByHeader(row, headerIndex, 'ユニット\n(Unit #)');
        
        if (!unitNumber || unitNumber === '0') {
          return; // 空行またはテンプレート行をスキップ
        }

        // データを抽出
        const item = {
          id: uuidv4(),
          unitNumber: unitNumber,
          nameRomaji: getValueByHeader(row, headerIndex, '契約者氏名\nローマ字\n (Name)'),
          nameJapanese: getValueByHeader(row, headerIndex, '契約者氏名\n日本語'),
          japanStaff: getValueByHeader(row, headerIndex, '日本担当'),
          hawaiiStaff: getValueByHeader(row, headerIndex, 'ハワイ担当'),
          hhcStaff: getValueByHeader(row, headerIndex, 'HHC担当'),
          escrowNumber: getValueByHeader(row, headerIndex, 'Escrow #'),
          address: getValueByHeader(row, headerIndex, '住所'),
          phone: getValueByHeader(row, headerIndex, '電話'),
          emailPrimary: getValueByHeader(row, headerIndex, '本人'),
          emailCC: getValueByHeader(row, headerIndex, 'CC'),
          emailDocusign: getValueByHeader(row, headerIndex, 'DocuSign'),
          unitType: getValueByHeader(row, headerIndex, 'Unit Type'),
          bedBath: getValueByHeader(row, headerIndex, 'Bed/th'),
          sqft: getValueByHeader(row, headerIndex, 'sqft'),
          contractedDate: getValueByHeader(row, headerIndex, 'Contracted Date\n(HI Time)'),
          purchasePrice: parsePrice(getValueByHeader(row, headerIndex, '$')),
          deposit1Amount: parsePrice(getValueByHeader(row, headerIndex, '価格*5%')),
          deposit1DueDate: getValueByHeader(row, headerIndex, '期日(日本時間)'),
          deposit1Receipt: getValueByHeader(row, headerIndex, 'Receipt'),
          parkingNumber: getValueByHeader(row, headerIndex, 'No.'),
          storageNumber: getValueByHeader(row, headerIndex, 'Storage No.'),
          purpose: getValueByHeader(row, headerIndex, '目的'),
          entityType: getValueByHeader(row, headerIndex, '個人/法人'),
          status: 'Active',
          createdAt: now,
          createdBy: clientPrincipal.userDetails || 'System Import',
          updatedAt: now,
          updatedBy: clientPrincipal.userDetails || 'System Import',
        };

        importedItems.push(item);
      });

      context.log(`Importing ${importedItems.length} items to Cosmos DB`);

      // Cosmos DBに一括インポート
      const results = [];
      for (const item of importedItems) {
        try {
          const { resource } = await container.items.create(item);
          results.push({ success: true, unitNumber: item.unitNumber });
        } catch (error) {
          context.log(`Failed to import unit ${item.unitNumber}:`, error.message);
          results.push({ success: false, unitNumber: item.unitNumber, error: error.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      return {
        status: 200,
        jsonBody: {
          message: `Import completed: ${successCount} succeeded, ${failureCount} failed`,
          results,
        },
      };
    } catch (error) {
      const message = error.message || 'Error importing Excel file.';
      context.log('ImportBuyersListExcel failed', error);
      return { status: 500, body: message };
    }
  },
});
