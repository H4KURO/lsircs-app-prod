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
  Tabs,
  Tab,
  Grid,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  FileUpload as FileUploadIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import axios from 'axios';

// タブパネルコンポーネント
function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index} style={{ padding: '24px 0' }}>
      {value === index && children}
    </div>
  );
}

export default function BuyersListView() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openDialog, setOpenDialog] = useState(false);
  const [openDetailDialog, setOpenDetailDialog] = useState(false);
  const [openImportDialog, setOpenImportDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [currentTab, setCurrentTab] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  const [formData, setFormData] = useState({
    unitNumber: '',
    nameRomaji: '',
    nameJapanese: '',
    japanStaff: '',
    hawaiiStaff: '',
    hhcStaff: '',
    phone: '',
    emailPrimary: '',
    emailCC: '',
    emailDocusign: '',
    escrowNumber: '',
    address: '',
    unitType: '',
    bedBath: '',
    sqft: '',
    contractedDate: '',
    purchasePrice: 0,
    deposit1Amount: 0,
    deposit1DueDate: '',
    deposit1Receipt: '',
    parkingNumber: '',
    storageNumber: '',
    purpose: '',
    entityType: '',
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
        hhcStaff: item.hhcStaff || '',
        phone: item.phone || '',
        emailPrimary: item.emailPrimary || '',
        emailCC: item.emailCC || '',
        emailDocusign: item.emailDocusign || '',
        escrowNumber: item.escrowNumber || '',
        address: item.address || '',
        unitType: item.unitType || '',
        bedBath: item.bedBath || '',
        sqft: item.sqft || '',
        contractedDate: item.contractedDate ? item.contractedDate.split('T')[0] : '',
        purchasePrice: item.purchasePrice || 0,
        deposit1Amount: item.deposit1Amount || 0,
        deposit1DueDate: item.deposit1DueDate ? item.deposit1DueDate.split('T')[0] : '',
        deposit1Receipt: item.deposit1Receipt || '',
        parkingNumber: item.parkingNumber || '',
        storageNumber: item.storageNumber || '',
        purpose: item.purpose || '',
        entityType: item.entityType || '',
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
        hhcStaff: '',
        phone: '',
        emailPrimary: '',
        emailCC: '',
        emailDocusign: '',
        escrowNumber: '',
        address: '',
        unitType: '',
        bedBath: '',
        sqft: '',
        contractedDate: '',
        purchasePrice: 0,
        deposit1Amount: 0,
        deposit1DueDate: '',
        deposit1Receipt: '',
        parkingNumber: '',
        storageNumber: '',
        purpose: '',
        entityType: '',
        status: 'Active',
      });
    }
    setOpenDialog(true);
  };

  const handleOpenDetailDialog = (item) => {
    setViewingItem(item);
    setCurrentTab(0);
    setOpenDetailDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingItem(null);
  };

  const handleCloseDetailDialog = () => {
    setOpenDetailDialog(false);
    setViewingItem(null);
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ja-JP');
  };

  // 詳細情報表示用の情報行コンポーネント
  const InfoRow = ({ label, value }) => (
    <Grid container spacing={2} sx={{ mb: 1.5 }}>
      <Grid item xs={4}>
        <Typography variant="body2" color="text.secondary" fontWeight="bold">
          {label}
        </Typography>
      </Grid>
      <Grid item xs={8}>
        <Typography variant="body2">
          {value || '-'}
        </Typography>
      </Grid>
    </Grid>
  );

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
                <TableCell>日本担当</TableCell>
                <TableCell>ハワイ担当</TableCell>
                <TableCell>ユニット番号</TableCell>
                <TableCell>契約者名</TableCell>
                <TableCell>電話</TableCell>
                <TableCell>ステータス</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.japanStaff}</TableCell>
                    <TableCell>{item.hawaiiStaff}</TableCell>
                    <TableCell>{item.unitNumber}</TableCell>
                    <TableCell>{item.nameRomaji}</TableCell>
                    <TableCell>{item.phone}</TableCell>
                    <TableCell>{item.status}</TableCell>
                    <TableCell>
                      <Tooltip title="詳細表示">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleOpenDetailDialog(item)}
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
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

      {/* 詳細表示ダイアログ（タブ付き） */}
      <Dialog 
        open={openDetailDialog} 
        onClose={handleCloseDetailDialog} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          {viewingItem && `ユニット ${viewingItem.unitNumber} - ${viewingItem.nameRomaji}`}
        </DialogTitle>
        <DialogContent>
          <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)}>
            <Tab label="基本情報" />
            <Tab label="物件詳細" />
            <Tab label="支払い情報" />
            <Tab label="その他" />
          </Tabs>

          {viewingItem && (
            <>
              {/* タブ1: 基本情報 */}
              <TabPanel value={currentTab} index={0}>
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, mb: 2, fontWeight: 'bold' }}>
                  担当者
                </Typography>
                <InfoRow label="日本担当" value={viewingItem.japanStaff} />
                <InfoRow label="ハワイ担当" value={viewingItem.hawaiiStaff} />
                <InfoRow label="HHC担当" value={viewingItem.hhcStaff} />

                <Divider sx={{ my: 3 }} />

                <Typography variant="subtitle2" gutterBottom sx={{ mb: 2, fontWeight: 'bold' }}>
                  契約者情報
                </Typography>
                <InfoRow label="契約者名（ローマ字）" value={viewingItem.nameRomaji} />
                <InfoRow label="契約者名（日本語）" value={viewingItem.nameJapanese} />

                <Divider sx={{ my: 3 }} />

                <Typography variant="subtitle2" gutterBottom sx={{ mb: 2, fontWeight: 'bold' }}>
                  連絡先
                </Typography>
                <InfoRow label="電話" value={viewingItem.phone} />
                <InfoRow label="メール（本人）" value={viewingItem.emailPrimary} />
                <InfoRow label="メール（CC）" value={viewingItem.emailCC} />
                <InfoRow label="メール（DocuSign）" value={viewingItem.emailDocusign} />
              </TabPanel>

              {/* タブ2: 物件詳細 */}
              <TabPanel value={currentTab} index={1}>
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, mb: 2, fontWeight: 'bold' }}>
                  物件情報
                </Typography>
                <InfoRow label="ユニット番号" value={viewingItem.unitNumber} />
                <InfoRow label="Escrow番号" value={viewingItem.escrowNumber} />
                <InfoRow label="住所" value={viewingItem.address} />
                <InfoRow label="Unit Type" value={viewingItem.unitType} />
                <InfoRow label="Bed/Bath" value={viewingItem.bedBath} />
                <InfoRow label="面積（sqft）" value={viewingItem.sqft} />

                <Divider sx={{ my: 3 }} />

                <Typography variant="subtitle2" gutterBottom sx={{ mb: 2, fontWeight: 'bold' }}>
                  駐車場・ストレージ
                </Typography>
                <InfoRow label="駐車場番号" value={viewingItem.parkingNumber} />
                <InfoRow label="ストレージ番号" value={viewingItem.storageNumber} />
              </TabPanel>

              {/* タブ3: 支払い情報 */}
              <TabPanel value={currentTab} index={2}>
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, mb: 2, fontWeight: 'bold' }}>
                  契約情報
                </Typography>
                <InfoRow label="契約日" value={formatDate(viewingItem.contractedDate)} />
                <InfoRow label="購入価格" value={formatPrice(viewingItem.purchasePrice)} />

                <Divider sx={{ my: 3 }} />

                <Typography variant="subtitle2" gutterBottom sx={{ mb: 2, fontWeight: 'bold' }}>
                  支払いスケジュール
                </Typography>
                <InfoRow label="1st Deposit金額" value={formatPrice(viewingItem.deposit1Amount)} />
                <InfoRow label="1st Deposit期日" value={formatDate(viewingItem.deposit1DueDate)} />
                <InfoRow label="1st Deposit Receipt" value={viewingItem.deposit1Receipt} />
              </TabPanel>

              {/* タブ4: その他 */}
              <TabPanel value={currentTab} index={3}>
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, mb: 2, fontWeight: 'bold' }}>
                  その他情報
                </Typography>
                <InfoRow label="目的" value={viewingItem.purpose} />
                <InfoRow label="個人/法人" value={viewingItem.entityType} />
                <InfoRow label="ステータス" value={viewingItem.status} />

                <Divider sx={{ my: 3 }} />

                <Typography variant="subtitle2" gutterBottom sx={{ mb: 2, fontWeight: 'bold' }}>
                  メタデータ
                </Typography>
                <InfoRow label="作成日時" value={formatDate(viewingItem.createdAt)} />
                <InfoRow label="作成者" value={viewingItem.createdBy} />
                <InfoRow label="更新日時" value={formatDate(viewingItem.updatedAt)} />
                <InfoRow label="更新者" value={viewingItem.updatedBy} />
              </TabPanel>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetailDialog}>閉じる</Button>
          <Button 
            onClick={() => {
              handleCloseDetailDialog();
              handleOpenDialog(viewingItem);
            }}
            variant="contained"
          >
            編集
          </Button>
        </DialogActions>
      </Dialog>

      {/* 編集ダイアログ（既存のまま） */}
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
              label="契約者名"
              value={formData.nameRomaji}
              onChange={(e) => setFormData({ ...formData, nameRomaji: e.target.value })}
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
              value={formData.emailPrimary}
              onChange={(e) => setFormData({ ...formData, emailPrimary: e.target.value })}
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
