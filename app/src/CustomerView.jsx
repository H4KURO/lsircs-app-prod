// app/src/CustomerView.jsx

import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { CustomerDetailModal } from './CustomerDetailModal';
import { Box, TextField, Button, List, ListItem, ListItemText, IconButton, Typography, Paper } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

const API_URL = '/api';

export function CustomerView() {
  const [customers, setCustomers] = useState([]);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [filter, setFilter] = useState({ name: '', '担当者': '' });

  useEffect(() => {
    axios.get(`${API_URL}/GetCustomers`).then(res => setCustomers(res.data));
  }, []);

  const processedCustomers = useMemo(() => {
    let filtered = [...customers];
    if (filter.name) {
      filtered = filtered.filter(c => c.name && c.name.toLowerCase().includes(filter.name.toLowerCase()));
    }
    if (filter['担当者']) {
      filtered = filtered.filter(c => c['担当者'] && c['担当者'].toLowerCase().includes(filter['担当者'].toLowerCase()));
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        顧客管理
      </Typography>

      <Paper elevation={2} sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>新規顧客</Typography>
        <Box component="form" onSubmit={handleCreate} sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            fullWidth
            label="新しい顧客名を入力..."
            variant="outlined"
            size="small"
            value={newCustomerName}
            onChange={e => setNewCustomerName(e.target.value)}
          />
          <Button type="submit" variant="contained">追加</Button>
        </Box>
        
        <Typography variant="h6" gutterBottom>フィルター & ソート</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField label="顧客名..." name="name" variant="outlined" size="small" value={filter.name} onChange={handleFilterChange} />
          <TextField label="担当者..." name="担当者" variant="outlined" size="small" value={filter['担当者']} onChange={handleFilterChange} />
          <Button variant="outlined" size="small" onClick={() => requestSort('name')}>顧客名</Button>
          <Button variant="outlined" size="small" onClick={() => requestSort('price')}>価格</Button>
        </Box>
      </Paper>

      <Paper elevation={2} sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>顧客一覧</Typography>
        <List>
          {processedCustomers.map(customer => (
            <ListItem
              key={customer.id}
              secondaryAction={
                <Box>
                  <IconButton edge="end" aria-label="edit" onClick={() => setSelectedCustomer(customer)}><EditIcon /></IconButton>
                  <IconButton edge="end" aria-label="delete" onClick={() => handleDelete(customer.id)}><DeleteIcon /></IconButton>
                </Box>
              }
              sx={{ borderBottom: '1px solid #eee' }}
            >
              <ListItemText
                primary={customer.name}
                secondary={`担当: ${customer['担当者'] || '未設定'}`}
              />
            </ListItem>
          ))}
        </List>
      </Paper>

      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          onSave={handleUpdate}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </Box>
  );
}