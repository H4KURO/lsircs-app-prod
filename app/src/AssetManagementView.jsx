// app/src/AssetManagementView.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Tabs, Tab, Typography, Alert } from '@mui/material';
import { AssetOwnersTab } from './AssetOwnersTab';
import { AssetPropertiesTab } from './AssetPropertiesTab';
import { AssetContractsTab } from './AssetContractsTab';
import { AssetRentTransactionsTab } from './AssetRentTransactionsTab';

const API_URL = '/api';

export function AssetManagementView() {
  const [tab, setTab] = useState(0);
  const [owners, setOwners] = useState([]);
  const [properties, setProperties] = useState([]);
  const [contracts, setContracts] = useState([]);

  // 参照用データはタブの表示順に関わらず先読みしておく（他タブのプルダウンで使うため）
  useEffect(() => {
    axios.get(`${API_URL}/GetAssetOwners`).then((res) => setOwners(res.data || [])).catch(() => {});
    axios.get(`${API_URL}/GetAssetProperties`).then((res) => setProperties(res.data || [])).catch(() => {});
    axios.get(`${API_URL}/GetAssetContracts`).then((res) => setContracts(res.data || [])).catch(() => {});
  }, []);

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>資産管理（テスト環境）</Typography>
      </Box>
      <Alert severity="warning" sx={{ mb: 2 }}>
        この機能は開発中のテスト環境です。実際の送金・決済は行わず、物件・契約・賃料入出金の記録と集計のみを扱います。管理者のみに表示されています。
      </Alert>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="物件" />
        <Tab label="オーナー" />
        <Tab label="契約" />
        <Tab label="賃料入出金" />
      </Tabs>

      {tab === 0 && <AssetPropertiesTab owners={owners} onPropertiesChange={setProperties} />}
      {tab === 1 && <AssetOwnersTab onOwnersChange={setOwners} />}
      {tab === 2 && <AssetContractsTab properties={properties} onContractsChange={setContracts} />}
      {tab === 3 && <AssetRentTransactionsTab contracts={contracts} properties={properties} />}
    </Box>
  );
}

export default AssetManagementView;
