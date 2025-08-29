// app/src/InvoiceView.jsx

import { useState, useEffect } from 'react';
import axios from 'axios';
import { InvoiceDetailModal } from './InvoiceDetailModal'; // 作成したモーダルをインポート

const API_URL = 'http://localhost:7071/api';

export function InvoiceView() {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [newInvoice, setNewInvoice] = useState({ customerId: '', amount: 0 });
  const [selectedInvoice, setSelectedInvoice] = useState(null); // 編集用モーダルのstate

  useEffect(() => {
    axios.get(`${API_URL}/GetInvoices`).then(res => setInvoices(res.data));
    axios.get(`${API_URL}/GetCustomers`).then(res => setCustomers(res.data));
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewInvoice(prev => ({ ...prev, [name]: value }));
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newInvoice.customerId || newInvoice.amount <= 0) {
      alert("顧客を選択し、金額を正しく入力してください。");
      return;
    }
    axios.post(`${API_URL}/CreateInvoice`, newInvoice).then(res => {
      setInvoices([...invoices, res.data]);
      setNewInvoice({ customerId: '', amount: 0 });
    });
  };

  // ▼▼▼ 更新と削除の処理を追加 ▼▼▼
  const handleUpdate = (invoiceToUpdate) => {
    axios.put(`${API_URL}/UpdateInvoice/${invoiceToUpdate.id}`, invoiceToUpdate).then(res => {
      setInvoices(invoices.map(inv => inv.id === invoiceToUpdate.id ? res.data : inv));
      setSelectedInvoice(null); // モーダルを閉じる
    });
  };

  const handleDelete = (idToDelete) => {
    // 削除前に確認ダイアログを表示
    if (window.confirm("この請求書を本当に削除しますか？")) {
      axios.delete(`${API_URL}/DeleteInvoice/${idToDelete}`).then(() => {
        setInvoices(invoices.filter(inv => inv.id !== idToDelete));
      });
    }
  };

  return (
    <div>
      <h2>請求書管理</h2>
      <form onSubmit={handleCreate} className="task-form">
        <select name="customerId" value={newInvoice.customerId} onChange={handleInputChange} required>
          <option value="">顧客を選択</option>
          {customers.map(customer => (
            <option key={customer.id} value={customer.id}>{customer.name}</option>
          ))}
        </select>
        <input
          type="number"
          name="amount"
          value={newInvoice.amount}
          onChange={handleInputChange}
          placeholder="金額"
          required
        />
        <button type="submit">請求書作成</button>
      </form>

      <div className="task-list">
        <ul>
          {invoices.map(invoice => (
            <li key={invoice.id}>
              {/* 請求書をクリックで詳細編集モーダルを開く */}
              <span className="task-title" onClick={() => setSelectedInvoice(invoice)}>
                <strong>顧客: {customers.find(c => c.id === invoice.customerId)?.name || '不明'}</strong>
                - 金額: {invoice.amount.toLocaleString()}円 - ステータス: {invoice.status}
              </span>
              <div className="task-buttons">
                <button onClick={() => handleDelete(invoice.id)} className="delete-button">削除</button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* 選択された請求書があればモーダルを表示 */}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          customers={customers}
          onSave={handleUpdate}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  );
}