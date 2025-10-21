import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  MenuItem,
  Autocomplete,
  Chip,
  Box,
  Stack,
  Typography,
  IconButton,
  Checkbox,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { useTranslation } from 'react-i18next';
import { normalizeTask, generateSubtaskId, TASK_STATUS_DEFINITIONS, TASK_STATUS_VALUES } from './taskUtils';

const createBlankSubtask = () => ({
  id: generateSubtaskId(),
  title: '',
  completed: false,
});

export function TaskDetailModal({
  task,
  onSave,
  onClose,
  assigneeOptions,
  categoryOptions,
  tagOptions,
  automationRules = [],
}) {
  const { t } = useTranslation();
  const importanceOptions = useMemo(
    () => [
      { label: t('taskDetail.importanceHigh'), value: 2 },
      { label: t('taskDetail.importanceMedium'), value: 1 },
      { label: t('taskDetail.importanceLow'), value: 0 },
    ],
    [t],
  );
  const statusOptions = useMemo(
    () =>
      TASK_STATUS_DEFINITIONS.map((definition) => ({
        value: definition.value,
        label: t(definition.translationKey, { defaultValue: definition.value }),
      })),
    [t],
  );


  const [editableTask, setEditableTask] = useState(() => normalizeTask(task));
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const resolvedStatusValue = useMemo(() => {
    const fallback = statusOptions[0]?.value ?? TASK_STATUS_VALUES[0] ?? '';
    const status = editableTask?.status;
    if (!status) {
      return fallback;
    }
    return statusOptions.some((option) => option.value === status) ? status : fallback;
  }, [editableTask?.status, statusOptions]);

  useEffect(() => {
    setEditableTask(normalizeTask(task));
    setNewSubtaskTitle('');
  }, [task]);

  const subtasks = useMemo(
    () => (Array.isArray(editableTask.subtasks) ? editableTask.subtasks : []),
    [editableTask.subtasks],
  );

  const automationRuleMap = useMemo(() => {
    const map = new Map();
    (Array.isArray(automationRules) ? automationRules : []).forEach((rule) => {
      const tagKey = typeof rule?.tag === 'string' ? rule.tag.trim() : '';
      if (!tagKey || rule?.enabled === false) {
        return;
      }
      map.set(tagKey, {
        ...rule,
        subtasks: Array.isArray(rule.subtasks) ? rule.subtasks : [],
      });
    });
    return map;
  }, [automationRules]);

  const mergeAutomationTemplates = (selectedTags, currentSubtasks = []) => {
    if (!Array.isArray(selectedTags) || selectedTags.length === 0 || automationRuleMap.size === 0) {
      return currentSubtasks;
    }

    const base = Array.isArray(currentSubtasks) ? [...currentSubtasks] : [];
    const existingIds = new Set(
      base.map((item) => (item?.id ? String(item.id) : '')).filter(Boolean),
    );
    const existingTitles = new Set(
      base
        .map((item) => (typeof item?.title === 'string' ? item.title.trim().toLowerCase() : ''))
        .filter(Boolean),
    );

    let mutated = false;

    selectedTags.forEach((tag) => {
      const rule = automationRuleMap.get(tag);
      if (!rule) {
        return;
      }
      (Array.isArray(rule.subtasks) ? rule.subtasks : []).forEach((template) => {
        const templateTitle = typeof template?.title === 'string' ? template.title.trim() : '';
        const templateId = template?.id ? String(template.id) : null;
        if (templateId && existingIds.has(templateId)) {
          return;
        }
        if (!templateId && templateTitle && existingTitles.has(templateTitle.toLowerCase())) {
          return;
        }
        const newSubtask = {
          id: templateId || generateSubtaskId(),
          title: templateTitle,
          completed: Boolean(template?.completed),
        };
        base.push(newSubtask);
        existingIds.add(newSubtask.id);
        if (templateTitle) {
          existingTitles.add(templateTitle.toLowerCase());
        }
        mutated = true;
      });
    });

    return mutated ? base : currentSubtasks;
  };

  useEffect(() => {
    if (!Array.isArray(automationRules) || automationRules.length === 0) {
      return;
    }
    const currentTags = Array.isArray(editableTask.tags) ? editableTask.tags : [];
    if (currentTags.length === 0) {
      return;
    }
    const currentSubtasks = Array.isArray(editableTask.subtasks) ? editableTask.subtasks : [];
    const merged = mergeAutomationTemplates(currentTags, currentSubtasks);
    if (merged !== currentSubtasks) {
      setEditableTask((prev) => ({
        ...prev,
        subtasks: merged,
      }));
    }
  }, [automationRuleMap, automationRules, editableTask.tags, editableTask.subtasks]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setEditableTask((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = () => {
    const sanitizedSubtasks = (Array.isArray(editableTask.subtasks) ? editableTask.subtasks : []).map(
      (subtask, index) => ({
        ...subtask,
        title: subtask.title?.trim() || '',
        order: index,
      }),
    );

    const sanitizedStatus = resolvedStatusValue;

    onSave({
      ...editableTask,
      status: sanitizedStatus,
      subtasks: sanitizedSubtasks,
    });
  };

  const handleToggleSubtask = (subtaskId) => {
    setEditableTask((prev) => ({
      ...prev,
      subtasks: (Array.isArray(prev.subtasks) ? prev.subtasks : []).map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask,
      ),
    }));
  };

  const handleRemoveSubtask = (subtaskId) => {
    setEditableTask((prev) => ({
      ...prev,
      subtasks: (Array.isArray(prev.subtasks) ? prev.subtasks : []).filter((subtask) => subtask.id !== subtaskId),
    }));
  };

  const handleSubtaskTitleChange = (subtaskId, value) => {
    setEditableTask((prev) => ({
      ...prev,
      subtasks: (Array.isArray(prev.subtasks) ? prev.subtasks : []).map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, title: value } : subtask,
      ),
    }));
  };

  const handleAddSubtask = (title) => {
    const trimmed = title.trim();
    setEditableTask((prev) => {
      const current = Array.isArray(prev.subtasks) ? prev.subtasks : [];
      return {
        ...prev,
        subtasks: [...current, { ...createBlankSubtask(), title: trimmed }],
      };
    });
  };

  const handleQuickAddSubtask = () => {
    if (!newSubtaskTitle.trim()) {
      handleAddSubtask('');
      return;
    }
    handleAddSubtask(newSubtaskTitle);
    setNewSubtaskTitle('');
  };

  const completedCount = subtasks.filter((subtask) => subtask.completed).length;

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{task.id ? t('taskDetail.editTitle') : t('taskDetail.createTitle')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: '10px !important', mt: 1 }}>
        <TextField
          label={t('taskDetail.title')}
          name="title"
          value={editableTask.title || ''}
          onChange={handleChange}
          variant="outlined"
          fullWidth
        />
        <TextField
          label={t('taskDetail.description')}
          name="description"
          value={editableTask.description || ''}
          onChange={handleChange}
          variant="outlined"
          multiline
          rows={4}
          fullWidth
        />
        <TextField
          select
          label={t('taskDetail.statusLabel', { defaultValue: 'Status' })}
          value={resolvedStatusValue}
          onChange={(event) =>
            setEditableTask((prev) => ({ ...prev, status: event.target.value }))
          }
          fullWidth
        >
          {statusOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>

        <Autocomplete
          options={importanceOptions}
          getOptionLabel={(option) => option.label || ''}
          value={importanceOptions.find((opt) => opt.value === editableTask.importance) || null}
          onChange={(event, newValue) => {
            setEditableTask((prev) => ({ ...prev, importance: newValue ? newValue.value : 1 }));
          }}
          renderInput={(params) => <TextField {...params} label={t('taskDetail.importance')} />}
        />

        <Autocomplete
          options={categoryOptions}
          value={editableTask.category || null}
          onChange={(event, newValue) => {
            setEditableTask((prev) => ({
              ...prev,
              category: typeof newValue === 'string' ? newValue : newValue || null,
            }));
          }}
          renderInput={(params) => <TextField {...params} label={t('taskDetail.category')} />}
        />

        <Autocomplete
          multiple
          freeSolo
          options={assigneeOptions}
          value={editableTask.assignees || []}
          onChange={(event, newValue) => {
            const sanitized = (newValue || [])
              .map((option) => (typeof option === 'string' ? option : option?.label ?? ''))
              .map((name) => name.trim())
              .filter(Boolean);
            setEditableTask((prev) => ({
              ...prev,
              assignees: sanitized,
              assignee: sanitized.length > 0 ? sanitized[0] : null,
            }));
          }}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip variant="outlined" label={option} {...getTagProps({ index })} />
            ))
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label={t('taskDetail.assignees')}
              placeholder={t('taskDetail.assigneesPlaceholder')}
            />
          )}
        />

        <Autocomplete
          multiple
          freeSolo
          options={tagOptions}
          value={editableTask.tags || []}
          onChange={(event, newValue) => {
            const sanitized = Array.from(
              new Set(
                (newValue || [])
                  .map((option) => (typeof option === 'string' ? option : option?.label ?? ''))
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              ),
            );

            setEditableTask((prev) => {
              const currentSubtasks = Array.isArray(prev.subtasks) ? prev.subtasks : [];
              const merged = mergeAutomationTemplates(sanitized, currentSubtasks);
              if (merged !== currentSubtasks) {
                return { ...prev, tags: sanitized, subtasks: merged };
              }
              return { ...prev, tags: sanitized };
            });
          }}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip variant="outlined" label={option} {...getTagProps({ index })} />
            ))
          }
          renderInput={(params) => (
            <TextField {...params} label={t('taskDetail.tags')} placeholder={t('taskDetail.tagsPlaceholder')} />
          )}
        />

        <TextField
          label={t('taskDetail.deadline')}
          name="deadline"
          type="date"
          value={editableTask.deadline ? editableTask.deadline.split('T')[0] : ''}
          onChange={handleChange}
          InputLabelProps={{ shrink: true }}
          fullWidth
        />

        <Divider />
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6">{t('taskDetail.subtasks')}</Typography>
            <Chip
              label={t('taskDetail.subtasksProgress', { completed: completedCount, total: subtasks.length })}
              size="small"
            />
          </Box>
          <Stack spacing={1.5}>
            {subtasks.map((subtask) => (
              <Box
                key={subtask.id}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  alignItems: 'center',
                  gap: 1.5,
                }}
              >
                <DragIndicatorIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Checkbox
                    checked={Boolean(subtask.completed)}
                    onChange={() => handleToggleSubtask(subtask.id)}
                    inputProps={{ 'aria-label': t('taskDetail.toggleSubtask') }}
                  />
                  <TextField
                    fullWidth
                    value={subtask.title || ''}
                    onChange={(event) => handleSubtaskTitleChange(subtask.id, event.target.value)}
                    placeholder={t('taskDetail.subtaskPlaceholder')}
                    size="small"
                  />
                </Box>
                <IconButton
                  edge="end"
                  aria-label={t('taskDetail.removeSubtask')}
                  onClick={() => handleRemoveSubtask(subtask.id)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Stack>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            sx={{ mt: 2 }}
          >
            <TextField
              label={t('taskDetail.addSubtaskLabel')}
              placeholder={t('taskDetail.subtaskPlaceholder')}
              size="small"
              fullWidth
              value={newSubtaskTitle}
              onChange={(event) => setNewSubtaskTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleQuickAddSubtask();
                }
              }}
            />
            <Button variant="outlined" startIcon={<AddIcon />} onClick={handleQuickAddSubtask}>
              {t('taskDetail.addSubtaskButton')}
            </Button>
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('taskDetail.cancel')}</Button>
        <Button onClick={handleSubmit} variant="contained">
          {t('taskDetail.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
