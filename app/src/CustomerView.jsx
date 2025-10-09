// app/src/CustomerView.jsx

import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { CustomerDetailModal } from './CustomerDetailModal';
import { Box, TextField, Button, List, ListItem, ListItemText, IconButton, Typography, Paper } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from 'react-i18next';

const API_URL = '/api';
const ASSIGNEE_FIELD = '担当者';

export function CustomerView() {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState([]);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [filter, setFilter] = useState({ name: '', [ASSIGNEE_FIELD]: '' });

  useEffect(() => {
    axios.get(`${API_URL}/GetCustomers`).then((res) => setCustomers(res.data));
  }, []);

  const processedCustomers = useMemo(() => {
    let filtered = [...customers];
    if (filter.name) {
      filtered = filtered.filter((customer) =>
        customer?.name?.toLowerCase().includes(filter.name.toLowerCase()),
      );
    }
    if (filter[ASSIGNEE_FIELD]) {
      filtered = filtered.filter((customer) => {
        const assignee = customer?.[ASSIGNEE_FIELD];
        return typeof assignee === 'string' && assignee.toLowerCase().includes(filter[ASSIGNEE_FIELD].toLowerCase());
      });
    }
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a?.[sortConfig.key];
        const bValue = b?.[sortConfig.key];
        if (!aValue) return 1;
        if (!bValue) return -1;
        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
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

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilter((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreate = (event) => {
    event.preventDefault();
    if (!newCustomerName.trim()) return;
    axios.post(`${API_URL}/CreateCustomer`, { name: newCustomerName }).then((res) => {
      setCustomers((prev) => [...prev, res.data]);
      setNewCustomerName('');
    });
  };

  const handleDelete = (idToDelete) => {
    axios.delete(`${API_URL}/DeleteCustomer/${idToDelete}`).then(() => {
      setCustomers((prev) => prev.filter((customer) => customer.id !== idToDelete));
    });
  };

  const handleUpdate = (customerToUpdate) => {
    axios.put(`${API_URL}/UpdateCustomer/${customerToUpdate.id}`, customerToUpdate).then((res) => {
      setCustomers((prev) => prev.map((customer) => (customer.id === customerToUpdate.id ? res.data : customer)));
      setSelectedCustomer(null);
    });
  };

  const getAssigneeText = (customer) => {
    const assignee = customer?.[ASSIGNEE_FIELD];
    return assignee ? t('customerView.list.assignee', { name: assignee }) : t('customerView.list.assignee', { name: t('customerView.list.unassigned') });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {t('customerView.title')}
      </Typography>

      <Paper elevation={2} sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          {t('customerView.newSection.title')}
        </Typography>
        <Box component="form" onSubmit={handleCreate} sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            fullWidth
            label={t('customerView.newSection.placeholder')}
            variant="outlined"
            size="small"
            value={newCustomerName}
            onChange={(event) => setNewCustomerName(event.target.value)}
          />
          <Button type="submit" variant="contained">
            {t('customerView.newSection.submit')}
          </Button>
        </Box>

        <Typography variant="h6" gutterBottom>
          {t('customerView.filters.title')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            label={t('customerView.filters.namePlaceholder')}
            name="name"
            variant="outlined"
            size="small"
            value={filter.name}
            onChange={handleFilterChange}
          />
          <TextField
            label={t('customerView.filters.assigneePlaceholder')}
            name={ASSIGNEE_FIELD}
            variant="outlined"
            size="small"
            value={filter[ASSIGNEE_FIELD]}
            onChange={handleFilterChange}
          />
          <Button variant="outlined" size="small" onClick={() => requestSort('name')}>
            {t('customerView.filters.sortByName')}
          </Button>
          <Button variant="outlined" size="small" onClick={() => requestSort('price')}>
            {t('customerView.filters.sortByPrice')}
          </Button>
        </Box>
      </Paper>

      <Paper elevation={2} sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          {t('customerView.list.title')}
        </Typography>
        <List>
          {processedCustomers.map((customer) => (
            <ListItem
              key={customer.id}
              secondaryAction={
                <Box>
                  <IconButton edge="end" aria-label="edit" onClick={() => setSelectedCustomer(customer)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton edge="end" aria-label="delete" onClick={() => handleDelete(customer.id)}>
                    <DeleteIcon />
                  </IconButton>
                </Box>
              }
              sx={{ borderBottom: '1px solid #eee' }}
            >
              <ListItemText primary={customer.name} secondary={getAssigneeText(customer)} />
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



