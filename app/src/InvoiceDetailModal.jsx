// app/src/InvoiceDetailModal.jsx

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const STATUS_OPTIONS = ['draft', 'sent', 'paid'];

const normalizeCustomerName = (customers, id, fallback) =>
  customers.find((customer) => customer.id === id)?.name || fallback;

export function InvoiceDetailModal({ invoice, customers, onSave, onClose }) {
  const { t } = useTranslation();
  const [editableInvoice, setEditableInvoice] = useState(invoice);

  const statusOptions = useMemo(
    () =>
      STATUS_OPTIONS.map((status) => ({
        value: status,
        label: t(`invoiceDetail.statusOptions.${status}`),
      })),
    [t],
  );

  const customerName = normalizeCustomerName(
    customers,
    invoice.customerId,
    t('invoiceDetail.unknownCustomer'),
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setEditableInvoice((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    onSave(editableInvoice);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-content"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2>{t('invoiceDetail.title')}</h2>

        <p>
          <strong>{t('invoiceDetail.customer')}:</strong> {customerName}
        </p>

        <label htmlFor="invoice-detail-amount">{t('invoiceDetail.amount')}:</label>
        <input
          id="invoice-detail-amount"
          type="number"
          name="amount"
          value={editableInvoice.amount || 0}
          onChange={handleChange}
          min="0"
        />

        <label htmlFor="invoice-detail-status">{t('invoiceDetail.status')}:</label>
        <select
          id="invoice-detail-status"
          name="status"
          value={editableInvoice.status}
          onChange={handleChange}
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <div className="modal-buttons">
          <button type="button" onClick={handleSubmit}>
            {t('invoiceDetail.save')}
          </button>
          <button type="button" onClick={onClose}>
            {t('invoiceDetail.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
