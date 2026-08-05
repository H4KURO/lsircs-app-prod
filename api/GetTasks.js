const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');
const { ensureAssigneesOnTask } = require('./assigneeUtils');
const { normalizeSubtasksInput } = require('./subtaskUtils');
const { attachAttachmentUrls } = require('./propertyPhotoStorage');
const { notifyDeadlineReminders } = require('./slackClient');

const n8nSecretKey = process.env.N8N_SECRET_KEY;

const tasksContainer = () =>
  getNamedContainer('Tasks', ['COSMOS_TASKS_CONTAINER', 'CosmosTasksContainer']);

app.http('GetTasks', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    // POST + secret key → deadline reminder mode
    if (request.method === 'POST') {
      const secret = request.headers.get('x-n8n-secret-key');
      if (!n8nSecretKey || secret !== n8nSecretKey) {
        return { status: 401, body: 'Unauthorized' };
      }

      let daysAhead = 3;
      try {
        const body = await request.json();
        if (typeof body?.daysAhead === 'number' && body.daysAhead > 0) {
          daysAhead = Math.min(body.daysAhead, 30);
        }
      } catch { /* use default */ }

      try {
        const container = tasksContainer();
        const { resources } = await container.items.readAll().fetchAll();

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() + daysAhead);

        const upcoming = resources.filter((task) => {
          if (!task.deadline || task.status === 'Done') return false;
          const d = new Date(task.deadline);
          d.setHours(0, 0, 0, 0);
          return d >= now && d <= cutoff;
        });

        const result = await notifyDeadlineReminders(upcoming, context);
        context.log('DeadlineReminder sent', result);

        return {
          status: 200,
          jsonBody: { daysAhead, found: upcoming.length, ...result },
        };
      } catch (error) {
        context.log('DeadlineReminder failed', error);
        return { status: 500, body: 'Error processing deadline reminders.' };
      }
    }

    // GET → normal task fetching
    try {
      const container = tasksContainer();
      const { resources } = await container.items.readAll().fetchAll();
      const normalizedTasks = await Promise.all(
        resources.map(async (task) => {
          const withAssignees = ensureAssigneesOnTask(task);
          const attachments = await attachAttachmentUrls(withAssignees.attachments || []);
          return {
            ...withAssignees,
            attachments,
            subtasks: normalizeSubtasksInput(withAssignees.subtasks),
          };
        }),
      );

      return { status: 200, jsonBody: normalizedTasks };
    } catch (error) {
      const message = error.message || 'Error fetching tasks from the database.';
      if (message.includes('Resource NotFound')) {
        context.log('Tasks container not found, returning empty list.');
        return { status: 200, jsonBody: [] };
      }
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('GetTasks failed', error);
      return { status: 500, body: 'Error fetching tasks from the database.' };
    }
  },
});
