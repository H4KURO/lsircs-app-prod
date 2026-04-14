const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');
const { getBatchCellValues, getSheetDataRow } = require('./sheetsClient');

const tasksContainer = () =>
  getNamedContainer('Tasks', ['COSMOS_TASKS_CONTAINER', 'CosmosTasksContainer']);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

// GET /api/GetBuyerSyncStatus?taskId=xxx
// タスクを開いたとき、バイヤーリンク付きサブタスクの完了状態をSheetsから読み込む
// Returns: { [subtaskId]: boolean }
app.http('GetBuyerSyncStatus', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) return { status: 401, body: 'Unauthorized' };

    const taskId = request.query.get('taskId');
    if (!taskId) return { status: 400, body: 'taskId is required.' };

    try {
      const container = tasksContainer();
      const { resource: task } = await container.item(taskId, taskId).read();
      if (!task) return { status: 404, body: 'Task not found.' };

      // sheetsSyncが未設定なら空を返す
      const sheetsSync = task.sheetsSync;
      if (!sheetsSync?.column) {
        return { status: 200, jsonBody: {} };
      }

      // buyerLinkがあるサブタスクのみ対象
      const linkedSubtasks = (task.subtasks || []).filter(
        (s) => s.buyerLink?.sheetName && s.buyerLink?.rowIndex != null,
      );
      if (linkedSubtasks.length === 0) {
        return { status: 200, jsonBody: {} };
      }

      // バッチでセル値を取得
      const ranges = linkedSubtasks.map((s) => {
        const sheetRow = getSheetDataRow(s.buyerLink.sheetName, s.buyerLink.rowIndex);
        return `'${s.buyerLink.sheetName}'!${sheetsSync.column}${sheetRow}`;
      });

      const valueRanges = await getBatchCellValues(ranges);
      const completionValue = sheetsSync.completionValue || '〇';

      const result = {};
      linkedSubtasks.forEach((s, i) => {
        const raw = valueRanges[i]?.values?.[0]?.[0];
        result[s.id] = raw != null && String(raw).trim() === completionValue;
      });

      context.log(
        `GetBuyerSyncStatus: taskId=${taskId}, checked ${linkedSubtasks.length} buyers`,
      );
      return { status: 200, jsonBody: result };
    } catch (error) {
      context.log('GetBuyerSyncStatus failed', error);
      return { status: 500, body: `Error: ${error.message}` };
    }
  },
});
