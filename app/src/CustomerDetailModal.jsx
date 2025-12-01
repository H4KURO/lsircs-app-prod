import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
} from '@mui/material';
import { AttachmentManager } from './AttachmentManager';

const OWNER_FIELD = '�S����';

export function CustomerDetailModal({ customer, onSave, onClose }) {
  const [editableCustomer, setEditableCustomer] = useState(customer);

  useEffect(() => {
    setEditableCustomer(customer);
  }, [customer]);

  if (!customer) {
    return null;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setEditableCustomer((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    onSave?.(editableCustomer);
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>オーナー情報を編集</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="オーナー名"
            name="name"
            value={editableCustomer?.name || ''}
            onChange={handleChange}
            fullWidth
          />
          <TextField
            label="物件"
            name="property"
            value={editableCustomer?.property || ''}
            onChange={handleChange}
            fullWidth
          />
          <TextField
            label="価格"
            name="price"
            type="number"
            value={editableCustomer?.price || 0}
            onChange={handleChange}
            fullWidth
          />
          <TextField
            label="担当者"
            name={OWNER_FIELD}
            value={editableCustomer?.[OWNER_FIELD] || ''}
            onChange={handleChange}
            fullWidth
          />
          <AttachmentManager
            value={editableCustomer?.attachments || []}
            onChange={(next) => setEditableCustomer((prev) => ({ ...prev, attachments: next }))}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={handleSave} variant="contained">
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}
