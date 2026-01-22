# App.jsx 統合ガイド

## BuyersListView を App.jsx に統合する手順

### 1. インポート文の追加

App.jsx の先頭付近（他のビューのインポート文の近く）に以下を追加：

```jsx
import BuyersListView from './BuyersListView';
```

### 2. メニュー項目の追加

`menuItems` 配列に以下を追加（他のメニュー項目と同じ場所）：

```jsx
{
  id: 'buyersList',
  label: 'Buyers List',
  icon: <ListAltIcon />, // または適切なアイコン
  view: 'buyersList',
},
```

**必要なアイコンのインポート**（@mui/icons-materialから）:
```jsx
import ListAltIcon from '@mui/icons-material/ListAlt';
// または
import HomeWorkIcon from '@mui/icons-material/HomeWork';
// または
import AssignmentIcon from '@mui/icons-material/Assignment';
```

### 3. ビューのレンダリング

メインコンテンツエリア（renderView関数またはswitch文）に以下のケースを追加：

```jsx
case 'buyersList':
  return <BuyersListView />;
```

---

## 完全な統合例

既存のコード構造を想定した統合例：

```jsx
// ========== インポートセクション ==========
import { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  // ... 他のインポート
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Assignment as TaskIcon,
  People as CustomersIcon,
  Receipt as InvoiceIcon,
  HomeWork as PropertiesIcon,
  ListAlt as BuyersListIcon, // ← 追加
  // ... 他のアイコン
} from '@mui/icons-material';

// ビューのインポート
import DashboardView from './DashboardView';
import TaskView from './TaskView';
import CustomerView from './CustomerView';
import InvoiceView from './InvoiceView';
import ManagedPropertiesView from './ManagedPropertiesView';
import ProjectTMView from './ProjectTMView';
import WeeklyLeasingReportView from './WeeklyLeasingReportView';
import BuyersListView from './BuyersListView'; // ← 追加

function App() {
  const [currentView, setCurrentView] = useState('dashboard');

  // メニュー項目の定義
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon />, view: 'dashboard' },
    { id: 'tasks', label: 'Tasks', icon: <TaskIcon />, view: 'tasks' },
    { id: 'customers', label: 'Customers', icon: <CustomersIcon />, view: 'customers' },
    { id: 'invoices', label: 'Invoices', icon: <InvoiceIcon />, view: 'invoices' },
    { id: 'properties', label: 'Properties', icon: <PropertiesIcon />, view: 'properties' },
    { id: 'projectTM', label: 'Project TM', icon: <AssignmentIcon />, view: 'projectTM' },
    { id: 'weeklyReports', label: 'Weekly Reports', icon: <AssessmentIcon />, view: 'weeklyReports' },
    { id: 'buyersList', label: 'Buyers List', icon: <BuyersListIcon />, view: 'buyersList' }, // ← 追加
  ];

  // ビューのレンダリング
  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'tasks':
        return <TaskView />;
      case 'customers':
        return <CustomerView />;
      case 'invoices':
        return <InvoiceView />;
      case 'properties':
        return <ManagedPropertiesView />;
      case 'projectTM':
        return <ProjectTMView />;
      case 'weeklyReports':
        return <WeeklyLeasingReportView />;
      case 'buyersList': // ← 追加
        return <BuyersListView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <Box sx={{ display: 'flex' }}>
      {/* AppBar, Drawer, メニューなど */}
      <Drawer>
        <List>
          {menuItems.map((item) => (
            <ListItem
              button
              key={item.id}
              selected={currentView === item.view}
              onClick={() => setCurrentView(item.view)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItem>
          ))}
        </List>
      </Drawer>

      {/* メインコンテンツ */}
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        {renderView()}
      </Box>
    </Box>
  );
}

export default App;
```

---

## 多言語対応（i18n）が必要な場合

### locales/ja/translation.json に追加:

```json
{
  "menu": {
    "buyersList": "Buyers List"
  }
}
```

### locales/en/translation.json に追加:

```json
{
  "menu": {
    "buyersList": "Buyers List"
  }
}
```

### App.jsx でi18nを使用している場合:

```jsx
import { useTranslation } from 'react-i18next';

function App() {
  const { t } = useTranslation();

  const menuItems = [
    // ...
    { id: 'buyersList', label: t('menu.buyersList'), icon: <BuyersListIcon />, view: 'buyersList' },
  ];
}
```

---

## 注意事項

1. **アイコンの選択**: 上記では `ListAltIcon` を使用していますが、以下のアイコンも適切です：
   - `HomeWorkIcon` - 物件関連を強調
   - `AssignmentIcon` - リスト管理を強調
   - `PeopleIcon` - 購入者リストを強調

2. **メニュー順序**: 既存のビューとの関連性を考慮して、適切な位置に配置してください。
   例: ProjectTMViewの後、またはWeeklyLeasingReportViewの後

3. **権限管理**: 将来的に認証を実装する場合、特定のユーザーのみアクセス可能にする設定が必要です。

---

## 確認事項

統合後、以下を確認してください：

- [ ] メニューに「Buyers List」が表示される
- [ ] クリックするとBuyersListViewが表示される
- [ ] 他のビューとの切り替えが正常に動作する
- [ ] アイコンが正しく表示される
