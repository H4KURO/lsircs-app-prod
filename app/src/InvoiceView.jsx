// app/src/InvoiceView.jsx

import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from 'react-i18next';
import { InvoiceDetailModal } from './InvoiceDetailModal';

const API_URL = '/api';

const normalizeCurrencyLocale = (language) => {
  if (!language) {
    return { locale: 'ja-JP', currency: 'JPY' };
  }
  const base = language.split('-')[0];
  switch (base) {
    case 'en':
      return { locale: 'en-US', currency: 'USD' };
    case 'ja':
    default:
      return { locale: 'ja-JP', currency: 'JPY' };
  }
};

const normalizeStatusKey = (status) =>
  typeof status === 'string' && status.trim() ? status.trim().toLowerCase() : 'unknown';

export function InvoiceView() {
  const { t, i18n } = useTranslation();
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [newInvoice, setNewInvoice] = useState({ customerId: '', amount: '' });
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const { locale, currency } = useMemo(() => normalizeCurrencyLocale(i18n.language), [i18n.language]);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }),
    [locale, currency],
  );

  const formatAmount = (value) => {
    const numeric = Number(value ?? 0);
    if (Number.isNaN(numeric)) {
      return currencyFormatter.format(0);
    }
    return currencyFormatter.format(numeric);
  };

  const getStatusLabel = (status) => {
    const key = normalizeStatusKey(status);
    const translated = t(`invoiceView.status.${key}`, { defaultValue: '' }).trim();
    return translated || status || t('invoiceView.status.unknown');
  };

  useEffect(() => {
    Promise.all([
      axios.get(`${API_URL}/GetInvoices`),
      axios.get(`${API_URL}/GetCustomers`),
    ]).then(([invoiceRes, customerRes]) => {
      setInvoices(invoiceRes.data ?? []);
      setCustomers(customerRes.data ?? []);
    });
  }, []);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setNewInvoice((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreate = (event) => {
    event.preventDefault();
    const amountValue = Number(newInvoice.amount);
    if (!newInvoice.customerId || Number.isNaN(amountValue) || amountValue <= 0) {
      alert(t('invoiceView.form.validation'));
      return;
    }
    axios
      .post(`${API_URL}/CreateInvoice`, { ...newInvoice, amount: amountValue })
      .then((res) => {
        setInvoices((prev) => [...prev, res.data]);
        setNewInvoice({ customerId: '', amount: '' });
      });
  };

  const handleDelete = (idToDelete) => {
    if (!window.confirm(t('invoiceView.deleteConfirm'))) {
      return;
    }
    axios.delete(`${API_URL}/DeleteInvoice/${idToDelete}`).then(() => {
      setInvoices((prev) => prev.filter((invoice) => invoice.id !== idToDelete));
    });
  };

  const handleUpdate = (invoiceToUpdate) => {
    axios.put(`${API_URL}/UpdateInvoice/${invoiceToUpdate.id}`, invoiceToUpdate).then((res) => {
      setInvoices((prev) => prev.map((invoice) => (invoice.id === invoiceToUpdate.id ? res.data : invoice)));
      setSelectedInvoice(null);
    });
  };

  const findCustomerName = (customerId) =>
    customers.find((customer) => customer.id === customerId)?.name || t('invoiceView.list.unknownCustomer');

  const renderInvoiceSecondary = (invoice) => {
    const amountText = t('invoiceView.list.amount', { amount: formatAmount(invoice.amount) });
    const statusText = t('invoiceView.list.status', { status: getStatusLabel(invoice.status) });
    return `${amountText} / ${statusText}`;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {t('invoiceView.title')}
      </Typography>

      <Paper elevation={2} sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          {t('invoiceView.form.title')}
        </Typography>
        <Box component="form" onSubmit={handleCreate} sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="invoice-customer-label">{t('invoiceView.form.customerLabel')}</InputLabel>
            <Select
              labelId="invoice-customer-label"
              name="customerId"
              value={newInvoice.customerId}
              label={t('invoiceView.form.customerLabel')}
              onChange={handleInputChange}
              required
            >
              <MenuItem value="">
                {t('invoiceView.form.customerPlaceholder')}
              </MenuItem>
              {customers.map((customer) => (
                <MenuItem key={customer.id} value={customer.id}>
                  {customer.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            type="number"
            name="amount"
            size="small"
            label={t('invoiceView.form.amountLabel')}
            placeholder={t('invoiceView.form.amountPlaceholder')}
            value={newInvoice.amount}
            onChange={handleInputChange}
            inputProps={{ min: 0, step: 1 }}
            sx={{ minWidth: 160 }}
            required
          />
          <Button type="submit" variant="contained" sx={{ alignSelf: 'center' }}>
            {t('invoiceView.form.submit')}
          </Button>
        </Box>
      </Paper>

      <Paper elevation={2} sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          {t('invoiceView.list.title')}
        </Typography>
        {invoices.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('invoiceView.list.empty')}
          </Typography>
        ) : (
          <List>
            {invoices.map((invoice) => (
              <ListItem key={invoice.id} disableGutters secondaryAction={
                <IconButton edge="end" aria-label={t('invoiceView.list.delete')} onClick={() => handleDelete(invoice.id)}>
                  <DeleteIcon />
                </IconButton>
              }>
                <ListItemButton onClick={() => setSelectedInvoice(invoice)}>
                  <ListItemText
                    primary={t('invoiceView.list.customer', { name: findCustomerName(invoice.customerId) })}
                    secondary={renderInvoiceSecondary(invoice)}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          customers={customers}
          onSave={handleUpdate}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </Box>
  );
}



