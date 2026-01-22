import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Typography,
  Toolbar,
  Tooltip,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  FileUpload as FileUploadIcon,
} from '@mui/icons-material';
import axios from 'axios';

export default function BuyersListView() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openDialog, setOpenDialog] = useState(false);
  const [openImportDialog, setOpenImportDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  const [formData, setFormData] = useState({
    unitNumber: '',
    nameRomaji: '',
    nameJapanese: '',
    japanStaff: '',
    hawaiiStaff: '',
    phone: '',
    email: '',
    contractedDate: '',
    purchasePrice: 0,
    status: 'Active',
  });

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await axios.get('/api/GetBuyersList');
      setItems(response.data);
    } catch (error) {
      showSnackbar('データの取得に失敗しました', 'error');
    }
  };

  const handleOpenDialog = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        unitNumber: item.unitNumber || '',
        nameRomaji: item.nameRomaji || '',
        nameJapanese: item.nameJapanese || '',
        japanStaff: item.japanStaff || '',
        hawaiiStaff: item.hawaiiStaff || '',
        phone: item.phone || '',
        email: item.email || '',
        contractedDate: item.contractedDate ? item.contractedDate.split('T')[0] : '',
        purchasePrice: item.purchasePrice || 0,
        status: item.status || 'Active',
      });
    } else {
      setEditingItem(null);
      setFormData({
        unitNumber: '',
        nameRomaji: '',
        nameJapanese: '',
        japanStaff: '',
        hawaiiStaff: '',
        phone: '',
        email: '',
        contractedDate: '',
        purchasePrice: 0,
        status: 'Active',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingItem(null);
  };

  const handleSave = async () => {
    try {
      if (editingItem) {
        await axios.put(`/api/UpdateBuyersListItem/${editingItem.id}`, formData);
        showSnackbar('更新しました', 'success');
      } else {
        await axios.post('/api/CreateBuyersListItem', formData);
        showSnackbar('追加しました', 'success');
      }
      handleCloseDialog();
      fetchItems();
    } catch (error) {
      showSnackbar('保存に失敗しました', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('本当に削除しますか？')) return;
    
    try {
      await axios.delete(`/api/DeleteBuyersListItem/${id}`);
      showSnackbar('削除しました', 'success');
      fetchItems();
    } catch (error) {
      showSnackbar('削除に失敗しました', 'error');
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('/api/ImportBuyersListExcel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showSnackbar(response.data.message, 'success');
      setOpenImportDialog(false);
      fetchItems();
    } catch (error) {
      showSnackbar('インポートに失敗しました', 'error');
    }
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ja-JP');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Typography variant="h6">Buyers List</Typography>
          <Box>
            <Tooltip title="Excelからインポート">
              <IconButton onClick={() => setOpenImportDialog(true)}>
                <FileUploadIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="更新">
              <IconButton onClick={fetchItems}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              新規追加
            </Button>
          </Box>
        </Toolbar>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ユニット番号</TableCell>
                <TableCell>契約者名（ローマ字）</TableCell>
                <TableCell>契約者名（日本語）</TableCell>
                <TableCell>日本担当</TableCell>
                <TableCell>ハワイ担当</TableCell>
                <TableCell>電話</TableCell>
                <TableCell>メール</TableCell>
                <TableCell>契約日</TableCell>
                <TableCell>購入価格</TableCell>
                <TableCell>ステータス</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.unitNumber}</TableCell>
                    <TableCell>{item.nameRomaji}</TableCell>
                    <TableCell>{item.nameJapanese}</TableCell>
                    <TableCell>{item.japanStaff}</TableCell>
                    <TableCell>{item.hawaiiStaff}</TableCell>
                    <TableCell>{item.phone}</TableCell>
                    <TableCell>{item.email}</TableCell>
                    <TableCell>{formatDate(item.contractedDate)}</TableCell>
                    <TableCell>{formatPrice(item.purchasePrice)}</TableCell>
                    <TableCell>{item.status}</TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(item)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(item.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={items.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="表示件数:"
        />
      </Paper>

      {/* 編集ダイアログ */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingItem ? 'Buyers List編集' : 'Buyers List新規追加'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label="ユニット番号"
              value={formData.unitNumber}
              onChange={(e) => setFormData({ ...formData, unitNumber: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="契約者名（ローマ字）"
              value={formData.nameRomaji}
              onChange={(e) => setFormData({ ...formData, nameRomaji: e.target.value })}
              fullWidth
            />
            <TextField
              label="契約者名（日本語）"
              value={formData.nameJapanese}
              onChange={(e) => setFormData({ ...formData, nameJapanese: e.target.value })}
              fullWidth
            />
            <TextField
              label="日本担当"
              value={formData.japanStaff}
              onChange={(e) => setFormData({ ...formData, japanStaff: e.target.value })}
              fullWidth
            />
            <TextField
              label="ハワイ担当"
              value={formData.hawaiiStaff}
              onChange={(e) => setFormData({ ...formData, hawaiiStaff: e.target.value })}
              fullWidth
            />
            <TextField
              label="電話"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              fullWidth
            />
            <TextField
              label="メールアドレス"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              fullWidth
            />
            <TextField
              label="契約日"
              type="date"
              value={formData.contractedDate}
              onChange={(e) => setFormData({ ...formData, contractedDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="購入価格"
              type="number"
              value={formData.purchasePrice}
              onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
              fullWidth
            />
            <TextField
              label="ステータス"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>キャンセル</Button>
          <Button onClick={handleSave} variant="contained">
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* インポートダイアログ */}
      <Dialog open={openImportDialog} onClose={() => setOpenImportDialog(false)}>
        <DialogTitle>Excelファイルからインポート</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            TPWV_Buyers_List.xlsxファイルを選択してください
          </Typography>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            style={{ display: 'block' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenImportDialog(false)}>キャンセル</Button>
        </DialogActions>
      </Dialog>

      {/* スナックバー */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
