// api/pdfDocumentTypes.js
// PDF種別設定ファイル - 新しい種別はここにオブジェクトを追加するだけ

module.exports = [
  {
    id: 'APPOINTMENT_FORM',
    label: 'Appointment Request Form',
    labelJa: 'アポイントメント申請フォーム',
    registrationTarget: 'mahana_prospects',
    extractFields: [
      { key: 'clientName',        label: '氏名',           targetColumn: 'E' },
      { key: 'clientEmail',       label: 'Email',          targetColumn: 'F' },
      { key: 'clientPhone',       label: '電話番号',        targetColumn: 'G' },
      { key: 'country',           label: '国',             targetColumn: 'H' },
      { key: 'state',             label: '都道府県/地域',   targetColumn: 'I' },
      { key: 'buildingPreference',label: '希望物件',        targetColumn: 'J' },
      { key: 'tourType',          label: 'ツアー種別',      targetColumn: 'N' },
      { key: 'appointmentDate',   label: 'アポイント日',    targetColumn: 'O' },
      { key: 'isFirstAppointment',label: '初回フラグ',      targetColumn: 'P' },
      { key: 'howDidYouHear',     label: '情報源',          targetColumn: 'Q' },
      { key: 'brokerName',        label: '担当ブローカー',   targetColumn: 'R' },
      { key: 'brokerEmail',       label: 'ブローカーEmail', targetColumn: 'S' },
      { key: 'brokerPhone',       label: 'ブローカー電話',  targetColumn: 'T' },
      { key: 'salesExecutive',    label: '担当セールス',    targetColumn: 'V' },
    ],
    claudePrompt: `このPDFはWard VillageのAppointment Request Form（アポイントメント申請フォーム）です。
フォームから以下の項目をJSON形式で抽出してください。見つからない場合はnullとしてください。
チェックボックスで選択されている項目のみを抽出してください（✓や✔がついているもの）。

{
  "clientName": "クライアント氏名（Client Name欄の値）",
  "clientEmail": "クライアントメール（Client Email欄の値）",
  "clientPhone": "クライアント電話番号（Client Phone欄の値）",
  "country": "国（Country欄の値）",
  "state": "都道府県・州・地域（State欄の値）",
  "buildingPreference": "チェックされている建物（例: Mahana, TPWV等、複数はカンマ区切り）",
  "tourType": "チェックされているツアー種別（例: Zoom, IBM Onsite等）",
  "appointmentDate": "アポイント日（Date欄の値）",
  "isFirstAppointment": "初回か否か（First appointment欄の値をyes/noで）",
  "howDidYouHear": "どこで知ったか（How did you hear欄の値）",
  "brokerName": "ブローカー名（Broker Name欄の値）",
  "brokerEmail": "ブローカーメール（Broker Email欄の値）",
  "brokerPhone": "ブローカー電話番号（Broker Phone欄の値）",
  "salesExecutive": "担当セールス名（Sales Executive欄の値）"
}

JSONのみ返してください。説明文・コードブロック記号は不要です。`,
  },

  {
    id: 'PREFERENCE_FORM',
    label: 'Residence Preference Form',
    labelJa: '居住希望フォーム',
    registrationTarget: 'mahana_prospects',
    extractFields: [
      { key: 'fullName',          label: '氏名',           targetColumn: 'E' },
      { key: 'preferredBedrooms', label: '希望間取り',      targetColumn: 'K' },
      { key: 'preferredStacks',   label: '希望スタック',    targetColumn: 'L' },
      { key: 'preferredFloorRange',label:'希望フロア帯',    targetColumn: 'M' },
      { key: 'additionalNotes',   label: '備考',           targetColumn: 'W' },
      { key: 'brokerName',        label: '担当ブローカー',  targetColumn: 'R' },
      { key: 'brokerEmail',       label: 'ブローカーEmail', targetColumn: 'S' },
      { key: 'brokerPhone',       label: 'ブローカー電話',  targetColumn: 'T' },
      { key: 'brokerCompany',     label: 'ブローカー会社',  targetColumn: 'U' },
    ],
    claudePrompt: `このPDFはMahana Ward VillageのResidence Preference Form（居住希望フォーム）です。
フォームから以下の項目をJSON形式で抽出してください。見つからない場合はnullとしてください。
数字が記入されているチェックボックス（優先順位番号）を選択済みとして扱ってください。

{
  "fullName": "氏名（Full Name欄の値）",
  "preferredStacks": "選択されたスタック番号（数字が記入されたもの、例: 06, 12, 14 をカンマ区切りで）",
  "preferredFloorRange": "希望フロア帯（Tower 9-28 / Tower 29-39 / Podium 2-7 等、選択されたもの）",
  "preferredBedrooms": "希望間取り（Studio / 1BR / 2BR / 3BR 等、選択されたスタックから判断）",
  "additionalNotes": "備考・コメント（Additional Notes欄の値）",
  "brokerName": "ブローカー名（Broker Name欄の値）",
  "brokerEmail": "ブローカーメール（Broker Email欄の値）",
  "brokerPhone": "ブローカー電話番号（Broker Phone欄の値）",
  "brokerCompany": "ブローカー会社名（Broker Company欄の値）"
}

JSONのみ返してください。説明文・コードブロック記号は不要です。`,
  },

  // 正式販売開始後に追加予定
  // {
  //   id: 'DROA',
  //   label: 'DROA (Purchase Contract)',
  //   labelJa: '売買契約書（DROA）',
  //   registrationTarget: 'mahana_buyers',
  //   extractFields: [...],
  //   claudePrompt: `...`,
  // },
];
