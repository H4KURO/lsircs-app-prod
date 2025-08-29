const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");
const { v4: uuidv4 } = require("uuid");

// データベース接続情報
const connectionString = process.env.CosmosDbConnectionString;
const client = new CosmosClient(connectionString);
const databaseId = "lsircs-database";
const containerId = "Invoices";

app.http('CreateInvoice', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const invoiceData = await request.json();

            // 必須データ（customerIdとamount）があるかチェック
            if (!invoiceData.customerId || !invoiceData.amount) {
                return { status: 400, body: "Customer ID and amount are required." };
            }

            // 保存する新しい請求書オブジェクトを作成
            const newInvoice = {
                id: uuidv4(),
                customerId: invoiceData.customerId, // どの顧客の請求書か
                amount: invoiceData.amount, // 金額
                status: invoiceData.status || "draft", // ステータス (例: draft, sent, paid)
                issueDate: new Date().toISOString(), // 発行日
                dueDate: invoiceData.dueDate || null // 支払期日
            };

            const database = client.database(databaseId);
            const container = database.container(containerId);
            const { resource: createdItem } = await container.items.create(newInvoice);

            return { status: 201, jsonBody: createdItem };

        } catch (error) {
            context.error("Error creating invoice:", error);
            return { status: 500, body: "Error creating invoice." };
        }
    }
});