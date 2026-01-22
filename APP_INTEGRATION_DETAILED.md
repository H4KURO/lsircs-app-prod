# App.jsx 統合手順書（詳細版）

## 📋 概要

この手順書に従って、BuyersListViewをApp.jsxに統合します。

---

## 🔍 統合前の確認

### 確認事項
- [ ] `app/src/BuyersListView.jsx` が存在する
- [ ] `app/src/locales/en/common.json` に `buyersList` の翻訳がある
- [ ] `app/src/locales/ja/common.json` に `buyersList` の翻訳がある
- [ ] Cosmos DBに `BuyersList` コンテナが作成されている

---

## 📝 統合手順

### ステップ1: App.jsxを開く

ファイルの場所: `app/src/App.jsx`

---

### ステップ2: インポート文を追加

#### 2-1. ビューのインポート

**既存のインポート文**を探します：
```jsx
import DashboardView from './DashboardView';
import TaskView from './TaskView';
import CustomerView from './CustomerView';
// ... 他のビューのインポート
```

**その下に追加**：
```jsx
import BuyersListView from './BuyersListView';
```

#### 2-2. アイコンのインポート

**既存のアイコンインポート文**を探します：
```jsx
import {
  Dashboard as DashboardIcon,
  Assignment as AssignmentIcon,
  People as PeopleIcon,
  // ... 他のアイコン
} from '@mui/icons-material';
```

**その中に追加**（アルファベット順が望ましい）：
```jsx
import {
  Dashboard as DashboardIcon,
  Assignment as AssignmentIcon,
  ListAlt as ListAltIcon,        // ← この行を追加
  People as PeopleIcon,
  // ... 他のアイコン
} from '@mui/icons-material';
```

または、別の行で追加：
```jsx
import ListAltIcon from '@mui/icons-material/ListAlt';
```

---

### ステップ3: メニュー項目を追加

#### 3-1. menuItems配列を探す

App.jsx内で以下のような配列を探します：
```jsx
const menuItems = [
  { id: 'dashboard', label: t('nav.dashboard'), icon: <DashboardIcon />, view: 'dashboard' },
  { id: 'tasks', label: t('nav.tasks'), icon: <AssignmentIcon />, view: 'tasks' },
  // ... 他のメニュー項目
];
```

#### 3-2. 適切な位置に追加

**推奨位置**: `weeklyReports` の後、`invoices` の前

```jsx
const menuItems = [
  { id: 'dashboard', label: t('nav.dashboard'), icon: <DashboardIcon />, view: 'dashboard' },
  { id: 'tasks', label: t('nav.tasks'), icon: <AssignmentIcon />, view: 'tasks' },
  { id: 'customers', label: t('nav.customers'), icon: <PeopleIcon />, view: 'customers' },
  { id: 'managedProperties', label: t('nav.managedProperties'), icon: <HomeWorkIcon />, view: 'properties' },
  { id: 'projectTm', label: t('nav.projectTm'), icon: <FolderOpenIcon />, view: 'projectTm' },
  { id: 'weeklyReports', label: t('nav.weeklyReports'), icon: <AssessmentIcon />, view: 'weeklyReports' },
  
  // ↓↓↓ この行を追加 ↓↓↓
  { id: 'buyersList', label: t('nav.buyersList'), icon: <ListAltIcon />, view: 'buyersList' },
  
  { id: 'invoices', label: t('nav.invoices'), icon: <ReceiptIcon />, view: 'invoices' },
  { id: 'settings', label: t('nav.settings'), icon: <SettingsIcon />, view: 'settings' },
];
```

---

### ステップ4: ビューのレンダリングを追加

#### 4-1. renderView関数またはswitch文を探す

以下のようなコードを探します：

**パターンA: switch文**
```jsx
const renderView = () => {
  switch (currentView) {
    case 'dashboard':
      return <DashboardView />;
    case 'tasks':
      return <TaskView />;
    // ... 他のケース
  }
};
```

**パターンB: if-else文**
```jsx
const renderView = () => {
  if (currentView === 'dashboard') return <DashboardView />;
  if (currentView === 'tasks') return <TaskView />;
  // ... 他の条件
};
```

#### 4-2. 該当箇所に追加

**switch文の場合**:
```jsx
const renderView = () => {
  switch (currentView) {
    case 'dashboard':
      return <DashboardView />;
    case 'tasks':
      return <TaskView />;
    case 'customers':
      return <CustomerView />;
    case 'properties':
      return <ManagedPropertiesView />;
    case 'projectTm':
      return <ProjectTMView />;
    case 'weeklyReports':
      return <WeeklyLeasingReportView />;
    
    // ↓↓↓ この3行を追加 ↓↓↓
    case 'buyersList':
      return <BuyersListView />;
    
    case 'invoices':
      return <InvoiceView />;
    case 'settings':
      return <SettingsView />;
    case 'profile':
      return <ProfileView />;
    default:
      return <DashboardView />;
  }
};
```

**if-else文の場合**:
```jsx
const renderView = () => {
  if (currentView === 'dashboard') return <DashboardView />;
  if (currentView === 'tasks') return <TaskView />;
  // ... 他の条件
  
  // ↓↓↓ この行を追加 ↓↓↓
  if (currentView === 'buyersList') return <BuyersListView />;
  
  if (currentView === 'invoices') return <InvoiceView />;
  // ... 他の条件
  
  return <DashboardView />; // デフォルト
};
```

---

## ✅ 統合完了の確認

### ステップ5: ファイルを保存

App.jsxを保存します。

### ステップ6: 開発サーバーで確認

```bash
# フロントエンドの開発サーバーが起動していない場合
cd app
npm run dev
```

ブラウザで `http://localhost:5173` を開きます。

### ステップ7: 動作確認

- [ ] メニューに「Buyers List」が表示される
- [ ] クリックするとBuyersListViewが表示される
- [ ] エラーが表示されない
- [ ] 他のビューとの切り替えが正常に動作する

---

## 🐛 トラブルシューティング

### 問題: メニューに表示されない

**原因1**: インポート文が間違っている
```jsx
// ❌ 間違い
import BuyersListView from './BuyerListView';

// ✅ 正しい
import BuyersListView from './BuyersListView';
```

**原因2**: menuItemsに追加していない
- ステップ3を再確認

**原因3**: 翻訳ファイルが更新されていない
```json
// locales/ja/common.json を確認
{
  "nav": {
    "buyersList": "Buyers List"  // ← これが必要
  }
}
```

---

### 問題: クリックしても画面が表示されない

**原因1**: renderView関数に追加していない
- ステップ4を再確認

**原因2**: viewの名前が一致していない
```jsx
// menuItems のview
{ id: 'buyersList', view: 'buyersList' }

// renderView のcase
case 'buyersList':  // ← 一致させる
```

---

### 問題: エラーが表示される

**エラー1**: `Cannot find module './BuyersListView'`
- BuyersListView.jsxが `app/src/` にあることを確認
- ファイル名のスペルを確認

**エラー2**: `t is not defined`
- `useTranslation` がインポートされていることを確認
```jsx
import { useTranslation } from 'react-i18next';

function App() {
  const { t } = useTranslation();
  // ...
}
```

**エラー3**: `ListAltIcon is not defined`
- アイコンのインポートを確認（ステップ2-2）

---

## 📸 統合完了後の見た目

メニューには以下のように表示されます：

```
📊 Dashboard
✓ Task Management
👥 Customer Management
🏠 Managed Properties
📁 Project TM
📈 Weekly Reports
📋 Buyers List         ← 新しく追加
🧾 Invoice Management
⚙️ Settings
```

---

## 🎯 次のステップ

統合が完了したら：

1. ✅ GitHubにコミット＆プッシュ
   ```bash
   git add app/src/App.jsx
   git commit -m "feat: Add Buyers List to navigation menu"
   git push origin main
   ```

2. ✅ 自動デプロイを待つ（GitHub Actions）

3. ✅ 本番環境で動作確認

---

## 📞 サポート

問題が解決しない場合は、以下を確認してください：

1. ブラウザのコンソールでエラーを確認
2. 開発サーバーのターミナルでエラーを確認
3. App.jsxの構文エラーを確認

---

**作成日**: 2026-01-22  
**対象ファイル**: `app/src/App.jsx`  
**関連ファイル**: 
- `app/src/BuyersListView.jsx`
- `app/src/locales/en/common.json`
- `app/src/locales/ja/common.json`
