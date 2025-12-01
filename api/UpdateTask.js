const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');
const { normalizeSubtasksInput } = require('./subtaskUtils');
const { notifyTaskStatusChanged } = require('./slackClient');
const { normalizeAssigneesPayload, ensureAssigneesOnTask } = require('./assigneeUtils');
const { validationError, splitAttachmentsByUploadRequirement } = require('./attachmentUtils');
const {
  uploadAttachmentForEntity,
  deleteAttachments,
  attachAttachmentUrls,
} = require('./propertyPhotoStorage');

const tasksContainer = () =>
  getNamedContainer('Tasks', ['COSMOS_TASKS_CONTAINER', 'CosmosTasksContainer']);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch (error) {
    return null;
  }
}

app.http('UpdateTask', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'UpdateTask/{id}',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      const id = request.params?.id;
      if (!id) {
        return { status: 400, body: 'Task id is required.' };
      }

      const updatesPayload = await request.json();
      const sanitizedUpdates =
        updatesPayload && typeof updatesPayload === 'object' ? { ...updatesPayload } : {};

      if (Object.prototype.hasOwnProperty.call(sanitizedUpdates, 'subtasks')) {
        sanitizedUpdates.subtasks = normalizeSubtasksInput(sanitizedUpdates.subtasks);
      }

      const hasAssigneeUpdate = Object.prototype.hasOwnProperty.call(sanitizedUpdates, 'assignees') ||
        Object.prototype.hasOwnProperty.call(sanitizedUpdates, 'assignee');

      if (hasAssigneeUpdate) {
        const normalizedAssignees = normalizeAssigneesPayload(sanitizedUpdates);
        sanitizedUpdates.assignees = normalizedAssignees;
        sanitizedUpdates.assignee = normalizedAssignees.length > 0 ? normalizedAssignees[0] : null;
      }

      const container = tasksContainer();
      const { resource: existingTask } = await container.item(id, id).read();
      if (!existingTask) {
        return { status: 404, body: 'Task not found.' };
      }
      const previousStatus = existingTask.status;
      let statusChanged = false;
      let attachmentsToPersist = existingTask.attachments || [];

      if (Object.prototype.hasOwnProperty.call(sanitizedUpdates, 'attachments')) {
        const { existingAttachments, newAttachments } = splitAttachmentsByUploadRequirement(
          sanitizedUpdates.attachments,
        );
        delete sanitizedUpdates.attachments;

        const existingMap = new Map((existingTask.attachments || []).map((att) => [att.id, att]));
        const kept = existingAttachments.map((attachment) => {
          const stored = existingMap.get(attachment.id);
          if (!stored) {
            throw validationError(`Attachment "${attachment.name}" no longer exists on the server.`);
          }
          return {
            ...stored,
            name: attachment.name || stored.name,
            description:
              typeof attachment.description === 'string' ? attachment.description : stored.description,
          };
        });

        const uploaded = [];
        for (const attachment of newAttachments) {
          uploaded.push(await uploadAttachmentForEntity('task', existingTask.id, attachment));
        }

        const combined = [...kept, ...uploaded];
        const combinedIds = new Set(combined.map((attachment) => attachment.id));
        const removed = (existingTask.attachments || []).filter(
          (attachment) => !combinedIds.has(attachment.id),
        );
        await deleteAttachments(removed.map((attachment) => attachment.blobName));
        attachmentsToPersist = combined;
      }

      const lastUpdatedAt = new Date().toISOString();
      const baseTask = {
        ...existingTask,
        ...sanitizedUpdates,
        lastUpdatedAt,
        lastUpdatedById: clientPrincipal.userId,
        lastUpdatedByName: clientPrincipal.userDetails,
        attachments: attachmentsToPersist,
      };

      if (Object.prototype.hasOwnProperty.call(sanitizedUpdates, 'status') &&
        sanitizedUpdates.status !== existingTask.status) {
        const history = Array.isArray(existingTask.statusHistory)
          ? [...existingTask.statusHistory]
          : [];
        history.push({
          status: sanitizedUpdates.status,
          changedAt: lastUpdatedAt,
          changedById: clientPrincipal.userId,
          changedByName: clientPrincipal.userDetails,
        });
        statusChanged = true;
        baseTask.statusHistory = history;
      }

      const updatedTask = ensureAssigneesOnTask(baseTask);
      const { resource } = await container.item(id, id).replace(updatedTask);
      const savedTask = ensureAssigneesOnTask(resource);
      savedTask.attachments = await attachAttachmentUrls(savedTask.attachments || []);

      if (statusChanged) {
        await notifyTaskStatusChanged(savedTask, previousStatus, context, {
          actorName: clientPrincipal.userDetails,
        });
      }

      return { status: 200, jsonBody: savedTask };
    } catch (error) {
      if (error?.code === 404) {
        return { status: 404, body: 'Task not found.' };
      }
      const message = error.message || 'Error updating task.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('UpdateTask failed', error);
      return { status: 500, body: 'Error updating task.' };
    }
  },
});

