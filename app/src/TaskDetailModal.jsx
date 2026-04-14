import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
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
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  InputAdornment,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import SearchIcon from '@mui/icons-material/Search';
import SyncIcon from '@mui/icons-material/Sync';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useTranslation } from 'react-i18next';
import { normalizeTask, generateSubtaskId, TASK_STATUS_DEFINITIONS, TASK_STATUS_VALUES } from './taskUtils';
import { AttachmentManager } from './AttachmentManager';

const API_URL = '/api';

const createBlankSubtask = () => ({
  id: generateSubtaskId(),
  title: '',
  memo: '',
  completed: false,
  buyerLink: null,
});

// 3段ヘッダーから列ラベルを生成
function buildColumnLabels(headers) {
  if (!headers || headers.length === 0) return [];
  const maxCols = Math.max(...headers.map((r) => r?.length ?? 0));
  const labels = [];
  for (let col = 0; col < maxCols; col++) {
    const parts = headers
      .map((row) => (row?.[col] != null && row[col] !== '' ? String(row[col]) : null))
      .filter(Boolean);
    const unique = [...new Set(parts)];
    labels.push(unique.join(' / ') || `列${col + 1}`);
  }
  return labels;
}

// ── バイヤー検索ダイアログ ──────────────────────────────────
function BuyerSearchDialog({ open, onClose, onSelect }) {
  const [searchText, setSearchText] = useState('');
  const [data, setData] = useState({ headers: [], rows: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSearchText('');
    axios
      .get(`${API_URL}/GetBuyers`)
      .then((res) => setData(res.data))
      .catch((err) => console.error('GetBuyers failed', err))
      .finally(() => setLoading(false));
  }, [open]);

  const columnLabels = useMemo(() => buildColumnLabels(data.headers), [data.headers]);
  const PREVIEW = 6;

  const filtered = useMemo(() => {
    if (!searchText.trim()) return data.rows;
    const q = searchText.toLowerCase();
    return data.rows.filter((row) =>
      row.some((cell) => String(cell ?? '').toLowerCase().includes(q)),
    );
  }, [data.rows, searchText]);

  const handleSelect = (row) => {
    const rowIndex = data.rows.indexOf(row);
    // 最初の非空セルを最大3つ結合して表示名を生成
    const displayName = row
      .slice(0, 8)
      .filter((c) => c != null && c !== '')
      .slice(0, 3)
      .join(' · ');
    onSelect({
      sheetName: 'Buyers list',
      rowIndex,
      displayName: displayName || `行${rowIndex + 1}`,
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LinkIcon fontSize="small" />
        バイヤーと紐づける
      </DialogTitle>
      <DialogContent>
        <TextField
          placeholder="名前・ユニット番号などで検索..."
          size="small"
          fullWidth
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
          autoFocus
        />
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 400, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {columnLabels.slice(0, PREVIEW).map((label, i) => (
                    <TableCell key={i} sx={{ fontWeight: 700, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                      {label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={PREVIEW} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                      {searchText ? '該当なし' : 'データがありません'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row, idx) => (
                    <TableRow
                      key={idx}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleSelect(row)}
                    >
                      {row.slice(0, PREVIEW).map((cell, ci) => (
                        <TableCell key={ci} sx={{ fontSize: '0.8rem', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cell ?? ''}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── メインコンポーネント ────────────────────────────────────
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

  // Sheets連携
  const [sheetsSyncColumn, setSheetsSyncColumn] = useState('');
  const [sheetsSyncValue, setSheetsSyncValue] = useState('〇');
  const [sheetsSyncOpen, setSheetsSyncOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // バイヤーリンクダイアログ
  const [buyerSearchOpen, setBuyerSearchOpen] = useState(false);
  const [buyerLinkTargetId, setBuyerLinkTargetId] = useState(null);

  const resolvedStatusValue = useMemo(() => {
    const fallback = statusOptions[0]?.value ?? TASK_STATUS_VALUES[0] ?? '';
    const status = editableTask?.status;
    if (!status) return fallback;
    return statusOptions.some((option) => option.value === status) ? status : fallback;
  }, [editableTask?.status, statusOptions]);

  // タスク変更時に初期化
  useEffect(() => {
    const normalized = normalizeTask(task);
    setEditableTask(normalized);
    setNewSubtaskTitle('');
    setSheetsSyncColumn(task?.sheetsSync?.column || '');
    setSheetsSyncValue(task?.sheetsSync?.completionValue || '〇');
    setSheetsSyncOpen(!!(task?.sheetsSync?.column));
  }, [task]);

  // タスクを開いたとき: Sheetsから完了状態を同期
  useEffect(() => {
    if (!task?.id) return;
    const syncCol = task?.sheetsSync?.column;
    if (!syncCol) return;
    const linked = (task.subtasks || []).filter((s) => s.buyerLink?.rowIndex != null);
    if (linked.length === 0) return;

    setSyncing(true);
    axios
      .get(`${API_URL}/GetBuyerSyncStatus?taskId=${task.id}`)
      .then((res) => {
        const statusMap = res.data; // { subtaskId: boolean }
        setEditableTask((prev) => ({
          ...prev,
          subtasks: (prev.subtasks || []).map((s) =>
            statusMap[s.id] !== undefined ? { ...s, completed: statusMap[s.id] } : s,
          ),
        }));
      })
      .catch((err) => console.error('Sheets sync failed', err))
      .finally(() => setSyncing(false));
  }, [task?.id, task?.sheetsSync?.column]);

  const automationRuleMap = useMemo(() => {
    const map = new Map();
    (Array.isArray(automationRules) ? automationRules : []).forEach((rule) => {
      const tagKey = typeof rule?.tag === 'string' ? rule.tag.trim() : '';
      if (!tagKey || rule?.enabled === false) return;
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
    const existingIds = new Set(base.map((item) => (item?.id ? String(item.id) : '')).filter(Boolean));
    const existingTitles = new Set(
      base
        .map((item) => (typeof item?.title === 'string' ? item.title.trim().toLowerCase() : ''))
        .filter(Boolean),
    );
    let mutated = false;
    selectedTags.forEach((tag) => {
      const rule = automationRuleMap.get(tag);
      if (!rule) return;
      (Array.isArray(rule.subtasks) ? rule.subtasks : []).forEach((template) => {
        const templateTitle = typeof template?.title === 'string' ? template.title.trim() : '';
        const templateId = template?.id ? String(template.id) : null;
        if (templateId && existingIds.has(templateId)) return;
        if (!templateId && templateTitle && existingTitles.has(templateTitle.toLowerCase())) return;
        const newSubtask = {
          id: templateId || generateSubtaskId(),
          title: templateTitle,
          memo: typeof template?.memo === 'string' ? template.memo : '',
          completed: Boolean(template?.completed),
          buyerLink: null,
        };
        base.push(newSubtask);
        existingIds.add(newSubtask.id);
        if (templateTitle) existingTitles.add(templateTitle.toLowerCase());
        mutated = true;
      });
    });
    return mutated ? base : currentSubtasks;
  };

  useEffect(() => {
    if (!Array.isArray(automationRules) || automationRules.length === 0) return;
    const currentTags = Array.isArray(editableTask.tags) ? editableTask.tags : [];
    if (currentTags.length === 0) return;
    const currentSubtasks = Array.isArray(editableTask.subtasks) ? editableTask.subtasks : [];
    const merged = mergeAutomationTemplates(currentTags, currentSubtasks);
    if (merged !== currentSubtasks) {
      setEditableTask((prev) => ({ ...prev, subtasks: merged }));
    }
  }, [automationRuleMap, automationRules, editableTask.tags, editableTask.subtasks]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setEditableTask((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    const sanitizedSubtasks = (Array.isArray(editableTask.subtasks) ? editableTask.subtasks : []).map(
      (subtask, index) => ({
        ...subtask,
        title: subtask.title?.trim() || '',
        memo: typeof subtask.memo === 'string' ? subtask.memo.trim() : '',
        order: index,
      }),
    );

    const sheetsSync = sheetsSyncColumn.trim()
      ? { column: sheetsSyncColumn.trim().toUpperCase(), completionValue: sheetsSyncValue || '〇' }
      : null;

    const taskToSave = {
      ...editableTask,
      status: resolvedStatusValue,
      subtasks: sanitizedSubtasks,
      sheetsSync,
    };

    onSave(taskToSave);

    // 変更されたサブタスクをSheetsに反映（fire-and-forget）
    if (sheetsSync?.column) {
      const originalMap = new Map((task.subtasks || []).map((s) => [s.id, s]));
      sanitizedSubtasks.forEach((s) => {
        if (!s.buyerLink?.rowIndex != null || !s.buyerLink?.sheetName) return;
        const original = originalMap.get(s.id);
        if (original && original.completed === s.completed) return; // 変更なし
        const value = s.completed ? (sheetsSync.completionValue || '〇') : '';
        axios
          .post(`${API_URL}/UpdateBuyerCell`, {
            sheetName: s.buyerLink.sheetName,
            rowIndex: s.buyerLink.rowIndex,
            column: sheetsSync.column,
            value,
          })
          .catch((err) => console.error('Sheets write failed', err));
      });
    }
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
      subtasks: (Array.isArray(prev.subtasks) ? prev.subtasks : []).filter((s) => s.id !== subtaskId),
    }));
  };

  const handleSubtaskTitleChange = (subtaskId, value) => {
    setEditableTask((prev) => ({
      ...prev,
      subtasks: (Array.isArray(prev.subtasks) ? prev.subtasks : []).map((s) =>
        s.id === subtaskId ? { ...s, title: value } : s,
      ),
    }));
  };

  const handleSubtaskMemoChange = (subtaskId, value) => {
    setEditableTask((prev) => ({
      ...prev,
      subtasks: (Array.isArray(prev.subtasks) ? prev.subtasks : []).map((s) =>
        s.id === subtaskId ? { ...s, memo: value } : s,
      ),
    }));
  };

  const handleAddSubtask = (title) => {
    const trimmed = title.trim();
    setEditableTask((prev) => {
      const current = Array.isArray(prev.subtasks) ? prev.subtasks : [];
      return { ...prev, subtasks: [...current, { ...createBlankSubtask(), title: trimmed }] };
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

  // バイヤーリンク
  const handleOpenBuyerSearch = (subtaskId) => {
    setBuyerLinkTargetId(subtaskId);
    setBuyerSearchOpen(true);
  };

  const handleSelectBuyer = (buyerLink) => {
    setEditableTask((prev) => ({
      ...prev,
      subtasks: (prev.subtasks || []).map((s) =>
        s.id === buyerLinkTargetId ? { ...s, buyerLink } : s,
      ),
    }));
    setBuyerLinkTargetId(null);
  };

  const handleRemoveBuyerLink = (subtaskId) => {
    setEditableTask((prev) => ({
      ...prev,
      subtasks: (prev.subtasks || []).map((s) =>
        s.id === subtaskId ? { ...s, buyerLink: null } : s,
      ),
    }));
  };

  const subtasks = useMemo(
    () => (Array.isArray(editableTask.subtasks) ? editableTask.subtasks : []),
    [editableTask.subtasks],
  );
  const completedCount = subtasks.filter((s) => s.completed).length;

  return (
    <>
      <Dialog open onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {task.id ? t('taskDetail.editTitle') : t('taskDetail.createTitle')}
            {syncing && (
              <Chip
                icon={<SyncIcon sx={{ fontSize: '0.9rem !important' }} />}
                label="Sheets同期中..."
                size="small"
                color="info"
                variant="outlined"
              />
            )}
          </Box>
        </DialogTitle>
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
            onChange={(event) => setEditableTask((prev) => ({ ...prev, status: event.target.value }))}
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="h6">{t('taskDetail.attachments.title')}</Typography>
            <AttachmentManager
              value={editableTask.attachments || []}
              onChange={(next) => setEditableTask((prev) => ({ ...prev, attachments: next }))}
            />
          </Box>

          <Divider />

          {/* ── サブタスク ── */}
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
                    alignItems: 'flex-start',
                    gap: 1.5,
                    p: 1,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: subtask.buyerLink ? 'info.light' : 'divider',
                    backgroundColor: subtask.buyerLink ? 'rgba(25,118,210,0.03)' : undefined,
                  }}
                >
                  <DragIndicatorIcon fontSize="small" sx={{ color: 'text.disabled', mt: 0.75 }} />

                  {/* タイトル + バイヤーバッジ */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
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
                    {/* バイヤーリンクバッジ */}
                    {subtask.buyerLink && (
                      <Box sx={{ ml: 5.5, display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                        <Chip
                          size="small"
                          icon={<LinkIcon sx={{ fontSize: '0.85rem !important' }} />}
                          label={subtask.buyerLink.displayName}
                          onDelete={() => handleRemoveBuyerLink(subtask.id)}
                          deleteIcon={<LinkOffIcon sx={{ fontSize: '0.85rem !important' }} />}
                          color="info"
                          variant="outlined"
                          sx={{ fontSize: '0.75rem' }}
                        />
                      </Box>
                    )}
                  </Box>

                  {/* 操作ボタン（リンク + 削除） */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    <Tooltip title={subtask.buyerLink ? 'バイヤーを変更' : 'バイヤーと紐づける'}>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenBuyerSearch(subtask.id)}
                        color={subtask.buyerLink ? 'info' : 'default'}
                      >
                        <LinkIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <IconButton
                      size="small"
                      edge="end"
                      aria-label={t('taskDetail.removeSubtask')}
                      onClick={() => handleRemoveSubtask(subtask.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  {/* メモ欄 */}
                  <TextField
                    fullWidth
                    multiline
                    minRows={2}
                    value={subtask.memo || ''}
                    onChange={(event) => handleSubtaskMemoChange(subtask.id, event.target.value)}
                    label={t('taskDetail.subtaskMemoLabel', { defaultValue: 'Memo' })}
                    placeholder={t('taskDetail.subtaskMemoPlaceholder', { defaultValue: 'Add a memo' })}
                    size="small"
                    sx={{ gridColumn: { xs: '1 / -1', sm: '2 / span 2' } }}
                  />
                </Box>
              ))}
            </Stack>

            {/* サブタスク追加 */}
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

          <Divider />

          {/* ── Sheets連携設定 ── */}
          <Box>
            <Box
              sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setSheetsSyncOpen((v) => !v)}
            >
              <SyncIcon fontSize="small" sx={{ mr: 1, color: sheetsSyncColumn ? 'success.main' : 'text.secondary' }} />
              <Typography variant="subtitle2" color={sheetsSyncColumn ? 'success.main' : 'text.secondary'}>
                Buyers List 連携設定
                {sheetsSyncColumn && ` (列: ${sheetsSyncColumn.toUpperCase()})`}
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              {sheetsSyncOpen ? (
                <ExpandLessIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              ) : (
                <ExpandMoreIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              )}
            </Box>
            <Collapse in={sheetsSyncOpen}>
              <Box sx={{ display: 'flex', gap: 2, mt: 1.5, flexWrap: 'wrap' }}>
                <TextField
                  label="同期する列（例: EH）"
                  value={sheetsSyncColumn}
                  onChange={(e) => setSheetsSyncColumn(e.target.value.toUpperCase())}
                  size="small"
                  sx={{ width: 160 }}
                  placeholder="EH"
                  helperText="Buyers ListのGoogle Sheets列記号"
                  inputProps={{ style: { textTransform: 'uppercase' } }}
                />
                <TextField
                  label="完了とみなす値"
                  value={sheetsSyncValue}
                  onChange={(e) => setSheetsSyncValue(e.target.value)}
                  size="small"
                  sx={{ width: 160 }}
                  placeholder="〇"
                  helperText="この値があれば完了扱い"
                />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                設定後、サブタスクに🔗でバイヤーを紐づけると開くたびにSheetsの状態が反映されます
              </Typography>
            </Collapse>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('taskDetail.cancel')}</Button>
          <Button onClick={handleSubmit} variant="contained">
            {t('taskDetail.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* バイヤー検索ダイアログ */}
      <BuyerSearchDialog
        open={buyerSearchOpen}
        onClose={() => setBuyerSearchOpen(false)}
        onSelect={handleSelectBuyer}
      />
    </>
  );
}
