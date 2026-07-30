import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Button,
  Stack,
  TextField,
  IconButton,
  Checkbox,
  Switch,
  Divider,
  Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CategoryIcon from '@mui/icons-material/Category';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { MuiColorInput } from 'mui-color-input';
import { generateSubtaskId } from './taskUtils';
import { TaskTemplateManager } from './TaskTemplateManager';

const API_URL = '/api';
const DEFAULT_CATEGORY_COLOR = '#1976d2';

const PM_FLOW_TEMPLATE = {
  tag: 'PM案件',
  enabled: true,
  subtasks: [
    { title: 'ハワイからのメール内容を確認・把握', memo: '' },
    { title: '日本語に翻訳してオーナーへ報告', memo: '' },
    { title: 'オーナーの意向・回答を確認', memo: '' },
    { title: 'オーナーの意向を英語でハワイへ連絡', memo: '' },
  ],
};

function normaliseHex(value) {
  if (!value) {
    return '';
  }
  const trimmed = value.trim();
  return trimmed.startsWith('#') ? trimmed : '#' + trimmed;
}

function normalizeRuleForState(rule = {}) {
  const enabled = rule?.enabled !== false;
  const sanitizedSubtasks = Array.isArray(rule?.subtasks) && rule.subtasks.length > 0
    ? rule.subtasks.map((subtask) => ({
        id: subtask?.id || generateSubtaskId(),
        title: typeof subtask?.title === 'string' ? subtask.title : '',
        memo: typeof subtask?.memo === 'string' ? subtask.memo : '',
        completed: Boolean(subtask?.completed),
      }))
    : [{ id: generateSubtaskId(), title: '', memo: '', completed: false }];

  return {
    ...rule,
    tag: typeof rule?.tag === 'string' ? rule.tag : '',
    enabled,
    subtasks: sanitizedSubtasks,
  };
}

function createEmptyAutomationRule() {
  return {
    tag: '',
    enabled: true,
    subtasks: [{ id: generateSubtaskId(), title: '', memo: '', completed: false }],
  };
}

export function SettingsView() {
  const [currentSection, setCurrentSection] = useState(null); // null = index

  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState({ name: '', color: DEFAULT_CATEGORY_COLOR });
  const [savingCategoryId, setSavingCategoryId] = useState(null);
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const [automationRules, setAutomationRules] = useState([]);
  const [savingRuleId, setSavingRuleId] = useState(null);
  const [deletingRuleId, setDeletingRuleId] = useState(null);
  const [newRule, setNewRule] = useState(createEmptyAutomationRule());
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [tagOptions, setTagOptions] = useState([]);

  const loadCategories = async () => {
    const res = await axios.get(`${API_URL}/GetCategories`);
    const cats = res.data ?? [];
    setCategories(cats);
    setCategoryOptions(cats.map(c => typeof c === 'string' ? c : c?.name ?? '').filter(Boolean));
  };

  const loadAutomationRules = async () => {
    const res = await axios.get(`${API_URL}/GetAutomationRules`);
    const rules = Array.isArray(res.data) ? res.data.map(normalizeRuleForState) : [];
    setAutomationRules(rules);
  };

  useEffect(() => {
    loadCategories().catch(() => {
      alert('カテゴリの取得に失敗しました。');
      setCategories([]);
    });

    loadAutomationRules().catch(() => {
      alert('オートメーションルールの取得に失敗しました。');
      setAutomationRules([]);
    });
  }, []);

  const handleNameChange = (id, value) => {
    setCategories((prev) => prev.map((category) => (category.id === id ? { ...category, name: value } : category)));
  };

  const handleColorChange = (id, value) => {
    setCategories((prev) => prev.map((category) => (category.id === id ? { ...category, color: normaliseHex(value) } : category)));
  };

  const handleSaveCategory = async (categoryToSave) => {
    const name = categoryToSave.name?.trim();
    const color = normaliseHex(categoryToSave.color);

    if (!name || !color) {
      alert('カテゴリ名とカラーは必須です。');
      return;
    }

    try {
      setSavingCategoryId(categoryToSave.id);
      const { data } = await axios.put(`${API_URL}/UpdateCategory/${categoryToSave.id}`, { name, color });
      setCategories((prev) => prev.map((category) => (category.id === data.id ? data : category)));
      alert('カテゴリを保存しました。');
    } catch (error) {
      console.error(error);
      alert('カテゴリの保存に失敗しました。');
    } finally {
      setSavingCategoryId(null);
    }
  };

  const handleNewCategoryChange = (field, value) => {
    setNewCategory((prev) => ({
      ...prev,
      [field]: field === 'color' ? normaliseHex(value) : value,
    }));
  };

  const handleAddCategory = async () => {
    const name = newCategory.name.trim();
    const color = normaliseHex(newCategory.color);

    if (!name || !color) {
      alert('カテゴリ名とカラーは必須です。');
      return;
    }

    try {
      setIsAddingCategory(true);
      const { data } = await axios.post(`${API_URL}/AddCategory`, { name, color });
      setCategories((prev) => [...prev, data]);
      setNewCategory({ name: '', color: DEFAULT_CATEGORY_COLOR });
      alert('カテゴリを追加しました。');
    } catch (error) {
      console.error(error);
      alert('カテゴリの追加に失敗しました。');
    } finally {
      setIsAddingCategory(false);
    }
  };

  const updateRuleState = (ruleId, updater) => {
    setAutomationRules((prev) =>
      prev.map((rule) => (rule.id === ruleId ? normalizeRuleForState(updater(rule)) : rule)),
    );
  };

  const handleRuleFieldChange = (ruleId, field, value) => {
    updateRuleState(ruleId, (rule) => ({
      ...rule,
      [field]: field === 'tag' ? value : value,
    }));
  };

  const handleRuleEnabledChange = (ruleId, checked) => {
    updateRuleState(ruleId, (rule) => ({ ...rule, enabled: checked }));
  };

  const handleRuleSubtaskTitleChange = (ruleId, subtaskId, value) => {
    updateRuleState(ruleId, (rule) => ({
      ...rule,
      subtasks: rule.subtasks.map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, title: value } : subtask,
      ),
    }));
  };

  const handleRuleSubtaskMemoChange = (ruleId, subtaskId, value) => {
    updateRuleState(ruleId, (rule) => ({
      ...rule,
      subtasks: rule.subtasks.map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, memo: value } : subtask,
      ),
    }));
  };

  const handleRuleSubtaskCompletedChange = (ruleId, subtaskId, checked) => {
    updateRuleState(ruleId, (rule) => ({
      ...rule,
      subtasks: rule.subtasks.map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, completed: checked } : subtask,
      ),
    }));
  };

  const handleAddSubtaskToRule = (ruleId) => {
    updateRuleState(ruleId, (rule) => ({
      ...rule,
      subtasks: [...rule.subtasks, { id: generateSubtaskId(), title: '', memo: '', completed: false }],
    }));
  };

  const handleRemoveSubtaskFromRule = (ruleId, subtaskId) => {
    updateRuleState(ruleId, (rule) => {
      const nextSubtasks = rule.subtasks.filter((subtask) => subtask.id !== subtaskId);
      return {
        ...rule,
        subtasks: nextSubtasks.length > 0 ? nextSubtasks : [{ id: generateSubtaskId(), title: '', memo: '', completed: false }],
      };
    });
  };

  const handleSaveAutomationRule = async (rule) => {
    const tag = rule.tag?.trim();
    if (!tag) {
      alert('対象タグを入力してください。');
      return;
    }

    const payload = {
      tag,
      enabled: rule.enabled,
      subtasks: rule.subtasks.map((subtask, index) => ({
        id: subtask.id,
        title: subtask.title?.trim() ?? '',
        memo: typeof subtask.memo === 'string' ? subtask.memo.trim() : '',
        completed: Boolean(subtask.completed),
        order: index,
      })),
    };

    try {
      setSavingRuleId(rule.id);
      const { data } = await axios.put(`${API_URL}/UpdateAutomationRule/${rule.id}`, payload);
      setAutomationRules((prev) => prev.map((existing) => (existing.id === data.id ? normalizeRuleForState(data) : existing)));
      alert('オートメーションルールを保存しました。');
    } catch (error) {
      console.error(error);
      alert('オートメーションルールの保存に失敗しました。');
    } finally {
      setSavingRuleId(null);
    }
  };

  const handleDeleteAutomationRule = async (ruleId) => {
    if (!window.confirm('このルールを削除しますか？')) {
      return;
    }

    try {
      setDeletingRuleId(ruleId);
      await axios.delete(`${API_URL}/DeleteAutomationRule/${ruleId}`);
      setAutomationRules((prev) => prev.filter((r) => r.id !== ruleId));
      alert('オートメーションルールを削除しました。');
    } catch (error) {
      console.error(error);
      alert('オートメーションルールの削除に失敗しました。');
    } finally {
      setDeletingRuleId(null);
    }
  };

  const handleApplyPmTemplate = () => {
    setNewRule({
      tag: PM_FLOW_TEMPLATE.tag,
      enabled: PM_FLOW_TEMPLATE.enabled,
      subtasks: PM_FLOW_TEMPLATE.subtasks.map((s) => ({
        id: generateSubtaskId(),
        title: s.title,
        memo: s.memo,
        completed: false,
      })),
    });
  };

  const handleNewRuleFieldChange = (field, value) => {
    setNewRule((prev) => ({
      ...prev,
      [field]: field === 'enabled' ? Boolean(value) : value,
    }));
  };

  const handleNewRuleSubtaskTitleChange = (subtaskId, value) => {
    setNewRule((prev) => ({
      ...prev,
      subtasks: prev.subtasks.map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, title: value } : subtask,
      ),
    }));
  };

  const handleNewRuleSubtaskMemoChange = (subtaskId, value) => {
    setNewRule((prev) => ({
      ...prev,
      subtasks: prev.subtasks.map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, memo: value } : subtask,
      ),
    }));
  };

  const handleNewRuleSubtaskCompletedChange = (subtaskId, checked) => {
    setNewRule((prev) => ({
      ...prev,
      subtasks: prev.subtasks.map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, completed: checked } : subtask,
      ),
    }));
  };

  const handleAddSubtaskToNewRule = () => {
    setNewRule((prev) => ({
      ...prev,
      subtasks: [...prev.subtasks, { id: generateSubtaskId(), title: '', memo: '', completed: false }],
    }));
  };

  const handleRemoveSubtaskFromNewRule = (subtaskId) => {
    setNewRule((prev) => {
      const nextSubtasks = prev.subtasks.filter((subtask) => subtask.id !== subtaskId);
      return {
        ...prev,
        subtasks: nextSubtasks.length > 0 ? nextSubtasks : [{ id: generateSubtaskId(), title: '', memo: '', completed: false }],
      };
    });
  };

  const handleAddAutomationRule = async () => {
    const tag = newRule.tag.trim();
    if (!tag) {
      alert('対象タグを入力してください。');
      return;
    }

    const payload = {
      tag,
      enabled: newRule.enabled,
      subtasks: newRule.subtasks.map((subtask, index) => ({
        id: subtask.id,
        title: subtask.title?.trim() ?? '',
        memo: typeof subtask.memo === 'string' ? subtask.memo.trim() : '',
        completed: Boolean(subtask.completed),
        order: index,
      })),
    };

    try {
      setIsAddingRule(true);
      const { data } = await axios.post(`${API_URL}/CreateAutomationRule`, payload);
      setAutomationRules((prev) => [...prev, normalizeRuleForState(data)]);
      setNewRule(createEmptyAutomationRule());
      alert('オートメーションルールを追加しました。');
    } catch (error) {
      console.error(error);
      alert('オートメーションルールの追加に失敗しました。');
    } finally {
      setIsAddingRule(false);
    }
  };

  // ── サブページ共通ヘッダー ──────────────────────────────────
  const SectionHeader = ({ title, description }) => (
    <Box sx={{ mb: 3 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => setCurrentSection(null)}
        sx={{ mb: 1.5, color: 'text.secondary' }}
        size="small"
      >
        設定に戻る
      </Button>
      <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>{title}</Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{description}</Typography>
      )}
    </Box>
  );

  // ── カテゴリ管理ページ ───────────────────────────────────────
  const CategorySection = () => (
    <Box>
      <SectionHeader
        title="カテゴリ管理"
        description="タスクのカテゴリとカラーを設定します。"
      />
      <Stack spacing={3}>
        <Paper sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>新規カテゴリを追加</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <TextField
              label="カテゴリ名"
              value={newCategory.name}
              onChange={(event) => handleNewCategoryChange('name', event.target.value)}
              fullWidth
              size="small"
            />
            <MuiColorInput
              value={newCategory.color}
              onChange={(color) => handleNewCategoryChange('color', color)}
            />
            <Button variant="contained" onClick={handleAddCategory} disabled={isAddingCategory}>
              追加
            </Button>
          </Stack>
        </Paper>

        <Paper sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>カテゴリの編集</Typography>
          {categories.length === 0 ? (
            <Typography variant="body2" color="text.secondary">カテゴリがありません。</Typography>
          ) : (
            <List disablePadding>
              {categories.map((category) => (
                <ListItem
                  key={category.id}
                  divider
                  secondaryAction={
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleSaveCategory(category)}
                      disabled={savingCategoryId === category.id}
                    >
                      保存
                    </Button>
                  }
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    alignItems={{ sm: 'center' }}
                    sx={{ flexGrow: 1, pr: 8 }}
                  >
                    <TextField
                      label="カテゴリ名"
                      value={category.name || ''}
                      onChange={(event) => handleNameChange(category.id, event.target.value)}
                      fullWidth
                      size="small"
                    />
                    <MuiColorInput
                      value={category.color || '#ffffff'}
                      onChange={(color) => handleColorChange(category.id, color)}
                    />
                  </Stack>
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      </Stack>
    </Box>
  );

  // ── オートメーションルールページ ────────────────────────────
  const AutomationSection = () => (
    <Box>
      <SectionHeader
        title="オートメーションルール"
        description="タグを選択したときに自動的に追加するサブタスクを設定できます。"
      />
      <Stack spacing={3}>
        {/* 新規ルール追加フォーム */}
        <Paper sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>新規ルールを追加</Typography>
            <Button
              variant="outlined"
              startIcon={<AutoFixHighIcon />}
              onClick={handleApplyPmTemplate}
              size="small"
            >
              PMフローテンプレートを使用
            </Button>
          </Box>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
              <TextField
                label="対象タグ"
                value={newRule.tag}
                onChange={(event) => handleNewRuleFieldChange('tag', event.target.value)}
                fullWidth
                size="small"
              />
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                <Switch
                  size="small"
                  checked={newRule.enabled}
                  onChange={(event) => handleNewRuleFieldChange('enabled', event.target.checked)}
                />
                <Typography variant="body2">有効</Typography>
              </Stack>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddAutomationRule}
                disabled={isAddingRule}
                sx={{ flexShrink: 0 }}
              >
                ルールを追加
              </Button>
            </Stack>

            <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>サブタスク</Typography>
            <Stack spacing={1.5}>
              {newRule.subtasks.map((subtask) => (
                <Stack key={subtask.id} spacing={1}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
                    <Checkbox
                      size="small"
                      checked={Boolean(subtask.completed)}
                      onChange={(event) => handleNewRuleSubtaskCompletedChange(subtask.id, event.target.checked)}
                    />
                    <TextField
                      label="サブタスク名"
                      value={subtask.title}
                      size="small"
                      onChange={(event) => handleNewRuleSubtaskTitleChange(subtask.id, event.target.value)}
                      fullWidth
                    />
                    <IconButton
                      size="small"
                      edge="end"
                      onClick={() => handleRemoveSubtaskFromNewRule(subtask.id)}
                      disabled={newRule.subtasks.length === 1}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  <TextField
                    label="メモ"
                    value={subtask.memo || ''}
                    size="small"
                    onChange={(event) => handleNewRuleSubtaskMemoChange(subtask.id, event.target.value)}
                    fullWidth
                    multiline
                    minRows={2}
                  />
                </Stack>
              ))}
              <Button size="small" startIcon={<AddIcon />} onClick={handleAddSubtaskToNewRule} sx={{ alignSelf: 'flex-start' }}>
                サブタスクを追加
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {/* 登録済みルール一覧 */}
        <Box>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            登録済みルール（{automationRules.length}件）
          </Typography>
          {automationRules.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              登録済みのオートメーションルールはありません。
            </Typography>
          ) : (
            <Stack spacing={2}>
              {automationRules.map((rule) => (
                <Paper key={rule.id} variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                      <TextField
                        label="対象タグ"
                        value={rule.tag}
                        size="small"
                        onChange={(event) => handleRuleFieldChange(rule.id, 'tag', event.target.value)}
                        fullWidth
                      />
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                        <Switch
                          size="small"
                          checked={rule.enabled}
                          onChange={(event) => handleRuleEnabledChange(rule.id, event.target.checked)}
                        />
                        <Typography variant="body2">有効</Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleSaveAutomationRule(rule)}
                          disabled={savingRuleId === rule.id}
                        >
                          保存
                        </Button>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteAutomationRule(rule.id)}
                          disabled={deletingRuleId === rule.id}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>

                    <Divider />

                    <Stack spacing={1.5}>
                      {rule.subtasks.map((subtask) => (
                        <Stack key={subtask.id} spacing={1}>
                          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
                            <Checkbox
                              size="small"
                              checked={Boolean(subtask.completed)}
                              onChange={(event) => handleRuleSubtaskCompletedChange(rule.id, subtask.id, event.target.checked)}
                            />
                            <TextField
                              label="サブタスク名"
                              value={subtask.title}
                              size="small"
                              onChange={(event) => handleRuleSubtaskTitleChange(rule.id, subtask.id, event.target.value)}
                              fullWidth
                            />
                            <IconButton
                              size="small"
                              edge="end"
                              onClick={() => handleRemoveSubtaskFromRule(rule.id, subtask.id)}
                              disabled={rule.subtasks.length === 1}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                          <TextField
                            label="メモ"
                            value={subtask.memo || ''}
                            size="small"
                            onChange={(event) => handleRuleSubtaskMemoChange(rule.id, subtask.id, event.target.value)}
                            fullWidth
                            multiline
                            minRows={2}
                          />
                        </Stack>
                      ))}
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => handleAddSubtaskToRule(rule.id)}
                        sx={{ alignSelf: 'flex-start' }}
                      >
                        サブタスクを追加
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Box>
      </Stack>
    </Box>
  );

  // ── テンプレートページ ───────────────────────────────────────
  const TemplateSection = () => (
    <Box>
      <SectionHeader
        title="タスクテンプレート"
        description="よく使うタスク構成（サブタスク・カテゴリ・タグ）をテンプレートとして保存します。新規タスク作成時に適用できます。"
      />
      <TaskTemplateManager categoryOptions={categoryOptions} tagOptions={tagOptions} />
    </Box>
  );

  // ── インデックスページ ───────────────────────────────────────
  const SECTIONS = [
    {
      id: 'categories',
      title: 'カテゴリ管理',
      description: 'タスクカテゴリの追加・編集・カラー設定',
      icon: <CategoryIcon color="primary" />,
      badge: categories.length > 0 ? `${categories.length}件` : null,
    },
    {
      id: 'automation',
      title: 'オートメーションルール',
      description: 'タグ選択時にサブタスクを自動追加するルールを管理',
      icon: <AutoAwesomeIcon color="warning" />,
      badge: automationRules.length > 0 ? `${automationRules.length}件` : null,
    },
    {
      id: 'templates',
      title: 'タスクテンプレート',
      description: 'よく使うタスク構成をテンプレートとして保存・再利用',
      icon: <ContentCopyIcon color="success" />,
      badge: null,
    },
  ];

  // ── レンダー ─────────────────────────────────────────────────
  if (currentSection === 'categories') return <CategorySection />;
  if (currentSection === 'automation') return <AutomationSection />;
  if (currentSection === 'templates') return <TemplateSection />;

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
        設定
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        設定する項目を選択してください。
      </Typography>

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <List disablePadding>
          {SECTIONS.map((section, idx) => (
            <Box key={section.id}>
              <ListItemButton
                onClick={() => setCurrentSection(section.id)}
                sx={{ py: 2, px: 2.5 }}
              >
                <ListItemIcon sx={{ minWidth: 44 }}>
                  {section.icon}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>{section.title}</Typography>
                      {section.badge && (
                        <Chip label={section.badge} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                      )}
                    </Box>
                  }
                  secondary={section.description}
                />
                <ChevronRightIcon color="action" />
              </ListItemButton>
              {idx < SECTIONS.length - 1 && <Divider />}
            </Box>
          ))}
        </List>
      </Paper>
    </Box>
  );
}






