# LSIR-CS Task Management System

社内用タスク管理システム - Azure Functions + React + Cosmos DB

## 🚀 Features

- **タスク管理**: タスクの作成、更新、削除、担当者管理
- **顧客管理**: 顧客情報の管理、AI文書分析
- **請求書管理**: 請求書の作成と追跡
- **物件管理**: 管理物件の情報管理、写真アップロード
- **プロジェクト管理**: プロジェクト顧客のExcelインポート/エクスポート
- **週次レポート**: リーシングレポートの作成と管理
- **Slack統合**: タスク作成/更新の自動通知、スラッシュコマンド対応
- **多言語対応**: 日本語/英語の切り替え

## 🏗️ Architecture

### Backend (Azure Functions)
- **Runtime**: Node.js 20+
- **Database**: Azure Cosmos DB
- **Storage**: Azure Blob Storage
- **AI**: Google Gemini API
- **Integration**: Slack Web API

### Frontend (React SPA)
- **Framework**: React 19 + Vite
- **UI Library**: Material-UI v7
- **Calendar**: React Big Calendar
- **i18n**: i18next

## 📋 Prerequisites

- Node.js 20.x or later
- Azure subscription
- Azure Functions Core Tools v4
- Cosmos DB account
- Slack workspace (optional)
- Google AI API key (optional)

## 🔧 Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd lsir-cs
```

### 2. Install Dependencies

```bash
# Backend
cd api
npm install

# Frontend
cd ../app
npm install
```

### 3. Configure Environment Variables

⚠️ **IMPORTANT**: Never commit actual credentials. See [SECURITY.md](./SECURITY.md)

```bash
# Backend
cd api
cp local.settings.json.example local.settings.json
# Edit local.settings.json with your actual credentials
```

Required settings:
- `CosmosDbConnectionString` - Cosmos DB connection string
- `SLACK_BOT_TOKEN` - Slack bot token (optional)
- `SLACK_SIGNING_SECRET` - Slack signing secret (optional)
- `SLACK_CHANNEL_ID` - Slack channel for notifications (optional)
- `BOX_IMPORT_STORAGE_CONNECTION` - Azure Storage connection string
- `GEMINI_API_KEY` - Google Gemini API key (optional)

### 4. Run Locally

```bash
# Start backend (from api directory)
cd api
func start

# Start frontend (from app directory, in another terminal)
cd app
npm run dev
```

Access the app at: http://localhost:5173

## 🚀 Deployment

### Azure Static Web Apps

This project uses Azure Static Web Apps with GitHub Actions for automatic deployment.

1. Create an Azure Static Web App resource
2. Connect to your GitHub repository
3. Configure build settings:
   - **App location**: `/app`
   - **API location**: `/api`
   - **Output location**: `dist`

4. Add application settings in Azure Portal:
   - Navigate to Configuration → Application settings
   - Add all settings from `local.settings.json.example`

### Manual Deployment

```bash
# Build frontend
cd app
npm run build

# Deploy to Azure
az staticwebapp deploy \
  --name <your-app-name> \
  --resource-group <your-resource-group> \
  --app-location ./app \
  --api-location ./api \
  --output-location dist
```

## 📚 Project Structure

```
lsir-cs/
├── api/                    # Azure Functions (Backend)
│   ├── *.js               # API endpoints
│   ├── cosmosClient.js    # Cosmos DB client
│   ├── slackClient.js     # Slack integration
│   ├── geminiClient.js    # Google Gemini AI
│   └── package.json
├── app/                    # React Frontend
│   ├── src/
│   │   ├── App.jsx        # Main application
│   │   ├── *View.jsx      # View components
│   │   ├── *Modal.jsx     # Modal components
│   │   └── locales/       # Translations (en/ja)
│   └── package.json
├── docs/                   # Documentation
├── .gitignore             # Git ignore rules
├── SECURITY.md            # Security guidelines
└── README.md              # This file
```

## 🔌 API Endpoints

### Tasks
- `GET /api/GetTasks` - Get all tasks
- `POST /api/CreateTask` - Create a new task
- `PUT /api/UpdateTask/{id}` - Update a task
- `DELETE /api/DeleteTask/{id}` - Delete a task

### Customers
- `GET /api/GetCustomers` - Get all customers
- `POST /api/CreateCustomer` - Create a customer
- `PUT /api/UpdateCustomer/{id}` - Update a customer
- `DELETE /api/DeleteCustomer/{id}` - Delete a customer
- `POST /api/AnalyzeCustomerDocument` - AI document analysis

### Invoices
- `GET /api/GetInvoices` - Get all invoices
- `POST /api/CreateInvoice` - Create an invoice
- `PUT /api/UpdateInvoice/{id}` - Update an invoice
- `DELETE /api/DeleteInvoice/{id}` - Delete an invoice

### Slack Integration
- `POST /api/SlackCommand` - Handle `/task` slash command

See [API Documentation](./docs/API.md) for detailed endpoint documentation.

## 🔐 Security

**CRITICAL**: This project handles sensitive information. Please read [SECURITY.md](./SECURITY.md) carefully.

- Never commit `local.settings.json` or `.env` files
- Use Azure Key Vault for production secrets
- Rotate credentials regularly
- Implement proper authentication and authorization

## 🌐 Slack Integration

See [docs/SlackIntegration.md](./docs/SlackIntegration.md) for setup instructions.

Features:
- Automatic notifications when tasks are created or status changes
- `/task` slash command to create/update tasks from Slack

## 🧪 Testing

```bash
# Backend tests
cd api
npm test

# Frontend tests
cd app
npm test
```

## 📝 License

Internal use only - LIST Sotheby's International Realty

## 👥 Contributors

- Development Team - LIST Sotheby's International Realty

## 📧 Support

For issues or questions, contact the development team.
