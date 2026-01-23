const { app } = require('@azure/functions');
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

app.http('ExportBuyersListExcel', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      const container = buyersListContainer();
      
      // すべてのアイテムを取得
      const querySpec = {
        query: 'SELECT * FROM c ORDER BY c.unitNumber'
      };
      
      const { resources: items } = await container.items
        .query(querySpec)
        .fetchAll();

      context.log(`Exporting ${items.length} items to Excel`);

      // Excelワークブックを作成
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Buyers List Export');

      // ヘッダー行を定義
      worksheet.columns = [
        { header: 'ユニット番号', key: 'unitNumber', width: 15 },
        { header: '契約者名（ローマ字）', key: 'nameRomaji', width: 25 },
        { header: '契約者名（日本語）', key: 'nameJapanese', width: 25 },
        { header: '日本担当', key: 'japanStaff', width: 15 },
        { header: 'ハワイ担当', key: 'hawaiiStaff', width: 15 },
        { header: 'HHC担当', key: 'hhcStaff', width: 15 },
        { header: 'Escrow番号', key: 'escrowNumber', width: 20 },
        { header: '住所', key: 'address', width: 40 },
        { header: '電話', key: 'phone', width: 15 },
        { header: 'メール（本人）', key: 'emailPrimary', width: 30 },
        { header: 'メール（CC）', key: 'emailCC', width: 30 },
        { header: 'メール（DocuSign）', key: 'emailDocusign', width: 20 },
        { header: 'Unit Type', key: 'unitType', width: 15 },
        { header: 'Bed/Bath', key: 'bedBath', width: 15 },
        { header: '面積（sqft）', key: 'sqft', width: 12 },
        { header: '契約日', key: 'contractedDate', width: 15 },
        { header: '購入価格', key: 'purchasePrice', width: 15 },
        { header: '1st Deposit金額', key: 'deposit1Amount', width: 15 },
        { header: '1st Deposit期日', key: 'deposit1DueDate', width: 15 },
        { header: '1st Deposit Receipt', key: 'deposit1Receipt', width: 15 },
        { header: '駐車場番号', key: 'parkingNumber', width: 15 },
        { header: 'ストレージ番号', key: 'storageNumber', width: 15 },
        { header: '目的', key: 'purpose', width: 20 },
        { header: '個人/法人', key: 'entityType', width: 15 },
        { header: 'ステータス', key: 'status', width: 12 },
        { header: '作成日', key: 'createdAt', width: 20 },
        { header: '作成者', key: 'createdBy', width: 25 },
        { header: '更新日', key: 'updatedAt', width: 20 },
        { header: '更新者', key: 'updatedBy', width: 25 },
      ];

      // ヘッダー行のスタイル
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // データ行を追加
      items.forEach(item => {
        worksheet.addRow({
          unitNumber: item.unitNumber || '',
          nameRomaji: item.nameRomaji || '',
          nameJapanese: item.nameJapanese || '',
          japanStaff: item.japanStaff || '',
          hawaiiStaff: item.hawaiiStaff || '',
          hhcStaff: item.hhcStaff || '',
          escrowNumber: item.escrowNumber || '',
          address: item.address || '',
          phone: item.phone || '',
          emailPrimary: item.emailPrimary || '',
          emailCC: item.emailCC || '',
          emailDocusign: item.emailDocusign || '',
          unitType: item.unitType || '',
          bedBath: item.bedBath || '',
          sqft: item.sqft || '',
          contractedDate: item.contractedDate ? new Date(item.contractedDate).toLocaleDateString('ja-JP') : '',
          purchasePrice: item.purchasePrice || 0,
          deposit1Amount: item.deposit1Amount || 0,
          deposit1DueDate: item.deposit1DueDate ? new Date(item.deposit1DueDate).toLocaleDateString('ja-JP') : '',
          deposit1Receipt: item.deposit1Receipt || '',
          parkingNumber: item.parkingNumber || '',
          storageNumber: item.storageNumber || '',
          purpose: item.purpose || '',
          entityType: item.entityType || '',
          status: item.status || '',
          createdAt: item.createdAt ? new Date(item.createdAt).toLocaleString('ja-JP') : '',
          createdBy: item.createdBy || '',
          updatedAt: item.updatedAt ? new Date(item.updatedAt).toLocaleString('ja-JP') : '',
          updatedBy: item.updatedBy || '',
        });
      });

      // Excelファイルをバッファに書き込み
      const buffer = await workbook.xlsx.writeBuffer();

      // ファイル名（日付付き）
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const filename = `BuyersList_${today}.xlsx`;

      return {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
        body: buffer,
      };
    } catch (error) {
      const message = error.message || 'Error exporting Excel file.';
      context.log('ExportBuyersListExcel failed', error);
      return { status: 500, body: message };
    }
  },
});
