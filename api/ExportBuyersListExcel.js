const { app } = require('@azure/functions');
const ExcelJS = require('exceljs');
const cosmosClient = require('./cosmosClient');

// Phase 4.1: 69列のヘッダー定義
const COLUMN_HEADERS = [
  // ========== 既存フィールド（29列）==========
  { header: 'No', key: 'number', width: 10 },
  { header: 'Unit #', key: 'unitNumber', width: 15 },
  { header: '契約者氏名（ローマ字）', key: 'nameRomaji', width: 25 },
  { header: '契約者氏名（日本語）', key: 'nameJapanese', width: 25 },
  { header: '日本担当', key: 'japanStaff', width: 15 },
  { header: 'ハワイ担当', key: 'hawaiiStaff', width: 15 },
  { header: 'HHC担当', key: 'hhcStaff', width: 15 },
  { header: 'Escrow #', key: 'escrowNumber', width: 20 },
  { header: '住所', key: 'address', width: 40 },
  { header: '電話', key: 'phone', width: 20 },
  { header: 'Email（本人）', key: 'emailPrimary', width: 30 },
  { header: 'Email（CC）', key: 'emailCC', width: 30 },
  { header: 'Email（DocuSign）', key: 'emailDocusign', width: 30 },
  { header: 'Unit Type', key: 'unitType', width: 15 },
  { header: 'Bed/Bath', key: 'bedBath', width: 15 },
  { header: 'sqft', key: 'sqft', width: 12 },
  { header: 'Contracted Date', key: 'contractedDate', width: 20 },
  { header: '購入価格', key: 'purchasePrice', width: 15 },
  { header: '1st Deposit 金額', key: 'deposit1Amount', width: 15 },
  { header: '1st Deposit 期日', key: 'deposit1DueDate', width: 20 },
  { header: '1st Deposit Receipt', key: 'deposit1Receipt', width: 15 },
  { header: 'Parking No.', key: 'parkingNumber', width: 15 },
  { header: 'Storage No.', key: 'storageNumber', width: 15 },
  { header: '目的', key: 'purpose', width: 20 },
  { header: '個人/法人', key: 'entityType', width: 15 },
  { header: 'ステータス', key: 'status', width: 15 },
  { header: '作成日時', key: 'createdAt', width: 20 },
  { header: '作成者', key: 'createdBy', width: 20 },
  { header: '更新日時', key: 'updatedAt', width: 20 },
  
  // ========== Phase 4.1: 追加フィールド（40列）==========
  
  // 登記・法人情報（5列）
  { header: '登記名義', key: 'registrationName', width: 25 },
  { header: 'SSN/TIN', key: 'ssnTin', width: 20 },
  { header: 'Married/Single', key: 'marriedSingle', width: 15 },
  { header: 'Vesting Title', key: 'vestingTitle', width: 15 },
  { header: '配偶者名', key: 'spouseName', width: 20 },
  
  // デポジット2（3列）
  { header: '2nd Deposit 金額', key: 'deposit2Amount', width: 15 },
  { header: '2nd Deposit 期日', key: 'deposit2DueDate', width: 20 },
  { header: '2nd Deposit Receipt', key: 'deposit2Receipt', width: 15 },
  
  // デポジット3（3列）
  { header: '3rd Deposit 金額', key: 'deposit3Amount', width: 15 },
  { header: '3rd Deposit 期日', key: 'deposit3DueDate', width: 20 },
  { header: '3rd Deposit Receipt', key: 'deposit3Receipt', width: 15 },
  
  // ファイナンス（4列）
  { header: 'Financing Type', key: 'financingType', width: 20 },
  { header: 'Pre-Qualification', key: 'preQualification', width: 15 },
  { header: '残高証明書 契約時', key: 'bankStatementContract', width: 15 },
  { header: 'IRP', key: 'irp', width: 15 },
  
  // アップグレード（13列）
  { header: 'Color Kitchen', key: 'colorKitchen', width: 15 },
  { header: 'Color Bathroom', key: 'colorBathroom', width: 15 },
  { header: 'Motorized Drapes', key: 'motorizedDrapes', width: 15 },
  { header: 'Motorized Drapes 金額', key: 'motorizedDrapesPrice', width: 18 },
  { header: 'EV Charger', key: 'evCharger', width: 15 },
  { header: 'EV Charger 金額', key: 'evChargerPrice', width: 18 },
  { header: 'Toto Toilet', key: 'totoToilet', width: 15 },
  { header: 'Toto Toilet 金額', key: 'totoToiletPrice', width: 18 },
  { header: 'Wood Flooring', key: 'woodFlooring', width: 15 },
  { header: 'Wood Flooring 金額', key: 'woodFlooringPrice', width: 18 },
  { header: 'Upgrade 合計', key: 'upgradeTotal', width: 15 },
  { header: 'Upgrade 手付金20%', key: 'upgradeDeposit20', width: 18 },
  { header: 'Upgrade 残代金80%', key: 'upgradeBalance80', width: 18 },
  
  // 駐車場拡張（2列）
  { header: 'Parking 追加購入', key: 'parkingAdditionalPurchase', width: 18 },
  { header: 'Parking お申込み', key: 'parkingApplication', width: 18 },
  
  // ストレージ拡張（5列）
  { header: 'Storage 金額', key: 'storagePrice', width: 15 },
  { header: 'Storage 手付金20%', key: 'storageDeposit20', width: 18 },
  { header: 'Storage Receipt', key: 'storageReceipt', width: 15 },
  { header: 'Storage 残代金80%', key: 'storageBalance80', width: 18 },
  { header: 'Storage Addendum', key: 'storageAddendum', width: 18 },
  
  // その他（5列）
  { header: '居住エリア', key: 'residenceArea', width: 15 },
  { header: '残金（80%）', key: 'finalBalance', width: 15 },
  { header: '登記日', key: 'registrationDate', width: 20 },
  { header: '登記 個人/法人', key: 'registrationPersonOrEntity', width: 15 },
  { header: '別荘/賃貸', key: 'vacationOrRental', width: 15 }
];

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch (error) {
    return null;
  }
}

app.http('ExportBuyersListExcel', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      // Cosmos DBからデータ取得
      const { database } = await cosmosClient.getDatabase();
      const container = database.container(process.env.COSMOS_BUYERSLIST_CONTAINER || 'BuyersList');

      const { resources: buyers } = await container.items
        .query({
          query: 'SELECT * FROM c WHERE c.status != @status ORDER BY c.unitNumber',
          parameters: [{ name: '@status', value: 'deleted' }]
        })
        .fetchAll();

      // Excelワークブック作成
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Buyers List');

      // 列定義
      worksheet.columns = COLUMN_HEADERS;

      // ヘッダー行のスタイル設定
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, size: 11 };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 25;

      // データ行を追加
      buyers.forEach(buyer => {
        const row = worksheet.addRow(buyer);
        
        // 金額フィールドの書式設定
        const amountFields = [
          'purchasePrice', 
          'deposit1Amount', 'deposit2Amount', 'deposit3Amount',
          'motorizedDrapesPrice', 'evChargerPrice', 'totoToiletPrice', 'woodFlooringPrice',
          'upgradeTotal', 'upgradeDeposit20', 'upgradeBalance80',
          'storagePrice', 'storageDeposit20', 'storageBalance80',
          'finalBalance'
        ];
        
        amountFields.forEach(field => {
          const colIndex = COLUMN_HEADERS.findIndex(col => col.key === field);
          if (colIndex !== -1) {
            const cell = row.getCell(colIndex + 1);
            if (cell.value) {
              cell.numFmt = '$#,##0.00';
            }
          }
        });

        // 日付フィールドの書式設定
        const dateFields = [
          'contractedDate', 
          'deposit1DueDate', 'deposit2DueDate', 'deposit3DueDate',
          'registrationDate',
          'createdAt', 'updatedAt'
        ];
        
        dateFields.forEach(field => {
          const colIndex = COLUMN_HEADERS.findIndex(col => col.key === field);
          if (colIndex !== -1) {
            const cell = row.getCell(colIndex + 1);
            if (cell.value) {
              cell.numFmt = 'yyyy-mm-dd hh:mm';
            }
          }
        });

        // 行の高さ設定
        row.height = 20;
      });

      // 全セルに罫線を追加
      worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
            left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
            bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
            right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
          };
        });
      });

      // Excelバッファを生成
      const buffer = await workbook.xlsx.writeBuffer();

      // ファイル名生成
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `BuyersList_Export_${timestamp}.xlsx`;

      return {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`
        },
        body: buffer
      };

    } catch (error) {
      context.error('Export error:', error);
      return {
        status: 500,
        jsonBody: {
          error: 'Failed to export Excel file',
          details: error.message
        }
      };
    }
  },
});
