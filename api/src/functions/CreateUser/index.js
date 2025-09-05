// Azure Cosmos DB SDKをインポートします。
// このSDKは、api/package.jsonに "@azure/cosmos" として追加する必要があります。
const { CosmosClient } = require("@azure/cosmos");

// Cosmos DBへの接続情報
// process.env.CosmosDBConnectionString は、Azure Portalの「構成」で設定した環境変数の名前です。
const connectionString = process.env.CosmosDBConnectionString;
const client = new CosmosClient(connectionString);

// リポジトリで指定されているデータベース名とコンテナー名
const databaseId = "lsircs-database";
const containerId = "User";

/**
 * 新しいユーザーをCosmos DBのUserコンテナーに作成するAPIです。
 * HTTP POSTリクエストで呼び出されることを想定しています。
 */
module.exports = async function (context, req) {
    context.log('CreateUser APIが呼び出されました。');

    // 1. リクエストのボディから新しいユーザー情報を取得します。
    const { name, email, role } = req.body;

    // 2. 必須項目が入力されているかチェックします。
    if (!name || !email) {
        context.res = {
            status: 400, // Bad Request
            body: { message: "名前とメールアドレスは必須項目です。" }
        };
        return;
    }

    try {
        // 3. データベースに保存する新しいユーザーオブジェクトを作成します。
        // Cosmos DBでは、各項目に一意のidを付与することが推奨されます。
        // ここではメールアドレスをIDとして使用し、ユーザーの一意性を担保します。
        const newUserDocument = {
            id: email,
            name: name,
            email: email,
            // roleが指定されていない場合は、デフォルトで 'member' ロールを付与します。
            role: role || 'member',
            createdAt: new Date().toISOString()
        };
        
        // 4. データベースとコンテナーへの参照を取得します。
        const database = client.database(databaseId);
        const container = database.container(containerId);

        // 5. コンテナーに新しい項目(ドキュメント)を作成します。
        const { resource: createdItem } = await container.items.create(newUserDocument);

        context.log(`ユーザーが正常に作成されました。ID: ${createdItem.id}`);

        // 6. 成功レスポンスを返します。
        context.res = {
            status: 201, // Created
            body: createdItem
        };

    } catch (error) {
        // 7. エラーハンドリング
        // もし同じID(email)のドキュメントが既に存在する場合は、Cosmos DBはエラーコード409を返します。
        if (error.code === 409) {
             context.res = {
                status: 409, // Conflict
                body: { message: "このメールアドレスは既に使用されています。" }
            };
        } else {
            // その他の予期せぬエラーの場合
            context.log.error('ユーザー作成中にエラーが発生しました:', error);
            context.res = {
                status: 500, // Internal Server Error
                body: { message: "サーバーエラーにより、ユーザーの作成に失敗しました。" }
            };
        }
    }
};

