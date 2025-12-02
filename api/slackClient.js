const axios = require('axios');

const slackBotToken = process.env.SLACK_BOT_TOKEN;
const defaultChannel = process.env.SLACK_CHANNEL_ID;
const slackThreadTs = process.env.SLACK_THREAD_TS || null;
const weeklyChannelOverride = process.env.SLACK_WEEKLY_CHANNEL_ID || defaultChannel;
const weeklyThreadTs = process.env.SLACK_WEEKLY_THREAD_TS || null;
const appBaseUrl = process.env.APP_BASE_URL || null;
const SLACK_ENABLED = Boolean(slackBotToken && defaultChannel);

const formatDate = (iso) => {
  if (!iso) {
    return null;
  }
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return iso;
    }
    return date.toISOString().split('T')[0];
  } catch (error) {
    return iso;
  }
};

const formatAssignees = (assignees) => {
  if (!Array.isArray(assignees) || assignees.length === 0) {
    return 'Assignees: none';
  }
  return `Assignees: ${assignees.join(', ')}`;
};

const resolveUsername = (name, fallback) => {
  if (typeof name === 'string' && name.trim()) {
    return name.trim();
  }
  if (typeof fallback === 'string' && fallback.trim()) {
    return fallback.trim();
  }
  return 'Unknown user';
};

const buildTaskLink = (taskId) => {
  if (!appBaseUrl) {
    return null;
  }
  try {
    const url = new URL(appBaseUrl);
    url.searchParams.set('view', 'tasks');
    if (taskId) {
      url.searchParams.set('taskId', taskId);
    }
    return url.toString();
  } catch (error) {
    return null;
  }
};

const buildWeeklyReportLink = (reportDate) => {
  if (!appBaseUrl) {
    return null;
  }
  try {
    const url = new URL(appBaseUrl);
    url.searchParams.set('view', 'weeklyReports');
    if (reportDate) {
      url.searchParams.set('reportDate', reportDate);
    }
    return url.toString();
  } catch (error) {
    return null;
  }
};

const formatCurrencyValue = (value) => {
  if (value == null) {
    return '—';
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }
  return numeric.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const buildWeeklyOverrides = (metadata = {}) => ({
  ...metadata,
  channel: metadata.channel || weeklyChannelOverride,
  threadTs: metadata.threadTs || weeklyThreadTs,
});

async function postToSlack(payload, context, overrides = {}) {
  if (!SLACK_ENABLED) {
    return false;
  }

  const body = {
    channel: overrides.channel || defaultChannel,
    text: payload.text,
    blocks: payload.blocks,
  };

  const thread = overrides.threadTs || slackThreadTs;
  if (thread) {
    body.thread_ts = thread;
  }

  try {
    const { data } = await axios.post('https://slack.com/api/chat.postMessage', body, {
      headers: {
        Authorization: `Bearer ${slackBotToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      timeout: 5000,
    });

    if (!data?.ok) {
      context?.log?.('Slack API error', data);
      return false;
    }

    return true;
  } catch (error) {
    context?.log?.('Slack API request failed', error?.response?.data || error.message);
    return false;
  }
}

function buildTaskBlocks({ title, description, status, priority, category, tags, deadline, assignees }) {
  const fields = [];

  if (status) {
    fields.push({ type: 'mrkdwn', text: `*Status*: ${status}` });
  }
  if (priority) {
    fields.push({ type: 'mrkdwn', text: `*Priority*: ${priority}` });
  }
  if (category) {
    fields.push({ type: 'mrkdwn', text: `*Category*: ${category}` });
  }
  if (Array.isArray(tags) && tags.length > 0) {
    fields.push({ type: 'mrkdwn', text: `*Tags*: ${tags.join(', ')}` });
  }
  const deadlineLabel = formatDate(deadline);
  if (deadlineLabel) {
    fields.push({ type: 'mrkdwn', text: `*Due*: ${deadlineLabel}` });
  }

  fields.push({ type: 'mrkdwn', text: `*${formatAssignees(assignees)}*` });

  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: title || 'Untitled task' } },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: description && description.trim().length > 0 ? description.trim() : 'No description provided.',
      },
    },
  ];

  if (fields.length > 0) {
    blocks.push({ type: 'section', fields });
  }

  return blocks;
}

async function notifyTaskCreated(task, context, metadata = {}) {
  if (!SLACK_ENABLED) {
    return false;
  }

  const creator = resolveUsername(task.createdByName, metadata.actorName);
  const text = `:sparkles: Task created - ${task.title || 'Untitled task'} (by ${creator})`;
  const blocks = buildTaskBlocks(task);

  blocks.unshift({
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: `Created by: *${creator}*` },
      { type: 'mrkdwn', text: `Task ID: ${task.id}` },
    ],
  });

  const taskLink = buildTaskLink(task.id);
  if (taskLink) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open task' },
          url: taskLink,
          style: 'primary',
        },
      ],
    });
  }

  return postToSlack({ text, blocks }, context, metadata);
}

async function notifyTaskStatusChanged(task, previousStatus, context, metadata = {}) {
  if (!SLACK_ENABLED) {
    return false;
  }

  const actor = resolveUsername(metadata.actorName, task.lastUpdatedByName);
  const text = `:arrows_clockwise: Task status updated - ${task.title || 'Untitled task'} (by ${actor})`;

  const blocks = buildTaskBlocks(task);

  blocks.unshift({
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: `Updated by: *${actor}*` },
      { type: 'mrkdwn', text: `Status: ${previousStatus || 'n/a'} -> ${task.status || 'n/a'}` },
      { type: 'mrkdwn', text: `Task ID: ${task.id}` },
    ],
  });

  const taskLink = buildTaskLink(task.id);
  if (taskLink) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open task' },
          url: taskLink,
        },
      ],
    });
  }

  return postToSlack({ text, blocks }, context, metadata);
}

function buildWeeklyReportBlocks(record) {
  const fields = [
    { type: 'mrkdwn', text: `*Unit*: ${record.unit || 'n/a'}` },
    { type: 'mrkdwn', text: `*Report*: ${record.reportDate || 'n/a'}` },
  ];

  if (record.lastRent != null) {
    fields.push({ type: 'mrkdwn', text: `*Last Rent*: ¥${formatCurrencyValue(record.lastRent)}` });
  }
  if (record.newRent != null) {
    fields.push({ type: 'mrkdwn', text: `*New Rent*: ¥${formatCurrencyValue(record.newRent)}` });
  }
  if (record.nextMoveIn) {
    fields.push({ type: 'mrkdwn', text: `*Next Move In*: ${formatDate(record.nextMoveIn)}` });
  }
  if (record.status) {
    fields.push({ type: 'mrkdwn', text: `*Status*: ${record.status}` });
  }
  if (record.assigneeName) {
    fields.push({ type: 'mrkdwn', text: `*Assignee*: ${record.assigneeName}` });
  }
  if (record.taskTitle) {
    fields.push({ type: 'mrkdwn', text: `*Task*: ${record.taskTitle}` });
  }
  if (record.memo) {
    fields.push({ type: 'mrkdwn', text: `*Memo*: ${record.memo}` });
  }

  return [{ type: 'section', fields }];
}

async function notifyWeeklyReportRowAdded(record, context, metadata = {}) {
  if (!SLACK_ENABLED) {
    return false;
  }
  const actor = resolveUsername(metadata.actorName, 'System');
  const text = `:inbox_tray: Weekly report row added for ${record.unit || 'n/a'} (${record.reportDate})`;
  const blocks = buildWeeklyReportBlocks(record);
  blocks.unshift({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `Added by *${actor}*` }],
  });

  const link = buildWeeklyReportLink(record.reportDate);
  if (link) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open report' },
          url: link,
        },
      ],
    });
  }

  return postToSlack({ text, blocks }, context, buildWeeklyOverrides(metadata));
}

async function notifyWeeklyReportRowUpdated(record, context, metadata = {}) {
  if (!SLACK_ENABLED) {
    return false;
  }
  const actor = resolveUsername(metadata.actorName, 'System');
  const text = `:pencil2: Weekly report row updated for ${record.unit || 'n/a'} (${record.reportDate})`;
  const blocks = buildWeeklyReportBlocks(record);
  blocks.unshift({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `Updated by *${actor}*` }],
  });

  const link = buildWeeklyReportLink(record.reportDate);
  if (link) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open report' },
          url: link,
        },
      ],
    });
  }

  return postToSlack({ text, blocks }, context, buildWeeklyOverrides(metadata));
}

async function notifyWeeklyReportRowDeleted(record, context, metadata = {}) {
  if (!SLACK_ENABLED) {
    return false;
  }
  const actor = resolveUsername(metadata.actorName, 'System');
  const text = `:wastebasket: Weekly report row deleted for ${record.unit || 'n/a'} (${record.reportDate})`;
  const blocks = buildWeeklyReportBlocks(record);
  blocks.unshift({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `Deleted by *${actor}*` }],
  });
  return postToSlack({ text, blocks }, context, buildWeeklyOverrides(metadata));
}

module.exports = {
  notifyTaskCreated,
  notifyTaskStatusChanged,
  buildTaskLink,
  notifyWeeklyReportRowAdded,
  notifyWeeklyReportRowUpdated,
  notifyWeeklyReportRowDeleted,
  SLACK_ENABLED,
};
