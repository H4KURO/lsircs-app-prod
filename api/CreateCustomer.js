const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");
const { v4: uuidv4 } = require("uuid");

// データベース接続情報
const connectionString = process.env.CosmosDbConnectionString;
const client = new CosmosClient(connectionString);
const databaseId = "lsircs-database";
const containerId = "Customers"; // コンテナー名をCustomersに変更

app.http('CreateCustomer', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const customerData = await request.json();

            // 顧客名のデータがあるかチェック
            if (!customerData.name) {
                return { status: 400, body: "Customer name is required." };
            }

            // 保存する新しい顧客オブジェクトを作成
            const newCustomer = {
                id: uuidv4(),
                name: customerData.name, // 顧客名
                property: customerData.property || "", // 所有物件
                price: customerData.price || 0, // 購入価格
                担当者: customerData.担当者 || "", // 担当者
                createdAt: new Date().toISOString()
            };

            const database = client.database(databaseId);
            const container = database.container(containerId);

            // 新しい顧客データをデータベースに保存
            const { resource: createdItem } = await container.items.create(newCustomer);

            return { status: 201, jsonBody: createdItem };

        } catch (error) {
            context.error("Error creating customer:", error);
            return { status: 500, body: "Error creating customer." };
        }
    }
});