const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');
const { usersContainer } = require('./userProfileStore');
const axios = require('axios');

const slackBotToken = process.env.SLACK_BOT_TOKEN;
const appBaseUrl = process.env.APP_BASE_URL || null;

// Days ahead to send reminders
const REMINDER_DAYS = [0, 1, 3, 7];

function dayLabel(daysAhead) {
  if (daysAhead === 0) return 'Today';
  if (daysAhead === 1) return 'Tomorrow (1 day left)';
  return `In ${daysAhead} days`;
}

function urgencyEmoji(daysAhead) {
  if (daysAhead === 0) return '🚨';
  if (daysAhead === 1) return '⚠️';
  if (daysAhead === 3) return '⏰';
  return '📅';
}

function buildTaskLink(taskId) {
  if (!appBaseUrl || !taskId) return null;
  try {
    const url = new URL(appBaseUrl);
    url.searchParams.set('view', 'tasks');
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
    }
  );
  if (!data?.ok) throw new Error(`conversations.open failed: ${data?.error}`);
  return data.channel.id;
}

async function sendSlackDm(channelId, text, blocks) {
  const { data } = await axios.post(
    'https://slack.com/api/chat.postMessage',
    { channel: channelId, text, blocks },
    {
      headers: {
        Authorization: `Bearer ${slackBotToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      timeout: 5000,
    }
  );
  return data?.ok || false;
}

app.http('TaskDeadlineReminder', {
  methods: ['POST', 'GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (!slackBotToken) {
      return { status: 503, body: 'SLACK_BOT_TOKEN is not configured' };
    }

    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      // Build a map: deadline date string -> days ahead from today
      const targetDateMap = {};
      for (const d of REMINDER_DAYS) {
        const target = new Date(today);
        target.setDate(target.getDate() + d);
        targetDateMap[target.toISOString().split('T')[0]] = d;
      }

      // Fetch non-Done tasks that have a deadline
      const tasksContainer = getNamedContainer('Tasks', ['COSMOS_TASKS_CONTAINER']);
      const { resources: allTasks } = await tasksContainer.items
        .query({
          query: `SELECT c.id, c.title, c.deadline, c.status, c.assignees, c.assignee
                  FROM c
                  WHERE c.status != 'Done'
                    AND IS_DEFINED(c.deadline)
                    AND c.deadline != null`,
        })
        .fetchAll();

      // Keep only tasks whose deadline falls on one of our target dates
      const matchingTasks = allTasks.filter((t) => {
        if (!t.deadline) return false;
        return (t.deadline.split('T')[0]) in targetDateMap;
      });

      if (matchingTasks.length === 0) {
        return {
          status: 200,
          jsonBody: { date: todayStr, sent: 0, message: 'No upcoming deadlines today' },
        };
      }

      // Load Slack member IDs keyed by displayName (which equals email)
      const usersCol = await usersContainer();
      const { resources: userProfiles } = await usersCol.items
        .query({
          query: 'SELECT c.displayName, c.slackMemberId FROM c WHERE IS_DEFINED(c.slackMemberId)',
        })
        .fetchAll();
      const slackIdByName = {};
      for (const u of userProfiles) {
        if (u.displayName && u.slackMemberId) {
          slackIdByName[u.displayName] = u.slackMemberId;
        }
      }

      // Group tasks by assignee name
      const tasksByAssignee = {};
      for (const task of matchingTasks) {
        const assignees =
          Array.isArray(task.assignees) && task.assignees.length > 0
            ? task.assignees
            : task.assignee
            ? [task.assignee]
            : [];

        for (const assignee of assignees) {
          if (!tasksByAssignee[assignee]) tasksByAssignee[assignee] = [];
          tasksByAssignee[assignee].push(task);
        }
      }

      let totalSent = 0;
      let totalSkipped = 0;
      const results = [];

      for (const [assignee, tasks] of Object.entries(tasksByAssignee)) {
        const slackMemberId = slackIdByName[assignee];

        if (!slackMemberId) {
          context.log(`[TaskDeadlineReminder] No Slack ID for: ${assignee}`);
          totalSkipped++;
          results.push({ assignee, method: 'skipped', reason: 'no_slack_id', tasks: tasks.length });
          continue;
        }

        // Sort tasks by urgency (soonest deadline first)
        tasks.sort((a, b) => a.deadline.localeCompare(b.deadline));

        const taskLines = tasks.map((t) => {
          const daysAhead = targetDateMap[t.deadline.split('T')[0]];
          const emoji = urgencyEmoji(daysAhead);
          const label = dayLabel(daysAhead);
          const link = buildTaskLink(t.id);
          const titleText = link ? `<${link}|${t.title || 'Untitled'}>` : (t.title || 'Untitled');
          return `${emoji} *${label}* — ${titleText}`;
        });

        const text = `⏰ Task deadline reminder — you have ${tasks.length} task(s) coming up`;
        const blocks = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `⏰ *Task Deadline Reminder*\nYou have *${tasks.length}* task(s) with upcoming deadlines:`,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: taskLines.join('\n'),
            },
          },
          {
            type: 'context',
            elements: [
              { type: 'mrkdwn', text: `Sent: ${todayStr}` },
            ],
          },
        ];

        try {
          const dmChannelId = await openDmChannel(slackMemberId);
          const ok = await sendSlackDm(dmChannelId, text, blocks);
          results.push({ assignee, method: 'dm', ok, tasks: tasks.length });
          if (ok) totalSent++;
          else {
            totalSkipped++;
            context.log(`[TaskDeadlineReminder] chat.postMessage failed for: ${assignee}`);
          }
        } catch (err) {
          context.log(`[TaskDeadlineReminder] Error sending DM to ${assignee}:`, err.message);
          results.push({ assignee, method: 'error', error: err.message, tasks: tasks.length });
          totalSkipped++;
        }
      }

      return {
        status: 200,
        jsonBody: {
          date: todayStr,
          matchingTasks: matchingTasks.length,
          assignees: Object.keys(tasksByAssignee).length,
          sent: totalSent,
          skipped: totalSkipped,
          results,
        },
      };
    } catch (error) {
      context.log('[TaskDeadlineReminder] Error:', error);
      return { status: 500, body: error.message || 'Internal server error' };
    }
  },
});
