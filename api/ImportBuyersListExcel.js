const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
const ExcelJS = require('exceljs');
const cosmosClient = require('./cosmosClient');

// Excel列名のバリエーションをすべて処理する関数
function normalizeHeaderName(headerName) {
  if (!headerName) return '';
  return String(headerName)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\n/g, ' ')
    .toLowerCase();
}

// Excel列名 → データベースフィールド名のマッピング
function buildHeaderMapping(headerRow) {
  const mapping = {};
  
  // 基本的なマッピング定義（正規化された名前で）
  const fieldMappings = {
    // 既存フィールド
    '№': 'number',
    'no': 'number',
    '日本担当': 'japanStaff',
    'ハワイ担当': 'hawaiiStaff',
    'hhc担当': 'hhcStaff',
    'ユニット (unit #)': 'unitNumber',
    'unit #': 'unitNumber',
    '契約者氏名 ローマ字 (name)': 'nameRomaji',
    'name': 'nameRomaji',
    '契約者氏名 日本語': 'nameJapanese',
    'escrow #': 'escrowNumber',
    '住所': 'address',
    '電話': 'phone',
    'eメール': 'emailPrimary',
    '本人': 'emailPrimary',
    'cc': 'emailCC',
    'docusign': 'emailDocusign',
    'unit type': 'unitType',
    'bed/th': 'bedBath',
    'sqft': 'sqft',
    'contracted date (hi time)': 'contractedDate',
    '$': 'purchasePrice',
    '価格*5%': 'deposit1Amount',
    '期日(日本時間)': 'deposit1DueDate',
    'receipt': 'deposit1Receipt',
    'no.': 'parkingNumber',
    'storage no.': 'storageNumber',
    '目的': 'purpose',
    '個人/法人': 'entityType',
    
    // ========== Phase 4.1: 追加フィールド ==========
    
    // 登記・法人情報
    '登記名義 (title )': 'registrationName',
    'title': 'registrationName',
    'ssn/tin': 'ssnTin',
    '居住エリア': 'residenceArea',
    'married / single': 'marriedSingle',
    'vesting of title include spouse?': 'vestingTitle',
    '配偶者名': 'spouseName',
    
    // ファイナンス
    'financing type': 'financingType',
    'pre- quorification': 'preQualification',
    'pre-qualification': 'preQualification',
    '残高証明書 契約時': 'bankStatementContract',
    'irp': 'irp',
    
    // アップグレード - Color
    'color kitchen': 'colorKitchen',
    'kitchen': 'colorKitchen',
    'color bathroom': 'colorBathroom',
    'bathroom': 'colorBathroom',
    
    // 残金
    '残金（価格*80%）': 'finalBalance',
    '残金': 'finalBalance',
    
    // 登記
    '登記日': 'registrationDate',
    '個人／法人': 'registrationPersonOrEntity',
    '別荘／賃貸': 'vacationOrRental'
  };
  
  // ヘッダー行から実際のマッピングを構築
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const headerText = normalizeHeaderName(cell.value);
    
    // 直接マッチング
    if (fieldMappings[headerText]) {
      mapping[colNumber] = fieldMappings[headerText];
      return;
    }
    
    // 部分マッチング（複雑なヘッダー名用）
    for (const [key, field] of Object.entries(fieldMappings)) {
      if (headerText.includes(key) || key.includes(headerText)) {
        mapping[colNumber] = field;
        break;
      }
    }
  });
  
  return mapping;
}

// セルの値を取得・変換
function getCellValue(cell) {
  if (!cell || cell.value === null || cell.value === undefined) {
    return '';
  }
  
  // 日付型
  if (cell.value instanceof Date) {
    return cell.value.toISOString();
  }
  
  // 数値型
  if (typeof cell.value === 'number') {
    return cell.value;
  }
  
  // オブジェクト型（リッチテキストなど）
  if (typeof cell.value === 'object') {
    if (cell.value.richText) {
      return cell.value.richText.map(t => t.text).join('');
    }
    if (cell.value.text) {
      return cell.value.text;
    }
    return JSON.stringify(cell.value);
  }
  
  // 文字列型
  return String(cell.value).trim();
}

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch (error) {
    return null;
  }
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
        return {
          status: 400,
          jsonBody: { error: 'No file uploaded' }
        };
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        return {
          status: 400,
          jsonBody: { error: 'No worksheet found in Excel file' }
        };
      }

      // ヘッダー行を探す（2-5行目を確認）
      let headerRow = null;
      let headerRowIndex = 0;
      
      for (let i = 2; i <= 5; i++) {
        const row = worksheet.getRow(i);
        const firstCell = getCellValue(row.getCell(1));
        
        if (firstCell.includes('№') || firstCell.includes('No')) {
          headerRow = row;
          headerRowIndex = i;
          break;
        }
      }

      if (!headerRow) {
        return {
          status: 400,
          jsonBody: { error: 'Could not find header row in Excel file' }
        };
      }

      context.log('Header row found at:', headerRowIndex);

      // ヘッダーマッピングを構築
      const columnMapping = buildHeaderMapping(headerRow);
      context.log('Column mapping:', columnMapping);

      // データ行を読み込み
      const buyers = [];
      const dataStartRow = headerRowIndex + 1;

      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber <= headerRowIndex) return;

        // 空行をスキップ
        const firstCell = getCellValue(row.getCell(1));
        if (!firstCell || firstCell === '') return;

        // Phase 4.1: すべてのフィールドを初期化
        const buyer = {
          // 既存フィールド
          number: '',
          unitNumber: '',
          nameRomaji: '',
          nameJapanese: '',
          japanStaff: '',
          hawaiiStaff: '',
          hhcStaff: '',
          escrowNumber: '',
          address: '',
          phone: '',
          emailPrimary: '',
          emailCC: '',
          emailDocusign: '',
          unitType: '',
          bedBath: '',
          sqft: '',
          contractedDate: '',
          purchasePrice: '',
          deposit1Amount: '',
          deposit1DueDate: '',
          deposit1Receipt: '',
          parkingNumber: '',
          storageNumber: '',
          purpose: '',
          entityType: '',
          
          // Phase 4.1: 新規フィールド
          registrationName: '',
          ssnTin: '',
          marriedSingle: '',
          vestingTitle: '',
          spouseName: '',
          deposit2Amount: '',
          deposit2DueDate: '',
          deposit2Receipt: '',
          deposit3Amount: '',
          deposit3DueDate: '',
          deposit3Receipt: '',
          financingType: '',
          preQualification: '',
          bankStatementContract: '',
          irp: '',
          colorKitchen: '',
          colorBathroom: '',
          motorizedDrapes: '',
          motorizedDrapesPrice: '',
          evCharger: '',
          evChargerPrice: '',
          totoToilet: '',
          totoToiletPrice: '',
          woodFlooring: '',
          woodFlooringPrice: '',
          upgradeTotal: '',
          upgradeDeposit20: '',
          upgradeBalance80: '',
          parkingAdditionalPurchase: '',
          parkingApplication: '',
          storagePrice: '',
          storageDeposit20: '',
          storageReceipt: '',
          storageBalance80: '',
          storageAddendum: '',
          residenceArea: '',
          finalBalance: '',
          registrationDate: '',
          registrationPersonOrEntity: '',
          vacationOrRental: '',
          
          // システムフィールド
          status: 'active',
          createdBy: clientPrincipal.userDetails,
          createdAt: new Date().toISOString(),
          updatedBy: clientPrincipal.userDetails,
          updatedAt: new Date().toISOString()
        };

        // マッピングに基づいてデータを抽出
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const fieldName = columnMapping[colNumber];
          if (fieldName && buyer.hasOwnProperty(fieldName)) {
            buyer[fieldName] = getCellValue(cell);
          }
        });

        buyers.push(buyer);
      });

      context.log(`Processed ${buyers.length} buyers`);

      if (buyers.length === 0) {
        return {
          status: 400,
          jsonBody: { error: 'No data found in Excel file' }
        };
      }

      // Cosmos DBに保存
      const { database } = await cosmosClient.getDatabase();
      const container = database.container(process.env.COSMOS_BUYERSLIST_CONTAINER || 'BuyersList');

      let importedCount = 0;
      let updatedCount = 0;
      let errors = [];

      for (const buyer of buyers) {
        try {
          // unitNumberをIDとして使用
          if (!buyer.unitNumber) {
            errors.push(`Row skipped: No unit number`);
            continue;
          }

          buyer.id = `buyer_${buyer.unitNumber}`;

          // 既存レコードを確認
          try {
            const { resource: existing } = await container.item(buyer.id, buyer.id).read();
            
            if (existing) {
              // 既存レコードを更新
              buyer.createdAt = existing.createdAt;
              buyer.createdBy = existing.createdBy;
              buyer.updatedAt = new Date().toISOString();
              buyer.updatedBy = clientPrincipal.userDetails;
              
              await container.item(buyer.id, buyer.id).replace(buyer);
              updatedCount++;
            }
          } catch (readError) {
            // レコードが存在しない場合は新規作成
            await container.items.create(buyer);
            importedCount++;
          }

        } catch (error) {
          context.error('Error saving buyer:', error);
          errors.push(`Unit ${buyer.unitNumber}: ${error.message}`);
        }
      }

      return {
        status: 200,
        jsonBody: {
          message: 'Import completed',
          imported: importedCount,
          updated: updatedCount,
          total: buyers.length,
          errors: errors.length > 0 ? errors : undefined
        }
      };

    } catch (error) {
      context.error('Import error:', error);
      return {
        status: 500,
        jsonBody: {
          error: 'Failed to import Excel file',
          details: error.message
        }
      };
    }
  },
});
