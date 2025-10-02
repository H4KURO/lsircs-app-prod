const axios = require('axios');

const slackBotToken = process.env.SLACK_BOT_TOKEN;
const defaultChannel = process.env.SLACK_CHANNEL_ID;
const slackThreadTs = process.env.SLACK_THREAD_TS || null;
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

  return postToSlack({ text, blocks }, context, metadata);
}

module.exports = {
  notifyTaskCreated,
  notifyTaskStatusChanged,
};
