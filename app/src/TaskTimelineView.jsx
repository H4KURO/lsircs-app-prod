// app/src/TaskTimelineView.jsx
import { useMemo, useRef, useCallback } from 'react';
import { Box, Typography, Chip, Tooltip, Paper } from '@mui/material';
import CircleIcon from '@mui/icons-material/Circle';
import { ALL_TASK_STATUS_DEFINITIONS } from './taskUtils';

const STATUS_COLORS = {
  Started: '#64b5f6',
  WaitingEstimate: '#64b5f6',
  Inprogress: '#ffb74d',
  WaitingOwnerApproval: '#ffb74d',
  WaitingCompletionReport: '#ffb74d',
  Done: '#81c784',
};

const STATUS_LABEL_JA = {
  Started: '着手前',
  WaitingEstimate: '見積もり待ち',
  Inprogress: '進行中',
  WaitingOwnerApproval: 'オーナー承諾待ち',
  WaitingCompletionReport: '完了報告待ち',
  Done: '完了',
};

const DAY_MS = 1000 * 60 * 60 * 24;
const ROW_HEIGHT = 44;
const LABEL_WIDTH = 200;
const MIN_RANGE_DAYS = 45;

function toDay(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function TaskTimelineView({ tasks = [], onEditTask }) {
  const containerRef = useRef(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const tasksWithDates = useMemo(() => {
    return tasks
      .filter(t => t.deadline)
      .map(t => {
        const deadline = toDay(t.deadline);
        if (!deadline) return null;
        const startDate = t.startDate ? toDay(t.startDate) : null;
        const effectiveStart = startDate && startDate <= deadline ? startDate : new Date(Math.min(today.getTime(), deadline.getTime()));
        return { ...t, _deadline: deadline, _start: effectiveStart };
      })
      .filter(Boolean)
      .sort((a, b) => a._deadline - b._deadline);
  }, [tasks, today]);

  const { rangeStart, totalDays } = useMemo(() => {
    const start = new Date(today);
    start.setDate(start.getDate() - 7);

    let end = new Date(today);
    end.setDate(end.getDate() + MIN_RANGE_DAYS);

    tasksWithDates.forEach(t => {
      if (t._deadline > end) end = new Date(t._deadline);
    });
    end.setDate(end.getDate() + 7);

    const days = Math.ceil((end - start) / DAY_MS);
    return { rangeStart: start, totalDays: days };
  }, [today, tasksWithDates]);

  const todayOffset = useMemo(() => {
    return Math.round((today - rangeStart) / DAY_MS);
  }, [today, rangeStart]);

  // Build weekly tick marks
  const weekTicks = useMemo(() => {
    const ticks = [];
    const d = new Date(rangeStart);
    // Align to next Monday
    const dow = d.getDay();
    const daysUntilMon = dow === 0 ? 1 : (8 - dow) % 7;
    d.setDate(d.getDate() + daysUntilMon);
    while (Math.round((d - rangeStart) / DAY_MS) < totalDays) {
      ticks.push({ day: Math.round((d - rangeStart) / DAY_MS), label: formatDate(d) });
      d.setDate(d.getDate() + 7);
    }
    return ticks;
  }, [rangeStart, totalDays]);

  const getBarStyle = useCallback((task) => {
    const startDay = Math.round((task._start - rangeStart) / DAY_MS);
    const endDay = Math.round((task._deadline - rangeStart) / DAY_MS);
    const left = (startDay / totalDays) * 100;
    const width = Math.max(((endDay - startDay + 1) / totalDays) * 100, 0.5);
    const color = STATUS_COLORS[task.status] || '#bdbdbd';
    return { left: `${left}%`, width: `${width}%`, backgroundColor: color };
  }, [rangeStart, totalDays]);

  // Group by category
  const categoryGroups = useMemo(() => {
    const groups = new Map();
    tasksWithDates.forEach(t => {
      const cat = t.category || 'カテゴリ未設定';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(t);
    });
    return Array.from(groups.entries()).map(([cat, catTasks]) => ({ cat, tasks: catTasks }));
  }, [tasksWithDates]);

  const tasksWithoutDeadline = tasks.filter(t => !t.deadline);

  if (tasksWithDates.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          期限が設定されているタスクがありません。タスクに期限を設定するとタイムラインに表示されます。
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper sx={{ overflow: 'hidden' }}>
        <Box
          ref={containerRef}
          sx={{ overflowX: 'auto', overflowY: 'visible' }}
        >
          {/* ── ヘッダー行 ── */}
          <Box
            sx={{
              display: 'flex',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              bgcolor: 'background.paper',
              borderBottom: '2px solid',
              borderColor: 'divider',
              minWidth: `${LABEL_WIDTH + totalDays * 18}px`,
            }}
          >
            {/* ラベル列見出し */}
            <Box
              sx={{
                width: LABEL_WIDTH,
                flexShrink: 0,
                p: 1,
                borderRight: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Typography variant="caption" fontWeight={600} color="text.secondary">
                タスク名
              </Typography>
            </Box>

            {/* 日付スケール */}
            <Box sx={{ flex: 1, position: 'relative', height: 36 }}>
              {weekTicks.map((tick) => (
                <Box
                  key={tick.day}
                  sx={{
                    position: 'absolute',
                    left: `${(tick.day / totalDays) * 100}%`,
                    top: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    pl: 0.5,
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', fontSize: '0.68rem' }}>
                    {tick.label}
                  </Typography>
                </Box>
              ))}
              {/* 今日マーカー */}
              <Box
                sx={{
                  position: 'absolute',
                  left: `${(todayOffset / totalDays) * 100}%`,
                  top: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  pl: 0.5,
                }}
              >
                <Typography variant="caption" color="error.main" sx={{ whiteSpace: 'nowrap', fontSize: '0.68rem', fontWeight: 700 }}>
                  今日
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* ── タスク行 ── */}
          <Box sx={{ minWidth: `${LABEL_WIDTH + totalDays * 18}px` }}>
            {categoryGroups.map(({ cat, tasks: catTasks }) => (
              <Box key={cat}>
                {/* カテゴリ見出し行 */}
                <Box
                  sx={{
                    display: 'flex',
                    bgcolor: 'action.hover',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ width: LABEL_WIDTH, flexShrink: 0, px: 1.5, py: 0.5, borderRight: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" fontWeight={700} color="primary.main">
                      {cat}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1, position: 'relative' }}>
                    {/* 週区切り線 */}
                    {weekTicks.map((tick) => (
                      <Box
                        key={tick.day}
                        sx={{
                          position: 'absolute',
                          left: `${(tick.day / totalDays) * 100}%`,
                          top: 0,
                          bottom: 0,
                          width: '1px',
                          bgcolor: 'divider',
                        }}
                      />
                    ))}
                    {/* 今日ライン */}
                    <Box
                      sx={{
                        position: 'absolute',
                        left: `${(todayOffset / totalDays) * 100}%`,
                        top: 0,
                        bottom: 0,
                        width: '2px',
                        bgcolor: 'error.light',
                        opacity: 0.5,
                      }}
                    />
                  </Box>
                </Box>

                {/* タスク行 */}
                {catTasks.map((task) => {
                  const barStyle = getBarStyle(task);
                  const isOverdue = task._deadline < today && task.status !== 'Done';
                  const statusLabel = STATUS_LABEL_JA[task.status] || task.status;
                  return (
                    <Box
                      key={task.id}
                      sx={{
                        display: 'flex',
                        height: ROW_HEIGHT,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      {/* タスク名 */}
                      <Box
                        sx={{
                          width: LABEL_WIDTH,
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.75,
                          px: 1,
                          borderRight: '1px solid',
                          borderColor: 'divider',
                          cursor: 'pointer',
                          overflow: 'hidden',
                        }}
                        onClick={() => onEditTask?.(task)}
                      >
                        <CircleIcon sx={{ fontSize: '0.6rem', color: STATUS_COLORS[task.status] || 'text.disabled', flexShrink: 0 }} />
                        <Typography
                          variant="caption"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontWeight: isOverdue ? 700 : 400,
                            color: isOverdue ? 'error.main' : 'text.primary',
                            flex: 1,
                          }}
                          title={task.title}
                        >
                          {task.title}
                        </Typography>
                      </Box>

                      {/* ガントバー */}
                      <Box sx={{ flex: 1, position: 'relative' }}>
                        {/* 週区切り線 */}
                        {weekTicks.map((tick) => (
                          <Box
                            key={tick.day}
                            sx={{
                              position: 'absolute',
                              left: `${(tick.day / totalDays) * 100}%`,
                              top: 0,
                              bottom: 0,
                              width: '1px',
                              bgcolor: 'divider',
                            }}
                          />
                        ))}
                        {/* 今日ライン */}
                        <Box
                          sx={{
                            position: 'absolute',
                            left: `${(todayOffset / totalDays) * 100}%`,
                            top: 0,
                            bottom: 0,
                            width: '2px',
                            bgcolor: 'error.light',
                            opacity: 0.4,
                            zIndex: 1,
                          }}
                        />
                        {/* タスクバー */}
                        <Tooltip
                          title={
                            <Box>
                              <Typography variant="body2" fontWeight={700}>{task.title}</Typography>
                              <Typography variant="caption">{statusLabel}</Typography>
                              {task.assignees?.length > 0 && (
                                <Typography variant="caption" display="block">担当: {task.assignees.join(', ')}</Typography>
                              )}
                              <Typography variant="caption" display="block">
                                期限: {task._deadline.toLocaleDateString('ja-JP')}
                              </Typography>
                              {isOverdue && (
                                <Typography variant="caption" display="block" color="error.light">期限超過</Typography>
                              )}
                            </Box>
                          }
                          arrow
                        >
                          <Box
                            sx={{
                              position: 'absolute',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              height: 22,
                              borderRadius: 1,
                              cursor: 'pointer',
                              zIndex: 2,
                              outline: isOverdue ? '2px solid' : 'none',
                              outlineColor: 'error.main',
                              transition: 'filter 0.15s ease',
                              '&:hover': { filter: 'brightness(0.85)' },
                              ...barStyle,
                            }}
                            onClick={() => onEditTask?.(task)}
                          />
                        </Tooltip>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            ))}
          </Box>
        </Box>
      </Paper>

      {/* ステータス凡例 */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {ALL_TASK_STATUS_DEFINITIONS.map(def => (
          <Chip
            key={def.value}
            size="small"
            icon={<CircleIcon sx={{ fontSize: '0.7rem !important', color: `${STATUS_COLORS[def.value] || '#bdbdbd'} !important` }} />}
            label={STATUS_LABEL_JA[def.value] || def.value}
            variant="outlined"
            sx={{ fontSize: '0.72rem' }}
          />
        ))}
      </Box>

      {tasksWithoutDeadline.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary">
            期限未設定のタスク {tasksWithoutDeadline.length} 件はタイムラインに表示されません。タスクを編集して期限を設定してください。
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
