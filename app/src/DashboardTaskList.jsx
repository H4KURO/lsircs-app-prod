import { useMemo } from 'react';
import { List, ListItem, ListItemText, Typography, Button, Box, Stack, Chip, CircularProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { TASK_STATUS_DEFINITIONS, getNextTaskStatus } from './taskUtils';

// ���̃R���|�[�l���g�́A�^�X�N�̔z����󂯎���ă��X�g�\�����邾���̃V���v���ȕ��i�ł�
export function DashboardTaskList({ tasks, onTaskClick, onAdvanceStatus, advancingTaskIds = [] }) {
  const { t } = useTranslation();

  const statusLabelMap = useMemo(() => {
    const map = {};
    TASK_STATUS_DEFINITIONS.forEach((definition) => {
      map[definition.value] = t(definition.translationKey, { defaultValue: definition.value });
    });
    return map;
  }, [t]);

  const advancingIdSet = useMemo(() => {
    return new Set((advancingTaskIds || []).map((id) => String(id)));
  }, [advancingTaskIds]);

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return <Typography variant="body2" color="text.secondary">{t('dashboard.noTasks')}</Typography>;
  }

  return (
    <List dense>
      {tasks.map((task) => {
        const rawTaskId = task?.id ?? task?.taskId ?? task?.key ?? task?.title;
        const taskId = rawTaskId != null ? String(rawTaskId) : undefined;
        const nextStatus = getNextTaskStatus(task?.status);
        const statusLabel = statusLabelMap[task?.status] ?? t('taskView.statuses.unknown');
        const isAdvancing = taskId ? advancingIdSet.has(taskId) : false;

        return (
          <ListItem
            key={taskId ?? task?.title ?? Math.random()}
            button
            onClick={() => onTaskClick(task)}
            sx={{
              borderBottom: '1px solid #eee',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
            disableGutters
          >
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <ListItemText
                primary={task?.title || t('taskView.labels.untitledTask')}
                secondary={
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                    {task?.deadline && (
                      <Typography variant="caption" color="text.secondary">
                        {t('dashboard.due', { date: String(task.deadline).split('T')[0] })}
                      </Typography>
                    )}
                    <Chip label={statusLabel} size="small" variant="outlined" />
                  </Stack>
                }
                primaryTypographyProps={{ noWrap: true }}
              />
            </Box>
            {onAdvanceStatus && (
              <Button
                size="small"
                variant="outlined"
                onClick={(event) => {
                  event.stopPropagation();
                  if (nextStatus) {
                    onAdvanceStatus(task, nextStatus);
                  }
                }}
                disabled={!nextStatus || isAdvancing}
                startIcon={isAdvancing ? <CircularProgress size={16} /> : undefined}
              >
                {isAdvancing ? t('dashboard.advancingStatus') : t('dashboard.advanceStatus')}
              </Button>
            )}
          </ListItem>
        );
      })}
    </List>
  );
}
