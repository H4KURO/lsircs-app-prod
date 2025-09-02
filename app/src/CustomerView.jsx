// app/src/CustomerView.jsx

import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { CustomerDetailModal } from './CustomerDetailModal'; // 作成したモーダルをインポート

const API_URL = '/api';

export function CustomerView() {
  const [customers, setCustomers] = useState([]);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [filter, setFilter] = useState({ name: '', 담당자: '' });

  useEffect(() => {
    axios.get(`${API_URL}/GetCustomers`).then(res => setCustomers(res.data));
  }, []);

  const processedCustomers = useMemo(() => {
    let filtered = [...customers];
    if (filter.name) {
      filtered = filtered.filter(c => c.name && c.name.toLowerCase().includes(filter.name.toLowerCase()));
    }
    if (filter.担当者) {
      filtered = filtered.filter(c => c.担当者 && c.担当者.toLowerCase().includes(filter.担当者.toLowerCase()));
    }
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        if (!a[sortConfig.key]) return 1;
        if (!b[sortConfig.key]) return -1;
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [customers, sortConfig, filter]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilter(prev => ({ ...prev, [name]: value }));
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;
    axios.post(`${API_URL}/CreateCustomer`, { name: newCustomerName }).then(res => {
      setCustomers([...customers, res.data]);
      setNewCustomerName('');
    });
  };

  const handleDelete = (idToDelete) => {
    axios.delete(`${API_URL}/DeleteCustomer/${idToDelete}`).then(() => {
      setCustomers(customers.filter(c => c.id !== idToDelete));
    });
  };

  const handleUpdate = (customerToUpdate) => {
    axios.put(`${API_URL}/UpdateCustomer/${customerToUpdate.id}`, customerToUpdate).then(res => {
      setCustomers(customers.map(c => c.id === customerToUpdate.id ? res.data : c));
      setSelectedCustomer(null);
    });
  };

  return (
    <div>
      <h2>顧客管理</h2>
      <form onSubmit={handleCreate} className="task-form">
        <input
          type="text"
          value={newCustomerName}
          onChange={e => setNewCustomerName(e.target.value)}
          placeholder="新しい顧客名を入力..."
        />
        <button type="submit">追加</button>
      </form>
      
      <div className="filter-sort-controls">
        <div className="filter-inputs">
          <input
            type="text"
            name="name"
            placeholder="顧客名で絞り込み..."
            value={filter.name}
            onChange={handleFilterChange}
          />
          <input
            type="text"
            name="担当者"
            placeholder="担当者で絞り込み..."
            value={filter.担当者}
            onChange={handleFilterChange}
          />
        </div>
        <div className="sort-buttons">
          <button onClick={() => requestSort('name')}>顧客名でソート</button>
          <button onClick={() => requestSort('price')}>価格でソート</button>
        </div>
      </div>

      <div className="task-list">
        <ul>
          {processedCustomers.map(customer => (
            <li key={customer.id}>
              <span className="task-title" onClick={() => setSelectedCustomer(customer)}>
                <strong>{customer.name}</strong>
                {customer.担当者 && ` (担当: ${customer.担当者})`}
              </span>
              <div className="task-buttons">
                <button onClick={() => handleDelete(customer.id)} className="delete-button">削除</button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          onSave={handleUpdate}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
}