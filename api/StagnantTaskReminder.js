const { app } = require('@azure/functions');
const { getNamedContainer, ensureNamedContainer } = require('./cosmosClient');
const { usersContainer } = require('./userProfileStore');

const n8nSecretKey = process.env.N8N_SECRET_KEY;
const STAGNANT_DAYS = 7;

const tasksContainer = () =>
  getNamedContainer('Tasks', ['COSMOS_TASKS_CONTAINER', 'CosmosTasksContainer']);

function getLastStatusChangedAt(task) {
  if (Array.isArray(task.statusHistory) && task.statusHistory.length > 0) {
    return task.statusHistory[task.statusHistory.length - 1].changedAt;
  }
  return task.createdAt || null;
}

function daysSince(isoString) {
  if (!isoString) return 0;
  return Math.floor((Date.now() - new Date(isoString).getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function getLastComment(task) {
  if (!Array.isArray(task.comments) || task.comments.length === 0) return null;
  return task.comments[task.comments.length - 1];
}

function buildHtmlEmail(creatorName, tasks, reportDate) {
  const taskRows = tasks.map(({ task, days, lastChangedAt }) => {
    const lastComment = getLastComment(task);
    const recentUpdateHtml = lastComment
      ? `<div class="recent-update">
          <div class="recent-update-label">Recent Update</div>
          ${escapeHtml(lastComment.text || '')}
        </div>`
      : '';

    return `
    <div class="task-row">
      <div class="task-top">
        <div class="task-title">${escapeHtml(task.title || '(No title)')}</div>
        <span class="days-badge">${days} days</span>
      </div>
      ${recentUpdateHtml}
      <div class="task-bottom">Last updated: ${formatDate(lastChangedAt)}</div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root {
    --bg: #F3F4F6;
    --card: #FFFFFF;
    --text: #111827;
    --text-sub: #6B7280;
    --text-light: #9CA3AF;
    --border: #E5E7EB;
    --header-bg: #1F2937;
    --days-color: #B45309;
    --days-bg: #FEF3C7;
    --quote-border: #D1D5DB;
    --quote-bg: #F9FAFB;
    --footer-text: #9CA3AF;
    --divider: #F3F4F6;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: var(--text);
    padding: 32px 16px 48px;
  }
  .email-wrap {
    max-width: 560px;
    margin: 0 auto;
    background: var(--card);
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid var(--border);
  }
  .email-header {
    background: var(--header-bg);
    padding: 24px 28px;
  }
  .header-eyebrow {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.4);
    margin-bottom: 6px;
  }
  .header-title {
    font-size: 18px;
    font-weight: 700;
    color: #FFFFFF;
    margin-bottom: 4px;
  }
  .header-meta {
    font-size: 12px;
    color: rgba(255,255,255,0.45);
  }
  .intro {
    padding: 16px 28px;
    font-size: 13px;
    color: var(--text-sub);
    border-bottom: 1px solid var(--border);
    line-height: 1.6;
  }
  .task-list { padding: 0 28px; }
  .task-row {
    padding: 20px 0;
    border-bottom: 1px solid var(--divider);
  }
  .task-row:last-child { border-bottom: none; }
  .task-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }
  .task-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    line-height: 1.4;
    flex: 1;
  }
  .days-badge {
    font-size: 12px;
    font-weight: 700;
    color: var(--days-color);
    background: var(--days-bg);
    padding: 2px 8px;
    border-radius: 3px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .recent-update {
    font-size: 12px;
    color: var(--text-sub);
    line-height: 1.6;
    padding: 8px 10px;
    background: var(--quote-bg);
    border-left: 2px solid var(--quote-border);
    border-radius: 0 3px 3px 0;
    margin-bottom: 8px;
  }
  .recent-update-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-light);
    margin-bottom: 3px;
  }
  .task-bottom {
    font-size: 11px;
    color: var(--text-light);
  }
  .email-footer {
    padding: 16px 28px;
    border-top: 1px solid var(--border);
    background: var(--quote-bg);
  }
  .footer-text {
    font-size: 11px;
    color: var(--footer-text);
    line-height: 1.7;
    text-align: center;
  }
</style>
</head>
<body>
<div class="email-wrap">
  <div class="email-header">
    <div class="header-eyebrow">lsir-cs · Automated Report</div>
    <div class="header-title">Stagnant Task Weekly Report</div>
    <div class="header-meta">${reportDate} &nbsp;·&nbsp; ${tasks.length} tasks</div>
  </div>
  <div class="intro">
    The following tasks have <strong>had no status change for 7 or more days</strong>. Please review each task and update its status as needed.
  </div>
  <div class="task-list">
    ${taskRows}
  </div>
  <div class="email-footer">
    <div class="footer-text">
      This report is automatically sent every Monday by lsir-cs.<br>
      Tasks whose status has been updated will be excluded from future reports.
    </div>
  </div>
</div>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// POST /api/StagnantTaskReminder
// Header: x-n8n-secret-key
// Body (optional): { defaultEmail: "admin@example.com" }
// Response: { recipients: [{ name, email, taskCount, html, tasks: [...] }] }
app.http('StagnantTaskReminder', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const secret = request.headers.get('x-n8n-secret-key');
    if (!n8nSecretKey || secret !== n8nSecretKey) {
      return { status: 401, body: 'Unauthorized' };
    }

    let defaultEmail = null;
    let groupBy = 'creator';
    try {
      const body = await request.json();
      if (body?.defaultEmail) defaultEmail = body.defaultEmail;
      if (body?.groupBy === 'assignee') groupBy = 'assignee';
    } catch { /* body省略可 */ }

    try {
      // タスク全件取得
      const container = tasksContainer();
      const { resources: allTasks } = await container.items.readAll().fetchAll();

      const reportDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
      });

      // 停滞タスク抽出（Done 除外、7日以上変更なし）
      const stagnant = allTasks
        .filter(task => task.status !== 'Done' && task.status !== 'done')
        .map(task => {
          const lastChangedAt = getLastStatusChangedAt(task);
          const days = daysSince(lastChangedAt);
          return { task, lastChangedAt, days };
        })
        .filter(({ days }) => days >= STAGNANT_DAYS)
        .sort((a, b) => b.days - a.days);

      if (stagnant.length === 0) {
        return { status: 200, jsonBody: { recipients: [], stagnantCount: 0 } };
      }

      // ホワイトリスト: email(小文字) → { email, displayName }
      const allowedContainer = await ensureNamedContainer('AllowedUsers', { partitionKey: '/id' });
      const { resources: allowedUsers } = await allowedContainer.items.readAll().fetchAll();
      const infoByEmail = new Map();
      for (const u of allowedUsers) {
        if (u.email) {
          infoByEmail.set(u.email.toLowerCase(), {
            email: u.email,
            displayName: u.name || u.email,
          });
        }
      }

      // Users コンテナ: userId → { email, displayName }
      let infoByUserId = new Map();
      try {
        const uContainer = await usersContainer();
        const { resources: userProfiles } = await uContainer.items.readAll().fetchAll();
        for (const u of userProfiles) {
          const uid = u.userId || u.id;
          const email = u.userDetails || '';
          if (uid) {
            infoByUserId.set(uid, {
              email,
              displayName: u.displayName || email,
            });
          }
        }
      } catch (e) {
        context.log('Users container lookup failed (non-fatal)', e.message);
      }

      // タスクごとに送信先メールを解決してグループ化
      const byEmail = new Map();

      function addToGroup(emailKey, resolvedEmail, resolvedName, item) {
        const key = emailKey || defaultEmail || '__unknown__';
        if (!byEmail.has(key)) {
          byEmail.set(key, { email: resolvedEmail, name: resolvedName, items: [] });
        }
        byEmail.get(key).items.push(item);
      }

      for (const item of stagnant) {
        if (groupBy === 'assignee') {
          // 担当者（assignees）ごとにグループ化
          const assignees = Array.isArray(item.task.assignees) ? item.task.assignees : [];
          if (assignees.length === 0) {
            addToGroup(null, null, null, item);
          } else {
            for (const assigneeEmail of assignees) {
              if (!assigneeEmail) continue;
              const info = infoByEmail.get(assigneeEmail.toLowerCase());
              const resolvedEmail = info?.email || assigneeEmail;
              const resolvedName  = info?.displayName || assigneeEmail;
              addToGroup(resolvedEmail, resolvedEmail, resolvedName, item);
            }
          }
        } else {
          // createdByName = userDetails = メールアドレス（新しいタスク）
          // createdById  = userId（createdByName が空の古いタスク用フォールバック）
          let resolvedEmail = null;
          let resolvedName = null;

          const byName = item.task.createdByName;
          if (byName) {
            const info = infoByEmail.get(byName.toLowerCase());
            resolvedEmail = info?.email || byName;
            resolvedName  = info?.displayName || byName;
          } else if (item.task.createdById) {
            const info = infoByUserId.get(item.task.createdById);
            if (info?.email) {
              const wlInfo = infoByEmail.get(info.email.toLowerCase());
              resolvedEmail = wlInfo?.email || info.email;
              resolvedName  = wlInfo?.displayName || info.displayName || info.email;
            }
          }

          addToGroup(resolvedEmail, resolvedEmail, resolvedName, item);
        }
      }

      // レスポンス組み立て
      const recipients = [];
      for (const [key, { email, name, items }] of byEmail) {
        // defaultEmail に集約されたもの、または email 不明のものを処理
        const finalEmail = email || (key !== '__unknown__' ? key : null) || defaultEmail;
        const finalName  = name || finalEmail || '(Unknown)';
        const html = buildHtmlEmail(finalName, items, reportDate);
        recipients.push({
          name: finalName,
          email: finalEmail,
          taskCount: items.length,
          html,
          tasks: items.map(({ task, days, lastChangedAt }) => ({
            id: task.id,
            title: task.title,
            status: task.status,
            category: task.category,
            days,
            lastChangedAt,
          })),
        });
      }

      context.log(`StagnantTaskReminder: ${stagnant.length} stagnant tasks, ${recipients.length} recipients`);

      return {
        status: 200,
        jsonBody: {
          reportDate,
          stagnantCount: stagnant.length,
          recipients,
        },
      };
    } catch (error) {
      context.log('StagnantTaskReminder failed', error);
      return { status: 500, body: `Error: ${error.message}` };
    }
  },
});
