const { app } = require('@azure/functions');
const { ensureNamedContainer } = require('./cosmosClient');

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch (error) {
    return null;
  }
}

app.http('UpdateBuyersList', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      const body = await request.json();
      const { id } = body;

      if (!id) {
        return {
          status: 400,
          jsonBody: { error: 'Buyer ID is required' }
        };
      }

      const container = await ensureNamedContainer('BuyersList', { partitionKey: '/id' });

      // 既存データを取得
      const { resource: existingBuyer } = await container.item(id, id).read();

      if (!existingBuyer) {
        return {
          status: 404,
          jsonBody: { error: 'Buyer not found' }
        };
      }

      // Phase 4.1: すべてのフィールドを更新対象に
      const updatedBuyer = {
        ...existingBuyer,
        
        // 既存フィールド
        unitNumber: body.unitNumber || existingBuyer.unitNumber,
        nameRomaji: body.nameRomaji ?? existingBuyer.nameRomaji,
        nameJapanese: body.nameJapanese ?? existingBuyer.nameJapanese,
        japanStaff: body.japanStaff ?? existingBuyer.japanStaff,
        hawaiiStaff: body.hawaiiStaff ?? existingBuyer.hawaiiStaff,
        hhcStaff: body.hhcStaff ?? existingBuyer.hhcStaff,
        escrowNumber: body.escrowNumber ?? existingBuyer.escrowNumber,
        address: body.address ?? existingBuyer.address,
        phone: body.phone ?? existingBuyer.phone,
        emailPrimary: body.emailPrimary ?? existingBuyer.emailPrimary,
        emailCC: body.emailCC ?? existingBuyer.emailCC,
        emailDocusign: body.emailDocusign ?? existingBuyer.emailDocusign,
        unitType: body.unitType ?? existingBuyer.unitType,
        bedBath: body.bedBath ?? existingBuyer.bedBath,
        sqft: body.sqft ?? existingBuyer.sqft,
        contractedDate: body.contractedDate ?? existingBuyer.contractedDate,
        purchasePrice: body.purchasePrice ?? existingBuyer.purchasePrice,
        deposit1Amount: body.deposit1Amount ?? existingBuyer.deposit1Amount,
        deposit1DueDate: body.deposit1DueDate ?? existingBuyer.deposit1DueDate,
        deposit1Receipt: body.deposit1Receipt ?? existingBuyer.deposit1Receipt,
        parkingNumber: body.parkingNumber ?? existingBuyer.parkingNumber,
        storageNumber: body.storageNumber ?? existingBuyer.storageNumber,
        purpose: body.purpose ?? existingBuyer.purpose,
        entityType: body.entityType ?? existingBuyer.entityType,
        status: body.status ?? existingBuyer.status,
        
        // ========== Phase 4.1: 新規フィールド ==========
        
        // 登記・法人情報
        registrationName: body.registrationName ?? existingBuyer.registrationName ?? '',
        ssnTin: body.ssnTin ?? existingBuyer.ssnTin ?? '',
        marriedSingle: body.marriedSingle ?? existingBuyer.marriedSingle ?? '',
        vestingTitle: body.vestingTitle ?? existingBuyer.vestingTitle ?? '',
        spouseName: body.spouseName ?? existingBuyer.spouseName ?? '',
        
        // デポジット2
        deposit2Amount: body.deposit2Amount ?? existingBuyer.deposit2Amount ?? '',
        deposit2DueDate: body.deposit2DueDate ?? existingBuyer.deposit2DueDate ?? '',
        deposit2Receipt: body.deposit2Receipt ?? existingBuyer.deposit2Receipt ?? '',
        
        // デポジット3
        deposit3Amount: body.deposit3Amount ?? existingBuyer.deposit3Amount ?? '',
        deposit3DueDate: body.deposit3DueDate ?? existingBuyer.deposit3DueDate ?? '',
        deposit3Receipt: body.deposit3Receipt ?? existingBuyer.deposit3Receipt ?? '',
        
        // ファイナンス
        financingType: body.financingType ?? existingBuyer.financingType ?? '',
        preQualification: body.preQualification ?? existingBuyer.preQualification ?? '',
        bankStatementContract: body.bankStatementContract ?? existingBuyer.bankStatementContract ?? '',
        irp: body.irp ?? existingBuyer.irp ?? '',
        
        // アップグレード
        colorKitchen: body.colorKitchen ?? existingBuyer.colorKitchen ?? '',
        colorBathroom: body.colorBathroom ?? existingBuyer.colorBathroom ?? '',
        motorizedDrapes: body.motorizedDrapes ?? existingBuyer.motorizedDrapes ?? '',
        motorizedDrapesPrice: body.motorizedDrapesPrice ?? existingBuyer.motorizedDrapesPrice ?? '',
        evCharger: body.evCharger ?? existingBuyer.evCharger ?? '',
        evChargerPrice: body.evChargerPrice ?? existingBuyer.evChargerPrice ?? '',
        totoToilet: body.totoToilet ?? existingBuyer.totoToilet ?? '',
        totoToiletPrice: body.totoToiletPrice ?? existingBuyer.totoToiletPrice ?? '',
        woodFlooring: body.woodFlooring ?? existingBuyer.woodFlooring ?? '',
        woodFlooringPrice: body.woodFlooringPrice ?? existingBuyer.woodFlooringPrice ?? '',
        upgradeTotal: body.upgradeTotal ?? existingBuyer.upgradeTotal ?? '',
        upgradeDeposit20: body.upgradeDeposit20 ?? existingBuyer.upgradeDeposit20 ?? '',
        upgradeBalance80: body.upgradeBalance80 ?? existingBuyer.upgradeBalance80 ?? '',
        
        // 駐車場拡張
        parkingAdditionalPurchase: body.parkingAdditionalPurchase ?? existingBuyer.parkingAdditionalPurchase ?? '',
        parkingApplication: body.parkingApplication ?? existingBuyer.parkingApplication ?? '',
        
        // ストレージ拡張
        storagePrice: body.storagePrice ?? existingBuyer.storagePrice ?? '',
        storageDeposit20: body.storageDeposit20 ?? existingBuyer.storageDeposit20 ?? '',
        storageReceipt: body.storageReceipt ?? existingBuyer.storageReceipt ?? '',
        storageBalance80: body.storageBalance80 ?? existingBuyer.storageBalance80 ?? '',
        storageAddendum: body.storageAddendum ?? existingBuyer.storageAddendum ?? '',
        
        // その他
        residenceArea: body.residenceArea ?? existingBuyer.residenceArea ?? '',
        finalBalance: body.finalBalance ?? existingBuyer.finalBalance ?? '',
        registrationDate: body.registrationDate ?? existingBuyer.registrationDate ?? '',
        registrationPersonOrEntity: body.registrationPersonOrEntity ?? existingBuyer.registrationPersonOrEntity ?? '',
        vacationOrRental: body.vacationOrRental ?? existingBuyer.vacationOrRental ?? '',
        
        // システムフィールド
        updatedBy: clientPrincipal.userDetails,
        updatedAt: new Date().toISOString()
      };

      // Cosmos DBを更新
      const { resource: result } = await container.item(id, id).replace(updatedBuyer);

      return {
        status: 200,
        jsonBody: result
      };

    } catch (error) {
      context.error('Update error:', error);
      return {
        status: 500,
        jsonBody: {
          error: 'Failed to update buyer',
          details: error.message
        }
      };
    }
  },
});
