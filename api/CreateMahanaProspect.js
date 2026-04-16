const { app } = require('@azure/functions');
const { appendSheetValues, getSheetValues } = require('./sheetsClient');

const SHEET_NAME = 'Mahana Prospects';
const HEADER_ROW_COUNT = 1;

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

// POST /api/CreateMahanaProspect
// Body: {
//   source: string,        // "Appointment Form" | "Preference Form" | "手動"
//   clientName, clientEmail, clientPhone, country, state,
//   buildingPreference, preferredBedrooms, preferredStacks, preferredFloorRange,
//   tourType, appointmentDate, isFirstAppointment, howDidYouHear,
//   brokerName, brokerEmail, brokerPhone, brokerCompany, salesExecutive, notes
// }
app.http('CreateMahanaProspect', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) return { status: 401, body: 'Unauthorized' };

    try {
      const body = await request.json();

      // 既存データ行数から No. を自動採番
      const existing = await getSheetValues(`'${SHEET_NAME}'`);
      const dataRowCount = Math.max(0, (existing?.length ?? 0) - HEADER_ROW_COUNT);
      const no = dataRowCount + 1;

      const today = new Date().toLocaleDateString('ja-JP', {
        year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tokyo',
      });

      // 列順: A〜W（23列）
      // A: No. / B: 登録日 / C: ソース / D: ステータス / E: 氏名 / F: Email
      // G: 電話 / H: 国 / I: 地域 / J: 希望物件 / K: 希望間取り / L: 希望スタック
      // M: 希望フロア帯 / N: ツアー種別 / O: アポイント日 / P: 初回フラグ
      // Q: 情報源 / R: 担当ブローカー / S: ブローカーEmail / T: ブローカー電話
      // U: ブローカー会社 / V: 担当セールス / W: 備考
      const row = [
        no,
        today,
        body.source ?? '',
        body.status ?? 'Lead',
        body.clientName ?? body.fullName ?? '',
        body.clientEmail ?? '',
        body.clientPhone ?? '',
        body.country ?? '',
        body.state ?? '',
        body.buildingPreference ?? '',
        body.preferredBedrooms ?? '',
        body.preferredStacks ?? '',
        body.preferredFloorRange ?? '',
        body.tourType ?? '',
        body.appointmentDate ?? '',
        body.isFirstAppointment ?? '',
        body.howDidYouHear ?? '',
        body.brokerName ?? '',
        body.brokerEmail ?? '',
        body.brokerPhone ?? '',
        body.brokerCompany ?? '',
        body.salesExecutive ?? '',
        body.notes ?? body.additionalNotes ?? '',
      ];

      await appendSheetValues(`'${SHEET_NAME}'`, [row]);

      context.log(`CreateMahanaProspect: No.${no} created by ${clientPrincipal.userDetails}`);
      return { status: 201, jsonBody: { no, message: 'Prospect created successfully.' } };
    } catch (error) {
      context.log('CreateMahanaProspect failed', error);
      return { status: 500, body: `Error: ${error.message}` };
    }
  },
});
