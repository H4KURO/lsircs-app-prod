// Buyers List データモデル

const BuyersListItemSchema = {
  id: 'string',              // UUID
  unitNumber: 'string',      // ユニット番号（例: "908", "913"）
  nameRomaji: 'string',      // 契約者氏名（ローマ字）
  nameJapanese: 'string',    // 契約者氏名（日本語）
  japanStaff: 'string',      // 日本担当者
  hawaiiStaff: 'string',     // ハワイ担当者
  phone: 'string',           // 電話番号
  email: 'string',           // メールアドレス
  contractedDate: 'string',  // 契約日（ISO形式）
  purchasePrice: 'number',   // 購入価格
  status: 'string',          // ステータス（Active, Completed, Cancelled等）
  
  // メタデータ
  createdAt: 'string',       // 作成日時
  createdBy: 'string',       // 作成者
  updatedAt: 'string',       // 更新日時
  updatedBy: 'string',       // 更新者
  
  // 将来追加予定のフィールド（Phase 2）
  // escrowNumber: 'string',
  // address: 'string',
  // bedBath: 'string',
  // sqft: 'number',
  // deposits: 'object',
  // options: 'object',
  // parking: 'object',
  // storage: 'object',
};

// ステータスの定義
const BuyersListStatus = {
  ACTIVE: 'Active',           // 進行中
  COMPLETED: 'Completed',     // 完了
  CANCELLED: 'Cancelled',     // キャンセル
  PENDING: 'Pending',         // 保留中
};

module.exports = {
  BuyersListItemSchema,
  BuyersListStatus,
};
