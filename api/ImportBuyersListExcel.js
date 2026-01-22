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

// ヘッダーマッピング定義
// キー：Excelのヘッダー名（階層を > で結合）
// 値：データベースのフィールド名
const HEADER_MAPPING = {
  // 基本情報
  '日本担当': 'japanStaff',
  'ハワイ担当': 'hawaiiStaff',
  'HHC担当': 'hhcStaff',
  'ユニット\n(Unit #)': 'unitNumber',
  '契約者氏名\nローマ字\n (Name)': 'nameRomaji',
  '契約者氏名\n日本語': 'nameJapanese',
  'Escrow #': 'escrowNumber',
  '住所': 'address',
  '電話': 'phone',
  
  // メールアドレス（階層構造）
  'Eメール > 本人': 'emailPrimary',
  'CC': 'emailCC',
  'DocuSign': 'emailDocusign',
  'メモ': 'emailMemo',
  
  // 物件情報
  'Unit Type': 'unitType',
  'Bed/th': 'bedBath',
  'sqft': 'sqft',
  
  // 契約情報
  'Contracted Date\n(HI Time)': 'contractedDate',
  '購入価格（ ○：Receipt受取済　△：送金済・Receipt未受領） > $': 'purchasePrice',
  
  // 支払いスケジュール
  '1st Deposit > 価格*5%': 'deposit1Amount',
  '期日(日本時間)': 'deposit1DueDate',
  'Receipt': 'deposit1Receipt',
  '2nd Deposit > 価格*5%': 'deposit2Amount',
  '3rd Deposit > 価格*10%': 'deposit3Amount',
  '残金（価格*80%）': 'balanceAmount',
  
  // 駐車場・ストレージ
  'Parking stall > No.': 'parkingNumber',
  'Storage > お申込み': 'storageApplication',
  'Storage No.': 'storageNumber',
  
  // その他
  '目的': 'purpose',
  '個人/法人': 'entityType',
  '登記日': 'registrationDate',
  '登記名義 (Title )': 'titleName',
};

/**
 * ヘッダー行を解析して列番号マッピングを作成
 */
function buildHeaderIndex(worksheet) {
  const headerIndex = {};
  const row2 = worksheet.getRow(2);
  const row3 = worksheet.getRow(3);
  const row4 = worksheet.getRow(4);
  
  row2.eachCell((cell, colNumber) => {
    const header2 = cell.value ? String(cell.value).trim() : '';
    const header3 = row3.getCell(colNumber).value ? String(row3.getCell(colNumber).value).trim() : '';
    const header4 = row4.getCell(colNumber).value ? String(row4.getCell(colNumber).value).trim() : '';
    
    // 階層的なヘッダー名を構築
    let compositeHeader = '';
    
    if (header2) {
      compositeHeader = header2;
      if (header3) {
        compositeHeader += ' > ' + header3;
        if (header4) {
          compositeHeader += ' > ' + header4;
        }
      }
    } else if (header3) {
      // 2行目が空で3行目にある場合（結合セルの続き）
      compositeHeader = header3;
      if (header4) {
        compositeHeader += ' > ' + header4;
      }
    } else if (header4) {
      compositeHeader = header4;
    }
    
    if (compositeHeader) {
      headerIndex[compositeHeader] = colNumber;
      
      // 3行目のみのヘッダー（Eメール配下の列など）
      if (header3 && !header2) {
        headerIndex[header3] = colNumber;
      }
      // 4行目のみのヘッダー（Deposit配下の列など）
      if (header4 && !header2 && !header3) {
        headerIndex[header4] = colNumber;
      }
    }
  });
  
  return headerIndex;
}

/**
 * ヘッダーマッピングに基づいてデータを抽出
 */
function extractDataFromRow(row, headerIndex) {
  const data = {};
  
  for (const [excelHeader, dbField] of Object.entries(HEADER_MAPPING)) {
    const colNumber = headerIndex[excelHeader];
    if (colNumber) {
      const cell = row.getCell(colNumber);
      let value = cell.value;
      
      // 数式の場合は計算結果を取得
      if (cell.formula) {
        value = cell.result;
      }
      
      data[dbField] = parseExcelValue(value);
    }
  }
  
  return data;
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
      
      context.log('Header Index built:', Object.keys(headerIndex).length, 'columns found');

      const container = buyersListContainer();
      const now = new Date().toISOString();
      const importedItems = [];

      // 5行目以降のデータを読み込み（1-4行目はヘッダー）
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 4) return; // ヘッダー行をスキップ

        // データを抽出
        const data = extractDataFromRow(row, headerIndex);
        
        // ユニット番号が必須
        if (!data.unitNumber || data.unitNumber === '0') {
          return; // 空行またはテンプレート行をスキップ
        }

        // 価格フィールドを数値に変換
        const purchasePrice = parsePrice(data.purchasePrice);

        const item = {
          id: uuidv4(),
          unitNumber: data.unitNumber,
          nameRomaji: data.nameRomaji || '',
          nameJapanese: data.nameJapanese || '',
          japanStaff: data.japanStaff || '',
          hawaiiStaff: data.hawaiiStaff || '',
          hhcStaff: data.hhcStaff || '',
          escrowNumber: data.escrowNumber || '',
          address: data.address || '',
          phone: data.phone || '',
          emailPrimary: data.emailPrimary || '',
          emailCC: data.emailCC || '',
          emailDocusign: data.emailDocusign || '',
          unitType: data.unitType || '',
          bedBath: data.bedBath || '',
          sqft: data.sqft || '',
          contractedDate: data.contractedDate || '',
          purchasePrice: purchasePrice,
          deposit1Amount: parsePrice(data.deposit1Amount),
          deposit1DueDate: data.deposit1DueDate || '',
          deposit1Receipt: data.deposit1Receipt || '',
          deposit2Amount: parsePrice(data.deposit2Amount),
          deposit3Amount: parsePrice(data.deposit3Amount),
          balanceAmount: parsePrice(data.balanceAmount),
          parkingNumber: data.parkingNumber || '',
          storageNumber: data.storageNumber || '',
          purpose: data.purpose || '',
          entityType: data.entityType || '',
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
