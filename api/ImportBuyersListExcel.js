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

      // ヘッダー行をスキップして3行目から読み込み（1行目：タイトル、2行目：ヘッダー）
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 2) return; // ヘッダー行をスキップ

        const unitNumber = parseExcelValue(row.getCell(5).value); // E列：ユニット番号
        if (!unitNumber || unitNumber === '0') return; // 空行またはテンプレート行をスキップ

        const item = {
          id: uuidv4(),
          unitNumber: unitNumber,
          japanStaff: parseExcelValue(row.getCell(2).value),      // B列：日本担当
          hawaiiStaff: parseExcelValue(row.getCell(3).value),     // C列：ハワイ担当
          nameRomaji: parseExcelValue(row.getCell(6).value),      // F列：契約者氏名（ローマ字）
          nameJapanese: parseExcelValue(row.getCell(7).value),    // G列：契約者氏名（日本語）
          phone: parseExcelValue(row.getCell(9).value),           // I列：電話
          email: parseExcelValue(row.getCell(10).value),          // J列：メールアドレス
          contractedDate: parseExcelValue(row.getCell(23).value), // W列：契約日
          purchasePrice: parsePrice(row.getCell(24).value),       // X列：購入価格
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
