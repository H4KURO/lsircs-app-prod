import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  Button,
  Stack,
  TextField,
  IconButton,
  Checkbox,
  Switch,
  Divider,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { MuiColorInput } from 'mui-color-input';
import { generateSubtaskId } from './taskUtils';

const API_URL = '/api';
const DEFAULT_CATEGORY_COLOR = '#1976d2';

function normaliseHex(value) {
  if (!value) {
    return '';
  }
  const trimmed = value.trim();
  return trimmed.startsWith('#') ? trimmed : #;
}

function normalizeRuleForState(rule = {}) {
  const enabled = rule?.enabled !== false;
  const sanitizedSubtasks = Array.isArray(rule?.subtasks) && rule.subtasks.length > 0
    ? rule.subtasks.map((subtask) => ({
        id: subtask?.id || generateSubtaskId(),
        title: typeof subtask?.title === 'string' ? subtask.title : '',
        completed: Boolean(subtask?.completed),
      }))
    : [{ id: generateSubtaskId(), title: '', completed: false }];

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
    subtasks: [{ id: generateSubtaskId(), title: '', completed: false }],
  };
}

export function SettingsView() {
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState({ name: '', color: DEFAULT_CATEGORY_COLOR });
  const [savingCategoryId, setSavingCategoryId] = useState(null);
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const [automationRules, setAutomationRules] = useState([]);
  const [savingRuleId, setSavingRuleId] = useState(null);
  const [deletingRuleId, setDeletingRuleId] = useState(null);
  const [newRule, setNewRule] = useState(createEmptyAutomationRule());
  const [isAddingRule, setIsAddingRule] = useState(false);

  const loadCategories = async () => {
    const res = await axios.get(`${API_URL}/GetCategories`);
    setCategories(res.data ?? []);
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
      subtasks: [...rule.subtasks, { id: generateSubtaskId(), title: '', completed: false }],
    }));
  };

  const handleRemoveSubtaskFromRule = (ruleId, subtaskId) => {
    updateRuleState(ruleId, (rule) => {
      const nextSubtasks = rule.subtasks.filter((subtask) => subtask.id !== subtaskId);
      return {
        ...rule,
        subtasks: nextSubtasks.length > 0 ? nextSubtasks : [{ id: generateSubtaskId(), title: '', completed: false }],
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
      alert('オートメーションルールを削除しました。');
    } catch (error) {
      console.error(error);
      alert('オートメーションルールの削除に失敗しました。');
    } finally {
      setDeletingRuleId(null);
    }
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
      subtasks: [...prev.subtasks, { id: generateSubtaskId(), title: '', completed: false }],
    }));
  };

  const handleRemoveSubtaskFromNewRule = (subtaskId) => {
    setNewRule((prev) => {
      const nextSubtasks = prev.subtasks.filter((subtask) => subtask.id !== subtaskId);
      return {
        ...prev,
        subtasks: nextSubtasks.length > 0 ? nextSubtasks : [{ id: generateSubtaskId(), title: '', completed: false }],
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

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        設定
      </Typography>

      <Stack spacing={3}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            新規カテゴリを追加
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <TextField
              label="カテゴリ名"
              value={newCategory.name}
              onChange={(event) => handleNewCategoryChange('name', event.target.value)}
              fullWidth
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

        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            カテゴリの編集
          </Typography>
          <List>
            {categories.map((category) => (
              <ListItem
                key={category.id}
                divider
                secondaryAction={
                  <Button
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
                  sx={{ flexGrow: 1 }}
                >
                  <TextField
                    label="カテゴリ名"
                    value={category.name || ''}
                    onChange={(event) => handleNameChange(category.id, event.target.value)}
                    fullWidth
                  />
                  <MuiColorInput
                    value={category.color || '#ffffff'}
                    onChange={(color) => handleColorChange(category.id, color)}
                  />
                </Stack>
              </ListItem>
            ))}
          </List>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            オートメーションルール
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            タグを選択したときに自動的に追加するサブタスクを設定できます。
          </Typography>

          <Stack spacing={2} sx={{ mb: 3 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
              <TextField
                label="対象タグ"
                value={newRule.tag}
                onChange={(event) => handleNewRuleFieldChange('tag', event.target.value)}
                fullWidth
              />
              <Stack direction="row" spacing={1} alignItems="center">
                <Switch
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
              >
                ルールを追加
              </Button>
            </Stack>

            <Stack spacing={1.5}>
              {newRule.subtasks.map((subtask) => (
                <Stack
                  key={subtask.id}
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.5}
                  alignItems={{ md: 'center' }}
                >
                  <Checkbox
                    checked={Boolean(subtask.completed)}
                    onChange={(event) => handleNewRuleSubtaskCompletedChange(subtask.id, event.target.checked)}
                  />
                  <TextField
                    label="サブタスク名"
                    value={subtask.title}
                    onChange={(event) => handleNewRuleSubtaskTitleChange(subtask.id, event.target.value)}
                    fullWidth
                  />
                  <IconButton
                    edge="end"
                    onClick={() => handleRemoveSubtaskFromNewRule(subtask.id)}
                    disabled={newRule.subtasks.length === 1}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Stack>
              ))}
              <Button startIcon={<AddIcon />} onClick={handleAddSubtaskToNewRule} sx={{ alignSelf: 'flex-start' }}>
                サブタスクを追加
              </Button>
            </Stack>
          </Stack>

          <Divider sx={{ my: 3 }} />

          <Stack spacing={2}>
            {automationRules.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                登録済みのオートメーションルールはありません。
              </Typography>
            ) : (
              automationRules.map((rule) => (
                <Paper key={rule.id} variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                      <TextField
                        label="対象タグ"
                        value={rule.tag}
                        onChange={(event) => handleRuleFieldChange(rule.id, 'tag', event.target.value)}
                        fullWidth
                      />
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Switch
                          checked={rule.enabled}
                          onChange={(event) => handleRuleEnabledChange(rule.id, event.target.checked)}
                        />
                        <Typography variant="body2">有効</Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Button
                          variant="contained"
                          onClick={() => handleSaveAutomationRule(rule)}
                          disabled={savingRuleId === rule.id}
                        >
                          保存
                        </Button>
                        <IconButton
                          color="error"
                          onClick={() => handleDeleteAutomationRule(rule.id)}
                          disabled={deletingRuleId === rule.id}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Stack>
                    </Stack>

                    <Divider />

                    <Stack spacing={1.5}>
                      {rule.subtasks.map((subtask) => (
                        <Stack
                          key={subtask.id}
                          direction={{ xs: 'column', md: 'row' }}
                          spacing={1.5}
                          alignItems={{ md: 'center' }}
                        >
                          <Checkbox
                            checked={Boolean(subtask.completed)}
                            onChange={(event) => handleRuleSubtaskCompletedChange(rule.id, subtask.id, event.target.checked)}
                          />
                          <TextField
                            label="サブタスク名"
                            value={subtask.title}
                            onChange={(event) => handleRuleSubtaskTitleChange(rule.id, subtask.id, event.target.value)}
                            fullWidth
                          />
                          <IconButton
                            edge="end"
                            onClick={() => handleRemoveSubtaskFromRule(rule.id, subtask.id)}
                            disabled={rule.subtasks.length === 1}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Stack>
                      ))}
                      <Button
                        startIcon={<AddIcon />}
                        onClick={() => handleAddSubtaskToRule(rule.id)}
                        sx={{ alignSelf: 'flex-start' }}
                      >
                        サブタスクを追加
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))
            )}
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}




