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
  return String(value);
}

function parsePrice(value) {
  if (!value) return 0;
  const stringValue = String(value).replace(/[$,]/g, '');
  const numValue = parseFloat(stringValue);
  return isNaN(numValue) ? 0 : numValue;
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

      const container = buyersListContainer();
      const now = new Date().toISOString();
      const importedItems = [];

      // ヘッダー・説明行をスキップして5行目から読み込み
      // 1行目：タイトル、2-4行目：列の説明、5行目以降：実データ
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 4) return; // 1-4行目をスキップ

        // 正確な列構造
        // A列(1)：日本担当
        // B列(2)：ハワイ担当  
        // C列(3)：H+H担当
        // D列(4)：ユニット番号
        // E列(5)：契約者名（ローマ字）
        // J列(10)：電話
        // K列(11)：メールアドレス
        // AD列(30)：契約日
        // AE列(31)：購入価格
        
        const unitNumber = parseExcelValue(row.getCell(4).value); // D列：ユニット番号
        if (!unitNumber || unitNumber === '0') return; // 空行またはテンプレート行をスキップ

        const item = {
          id: uuidv4(),
          unitNumber: unitNumber,                                  // D列(4)：ユニット番号
          nameRomaji: parseExcelValue(row.getCell(5).value),      // E列(5)：契約者氏名
          japanStaff: parseExcelValue(row.getCell(1).value),      // A列(1)：日本担当
          hawaiiStaff: parseExcelValue(row.getCell(2).value),     // B列(2)：ハワイ担当
          phone: parseExcelValue(row.getCell(10).value),          // J列(10)：電話
          email: parseExcelValue(row.getCell(11).value),          // K列(11)：メールアドレス
          contractedDate: parseExcelValue(row.getCell(30).value), // AD列(30)：契約日
          purchasePrice: parsePrice(row.getCell(31).value),       // AE列(31)：購入価格
          status: 'Active',
          createdAt: now,
          createdBy: clientPrincipal.userDetails || 'System Import',
          updatedAt: now,
          updatedBy: clientPrincipal.userDetails || 'System Import',
        };

        importedItems.push(item);
      });

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
