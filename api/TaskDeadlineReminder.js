const { app } = require('@azure/functions');
const axios = require('axios');
const { getNamedContainer } = require('./cosmosClient');
const { usersContainer } = require('./userProfileStore');

const slackBotToken = process.env.SLACK_BOT_TOKEN;
const n8nSecretKey = process.env.N8N_SECRET_KEY;
const appBaseUrl = process.env.APP_BASE_URL || null;

const REMINDER_DAYS = [7, 3, 1, 0];

function daysUntilDeadline(deadlineIso) {
  if (!deadlineIso) return null;
  try {
    const deadline = new Date(deadlineIso);
    if (Number.isNaN(deadline.getTime())) return null;
    const now = new Date();
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
    return Math.floor((deadlineDate - nowDate) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

function buildTaskLink(taskId) {
  if (!appBaseUrl || !taskId) return null;
  try {
    const url = new URL(appBaseUrl);
    // Always use origin root to guarantee Azure SWA serves index.html
    // (any path component in APP_BASE_URL would route to /api and return 404)
    // Use /tasks path (no static file exists there) so Azure SWA's
    // navigationFallback reliably rewrites to index.html.
    // Root path / with query params causes Azure SWA to return 404.
    url.pathname = '/tasks';
    url.search = '';
    url.hash = '';
    url.searchParams.set('taskId', taskId);
    return url.toString();
  } catch {
    return null;
  }
}

async function openDmChannel(slackMemberId) {
  const { data } = await axios.post(
    'https://slack.com/api/conversations.open',
    { users: slackMemberId },
    {
      headers: {
        Authorization: `Bearer ${slackBotToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    },
  );
  if (!data?.ok) throw new Error(`conversations.open failed: ${data?.error}`);
  return data.channel.id;
}

async function postDm(channelId, text, blocks) {
  const { data } = await axios.post(
    'https://slack.com/api/chat.postMessage',
    { channel: channelId, text, blocks },
    {
      headers: {
        Authorization: `Bearer ${slackBotToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      timeout: 5000,
    },
  );
  return Boolean(data?.ok);
}

// POST /api/TaskDeadlineReminder
// Header: x-n8n-secret-key
// Sends Slack DMs to each task assignee when deadline is 7, 3, 1 days away or today.
app.http('TaskDeadlineReminder', {
  methods: ['POST', 'GET'],
  authLevel: 'anonymous',
  route: 'TaskDeadlineReminder',
  handler: async (request, context) => {
    const secret = request.headers.get('x-n8n-secret-key');
    if (n8nSecretKey && secret !== n8nSecretKey) {
      return { status: 401, body: 'Unauthorized' };
    }

    if (!slackBotToken) {
      return { status: 200, jsonBody: { ok: true, message: 'SLACK_BOT_TOKEN not configured, skipped' } };
    }

    try {
      const tasksContainer = getNamedContainer('Tasks', ['COSMOS_TASKS_CONTAINER', 'CosmosTasksContainer']);
      const { resources: allTasks } = await tasksContainer.items
        .query({
          query: `SELECT c.id, c.title, c.deadline, c.assignees, c.status
                  FROM c
                  WHERE c.status != "Done"
                    AND c.status != "done"
                    AND c.status != "Completed"
                    AND IS_DEFINED(c.deadline)
                    AND c.deadline != null`,
        })
        .fetchAll();

      const reminderTasks = allTasks
        .map(task => ({ task, days: daysUntilDeadline(task.deadline) }))
        .filter(({ days }) => days !== null && REMINDER_DAYS.includes(days));

      context.log(`TaskDeadlineReminder: ${allTasks.length} active tasks, ${reminderTasks.length} need reminders`);

      if (reminderTasks.length === 0) {
        return { status: 200, jsonBody: { ok: true, sent: 0, message: 'No deadline reminders needed today' } };
      }

      const uContainer = await usersContainer();
      const { resources: userProfiles } = await uContainer.items
        .query({ query: 'SELECT c.displayName, c.userDetails, c.slackMemberId FROM c WHERE IS_DEFINED(c.slackMemberId)' })
        .fetchAll();

      const slackIdByName = new Map();
      for (const u of userProfiles) {
        if (!u.slackMemberId) continue;
        if (u.displayName) slackIdByName.set(u.displayName, u.slackMemberId);
        if (u.userDetails) slackIdByName.set(u.userDetails, u.slackMemberId);
      }

      let totalSent = 0;
      let totalFailed = 0;
      const results = [];

      for (const { task, days } of reminderTasks) {
        const assignees = Array.isArray(task.assignees) ? task.assignees : [];
        const deadline = task.deadline ? task.deadline.split('T')[0] : '期限未設定';
        const taskLink = buildTaskLink(task.id);

        const urgencyLabel = days === 0 ? '今日が期限です' : `あと${days}日で期限`;
        const emoji = days === 0 ? '🔴' : days === 1 ? '🟠' : days === 3 ? '🟡' : '🔵';
        const text = `${emoji} タスク期限リマインダー: 「${task.title}」（${urgencyLabel}）`;

        const blocks = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${emoji} *タスク期限リマインダー*\n*<${taskLink || '#'}|${task.title}>*\n期限: *${deadline}*（${urgencyLabel}）`,
            },
          },
        ];
        if (taskLink) {
          blocks.push({
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'タスクを開く' },
                url: taskLink,
                style: 'primary',
              },
            ],
          });
        }

        for (const assigneeName of assignees) {
          if (!assigneeName) continue;
          const slackId = slackIdByName.get(assigneeName);
          if (!slackId) {
            context.log(`No slackMemberId for assignee: ${assigneeName}`);
            results.push({ task: task.title, assignee: assigneeName, days, status: 'no_slack_id' });
            continue;
          }
          try {
            const dmChannelId = await openDmChannel(slackId);
            const ok = await postDm(dmChannelId, text, blocks);
            totalSent += ok ? 1 : 0;
            totalFailed += ok ? 0 : 1;
            results.push({ task: task.title, assignee: assigneeName, days, status: ok ? 'sent' : 'slack_error' });
          } catch (err) {
            context.log(`DM failed for ${assigneeName}: ${err.message}`);
            totalFailed++;
            results.push({ task: task.title, assignee: assigneeName, days, status: 'error', error: err.message });
          }
        }
      }

      context.log(`TaskDeadlineReminder: ${totalSent} DMs sent, ${totalFailed} failed`);
      return {
        status: 200,
        jsonBody: { ok: true, sent: totalSent, failed: totalFailed, results },
      };
    } catch (error) {
      context.log('TaskDeadlineReminder error', error.message);
      return { status: 500, body: `Error: ${error.message}` };
    }
  },
});
