const { app } = require('@azure/functions');
const ExcelJS = require('exceljs');
const { getNamedContainer } = require('./cosmosClient');

const propertiesContainer = () =>
  getNamedContainer('Properties', ['COSMOS_PROPERTIES_CONTAINER']);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try { return JSON.parse(Buffer.from(header, 'base64').toString('ascii')); } catch { return null; }
}

app.http('ExportPropertiesExcel', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) return { status: 401, body: 'Unauthorized' };
    try {
      const container = propertiesContainer();
      const { resources } = await container.items
        .query('SELECT * FROM c ORDER BY c.propertyName')
        .fetchAll();

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Properties');

      const cols = [
        { header: '建物名', key: 'buildingName', width: 30 },
        { header: '物件名', key: 'propertyName', width: 35 },
        { header: '管理形態', key: 'managementType', width: 12 },
        { header: '登記日', key: 'registrationDate', width: 14 },
        { header: '購入価格', key: 'purchasePrice', width: 14 },
        { header: 'オーナー名', key: 'ownerName', width: 35 },
        { header: 'オーナー電話', key: 'ownerPhone', width: 20 },
        { header: 'テナント状況', key: 'tenantStatus', width: 14 },
        { header: '賃貸開始日', key: 'leaseStart', width: 14 },
        { header: '賃貸終了日', key: 'leaseEnd', width: 14 },
        { header: '月額賃料', key: 'monthlyRent', width: 14 },
        { header: 'メモ', key: 'notes', width: 30 },
        { header: 'Appfolio物件文字列', key: 'appfolioPropertyString', width: 50 },
        { header: 'インポート日時', key: 'importedAt', width: 20 },
        { header: 'インポート元', key: 'importSource', width: 12 },
      ];
      ws.columns = cols;

      // Header style
      ws.getRow(1).eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF001731' } };
        cell.alignment = { vertical: 'middle' };
      });
      ws.getRow(1).height = 20;

      for (const p of resources) {
        ws.addRow({
          buildingName: p.buildingName || '',
          propertyName: p.propertyName || '',
          managementType: p.managementType || '',
          registrationDate: p.registrationDate || '',
          purchasePrice: p.purchasePrice || '',
          ownerName: p.ownerName || '',
          ownerPhone: p.ownerPhone || '',
          tenantStatus: p.tenantStatus || '',
          leaseStart: p.leaseStart || '',
          leaseEnd: p.leaseEnd || '',
          monthlyRent: p.monthlyRent || '',
          notes: p.notes || '',
          appfolioPropertyString: p.appfolioPropertyString || '',
          importedAt: p.importedAt ? p.importedAt.replace('T', ' ').slice(0, 19) : '',
          importSource: p.importSource || '',
        });
      }

      // Numeric formats
      ws.getColumn('monthlyRent').numFmt = '#,##0';
      ws.getColumn('purchasePrice').numFmt = '#,##0';

      const buf = await wb.xlsx.writeBuffer();
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      return {
        status: 200,
        body: buf,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="properties_${date}.xlsx"`,
        },
      };
    } catch (error) {
      context.log('ExportPropertiesExcel failed', error);
      return { status: 500, body: `Error: ${error.message}` };
    }
  },
});
