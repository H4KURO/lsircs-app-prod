// app/src/CustomerDetailModal.jsx

import { useState } from 'react';

export function CustomerDetailModal({ customer, onSave, onClose }) {
  const [editableCustomer, setEditableCustomer] = useState(customer);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditableCustomer({ ...editableCustomer, [name]: value });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>顧客詳細の編集</h2>

        <label>顧客名:</label>
        <input
          type="text"
          name="name"
          value={editableCustomer.name || ''}
          onChange={handleChange}
        />

        <label>所有物件:</label>
        <input
          type="text"
          name="property"
          value={editableCustomer.property || ''}
          onChange={handleChange}
        />

        <label>購入価格:</label>
        <input
          type="number"
          name="price"
          value={editableCustomer.price || 0}
          onChange={handleChange}
        />

        <label>担当者:</label>
        <input
          type="text"
          name="担当者"
          value={editableCustomer.担当者 || ''}
          onChange={handleChange}
        />

        <div className="modal-buttons">
          <button onClick={() => onSave(editableCustomer)}>保存</button>
          <button onClick={onClose}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}