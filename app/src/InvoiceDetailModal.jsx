// app/src/InvoiceDetailModal.jsx

import { useState } from 'react';

export function InvoiceDetailModal({ invoice, customers, onSave, onClose }) {
  const [editableInvoice, setEditableInvoice] = useState(invoice);

  const customerName = customers.find(c => c.id === invoice.customerId)?.name || '不明な顧客';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditableInvoice({ ...editableInvoice, [name]: value });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>請求書詳細の編集</h2>

        <p><strong>顧客:</strong> {customerName}</p>

        <label>金額:</label>
        <input
          type="number"
          name="amount"
          value={editableInvoice.amount || 0}
          onChange={handleChange}
        />

        <label>ステータス:</label>
        <select name="status" value={editableInvoice.status} onChange={handleChange}>
          <option value="draft">下書き (Draft)</option>
          <option value="sent">送付済み (Sent)</option>
          <option value="paid">支払い済み (Paid)</option>
        </select>

        <div className="modal-buttons">
          <button onClick={() => onSave(editableInvoice)}>保存</button>
          <button onClick={onClose}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}