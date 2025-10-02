const { app } = require('@azure/functions');
const crypto = require('crypto');
const querystring = require('querystring');
const { v4: uuidv4 } = require('uuid');
const { getNamedContainer } = require('./cosmosClient');
const { normalizeSubtasksInput } = require('./subtaskUtils');
const { normalizeAssigneesPayload, ensureAssigneesOnTask } = require('./assigneeUtils');
const { notifyTaskCreated, notifyTaskStatusChanged } = require('./slackClient');

const SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;
const ALLOWED_TEAM_ID = process.env.SLACK_ALLOWED_TEAM_ID || null;

const tasksContainer = () =>
  getNamedContainer('Tasks', ['COSMOS_TASKS_CONTAINER', 'CosmosTasksContainer']);

const STATUS_ALIASES = new Map([
  ['started', 'Started'],
  ['start', 'Started'],
  ['todo', 'Started'],
  ['inprogress', 'Inprogress'],
  ['in-progress', 'Inprogress'],
  ['progress', 'Inprogress'],
  ['doing', 'Inprogress'],
  ['done', 'Done'],
  ['complete', 'Done'],
  ['completed', 'Done'],
]);

const PRIORITY_ALIASES = new Map([
  ['low', 'Low'],
  ['medium', 'Medium'],
  ['med', 'Medium'],
  ['mid', 'Medium'],
  ['high', 'High'],
]);

const FIVE_MINUTES = 60 * 5;

const slackErrorResponse = (status, body) => ({
  status,
  body,
});

const slackMessage = (text, extra = {}) => ({
  status: 200,
  jsonBody: {
    response_type: 'ephemeral',
    text,
    ...extra,
  },
});

const timingSafeEqual = (a, b) => {
  if (a.length !== b.length) {
    return false;
  }
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
};

const verifySlackSignature = (request, rawBody, context) => {
  if (!SIGNING_SECRET) {
    context.log('Slack signing secret is not configured.');
    return false;
  }

  const timestamp = request.headers.get('x-slack-request-timestamp');
  const signature = request.headers.get('x-slack-signature');

  if (!timestamp || !signature) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > FIVE_MINUTES) {
    context.log('Slack request rejected due to timestamp skew.');
    return false;
  }

  const sigBase = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto.createHmac('sha256', SIGNING_SECRET);
  const computed = `v0=${hmac.update(sigBase).digest('hex')}`;

  return timingSafeEqual(computed, signature);
};

const parseFields = (segments = []) => {
  const fields = {};
  segments.forEach((segment) => {
    if (!segment) {
      return;
    }
    const index = segment.indexOf('=');
    if (index === -1) {
      return;
    }
    const key = segment.slice(0, index).trim().toLowerCase();
    let value = segment.slice(index + 1).trim();
    if (!key || !value) {
      return;
    }
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    fields[key] = value;
  });
  return fields;
};

const splitSegments = (input) => {
  if (!input) {
    return [];
  }
  if (input.includes('|')) {
    return input.split('|').map((part) => part.trim()).filter(Boolean);
  }
  return input.split(/\s+/).map((part) => part.trim()).filter(Boolean);
};

const parseCommand = (text) => {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    return null;
  }

  const firstSpace = trimmed.indexOf(' ');
  if (firstSpace === -1) {
    return { action: trimmed.toLowerCase() };
  }

  const action = trimmed.slice(0, firstSpace).toLowerCase();
  const remainder = trimmed.slice(firstSpace + 1).trim();

  if (action === 'add') {
    const segments = splitSegments(remainder);
    if (segments.length === 0) {
      return { action, error: 'Missing task title.' };
    }
    const title = segments.shift();
    const fields = parseFields(segments);
    return { action, title, fields };
  }

  if (action === 'update') {
    const segments = splitSegments(remainder);
    if (segments.length === 0) {
      return { action, error: 'Missing task id.' };
    }
    const taskId = segments.shift();
    const fields = parseFields(segments);
    return { action, taskId, fields };
  }

  if (action === 'help') {
    return { action: 'help' };
  }

  return { action, error: 'Unsupported command.' };
};

const parseList = (value) => {
  if (!value) {
    return [];
  }
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
};

const resolveStatus = (value) => {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  const direct = STATUS_ALIASES.get(normalized.toLowerCase()) || normalized;
  if (['Started', 'Inprogress', 'Done'].includes(direct)) {
    return direct;
  }
  return null;
};

const resolvePriority = (value) => {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  const direct = PRIORITY_ALIASES.get(normalized.toLowerCase()) || normalized;
  if (['Low', 'Medium', 'High'].includes(direct)) {
    return direct;
  }
  return null;
};

const resolveDeadline = (value) => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const candidate = new Date(trimmed);
  if (Number.isNaN(candidate.getTime())) {
    return trimmed;
  }
  return candidate.toISOString();
};

const buildSlackActor = (payload) => ({
  id: payload.user_id ? `slack:${payload.user_id}` : 'slack:unknown',
  name: payload.user_name ? `Slack ${payload.user_name}` : 'Slack user',
});

const handleAddCommand = async (payload, command, context) => {
  const title = command.title;
  if (!title) {
    return slackMessage('Please provide a task title. Example: `/task add New task | description=Optional details`.');
  }

  const fields = command.fields || {};
  const status = resolveStatus(fields.status) || 'Started';
  const priority = resolvePriority(fields.priority) || 'Medium';
  const tags = parseList(fields.tags);
  const rawAssignees = parseList(fields.assignees);
  const assignees = normalizeAssigneesPayload({ assignees: rawAssignees });
  const description = fields.description || fields.desc || '';
  const category = fields.category || null;
  const deadline = resolveDeadline(fields.deadline);
  const importance = Number.parseInt(fields.importance, 10);
  const normalizedImportance = Number.isNaN(importance) ? 1 : Math.max(0, Math.min(importance, 2));

  const actor = buildSlackActor(payload);
  const container = tasksContainer();
  const now = new Date().toISOString();

  const baseTask = {
    id: uuidv4(),
    title,
    description,
    status,
    priority,
    tags,
    category,
    importance: normalizedImportance,
    assignees,
    deadline,
    subtasks: normalizeSubtasksInput([]),
    createdAt: now,
    createdById: actor.id,
    createdByName: actor.name,
  };

  const taskToCreate = ensureAssigneesOnTask(baseTask);
  const { resource } = await container.items.create(taskToCreate);
  const savedTask = ensureAssigneesOnTask(resource);

  await notifyTaskCreated(savedTask, context, { actorName: actor.name });

  return slackMessage(`Created task *${savedTask.title}* (ID: ${savedTask.id}) with status ${savedTask.status}.`, {
    attachments: [
      {
        color: '#36a64f',
        fields: [
          { title: 'Status', value: savedTask.status, short: true },
          { title: 'Priority', value: savedTask.priority || 'Unspecified', short: true },
          { title: 'Assignees', value: savedTask.assignees.join(', ') || 'Unassigned', short: false },
        ],
      },
    ],
  });
};

const handleUpdateCommand = async (payload, command, context) => {
  const taskId = command.taskId;
  if (!taskId) {
    return slackMessage('Please provide the task ID. Example: `/task update 123 | status=Done`.');
  }

  const fields = command.fields || {};
  const updates = {};

  if (fields.status) {
    const status = resolveStatus(fields.status);
    if (!status) {
      return slackMessage('Status must be one of Started, Inprogress, or Done.');
    }
    updates.status = status;
  }

  if (fields.priority) {
    const priority = resolvePriority(fields.priority);
    if (!priority) {
      return slackMessage('Priority must be Low, Medium, or High.');
    }
    updates.priority = priority;
  }

  if (fields.title) {
    updates.title = fields.title;
  }

  if (fields.description || fields.desc) {
    updates.description = fields.description || fields.desc;
  }

  if (fields.category) {
    updates.category = fields.category;
  }

  if (fields.deadline) {
    updates.deadline = resolveDeadline(fields.deadline);
  }

  if (fields.tags) {
    updates.tags = parseList(fields.tags);
  }

  if (fields.assignees) {
    updates.assignees = normalizeAssigneesPayload({ assignees: parseList(fields.assignees) });
  }

  if (Object.keys(updates).length === 0) {
    return slackMessage('No updates provided. Include at least one field such as `status=Done`.');
  }

  const container = tasksContainer();
  const { resource: existingTask } = await container.item(taskId, taskId).read();
  if (!existingTask) {
    return slackMessage(`Task with ID ${taskId} was not found.`);
  }

  const actor = buildSlackActor(payload);
  const now = new Date().toISOString();
  const previousStatus = existingTask.status;
  let statusChanged = false;

  const baseTask = {
    ...existingTask,
    ...updates,
    lastUpdatedAt: now,
    lastUpdatedById: actor.id,
    lastUpdatedByName: actor.name,
  };

  if (updates.assignees) {
    baseTask.assignees = updates.assignees;
  }

  if (updates.tags) {
    baseTask.tags = updates.tags;
  }

  if (updates.status && updates.status !== previousStatus) {
    const history = Array.isArray(existingTask.statusHistory)
      ? [...existingTask.statusHistory]
      : [];
    history.push({
      status: updates.status,
      changedAt: now,
      changedById: actor.id,
      changedByName: actor.name,
    });
    baseTask.statusHistory = history;
    statusChanged = true;
  }

  const taskToSave = ensureAssigneesOnTask(baseTask);
  const { resource } = await container.item(taskId, taskId).replace(taskToSave);
  const savedTask = ensureAssigneesOnTask(resource);

  if (statusChanged) {
    await notifyTaskStatusChanged(savedTask, previousStatus, context, { actorName: actor.name });
  }

  return slackMessage(`Updated task *${savedTask.title}* (ID: ${savedTask.id}).`, {
    attachments: [
      {
        color: statusChanged ? '#439FE0' : '#ededed',
        fields: [
          { title: 'Status', value: savedTask.status || 'Unchanged', short: true },
          { title: 'Priority', value: savedTask.priority || 'Unchanged', short: true },
          { title: 'Assignees', value: savedTask.assignees.join(', ') || 'Unassigned', short: false },
        ],
      },
    ],
  });
};

const helpMessage = () => slackMessage(
  'Task command usage:\n' +
    '• `/task add Task title | description=Optional details | status=Started | assignees=Alice,Bob`\n' +
    '• `/task update TASK_ID | status=Done | assignees=Charlie`\n' +
    'Available fields: status, priority, assignees, tags, category, deadline (YYYY-MM-DD), description.',
);

app.http('SlackCommand', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'Slack/Command',
  handler: async (request, context) => {
    const rawBody = await request.text();

    if (!verifySlackSignature(request, rawBody, context)) {
      return slackErrorResponse(401, 'Invalid Slack signature.');
    }

    const payload = querystring.parse(rawBody);

    if (ALLOWED_TEAM_ID && payload.team_id && payload.team_id !== ALLOWED_TEAM_ID) {
      context.log(`Slack request denied for team ${payload.team_id}.`);
      return slackErrorResponse(403, 'Forbidden.');
    }

    try {
      const command = parseCommand(payload.text || '');
      if (!command) {
        return helpMessage();
      }

      if (command.error) {
        if (command.action === 'help') {
          return helpMessage();
        }
        return slackMessage(command.error);
      }

      switch (command.action) {
        case 'add':
          return await handleAddCommand(payload, command, context);
        case 'update':
          return await handleUpdateCommand(payload, command, context);
        case 'help':
          return helpMessage();
        default:
          return slackMessage('Supported actions are `add`, `update`, and `help`.');
      }
    } catch (error) {
      context.log('Slack command handling failed', error);
      return slackMessage('Failed to process the command. Please try again later.');
    }
  },
});
