// app/src/DashboardSettingsModal.jsx

import { useState } from 'react'; //
import { Dialog, DialogTitle, DialogContent, FormGroup, FormControlLabel, Checkbox, DialogActions, Button } from '@mui/material';

export function DashboardSettingsModal({ open, onClose, settings, onSave }) {
  const [localSettings, setLocalSettings] = useState(settings);

  const handleChange = (event) => {
    setLocalSettings({
      ...localSettings,
      [event.target.name]: event.target.checked,
    });
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>ダッシュボードに表示するカードを選択</DialogTitle>
      <DialogContent>
        <FormGroup>
          <FormControlLabel
            control={<Checkbox checked={localSettings.showHighPriority} onChange={handleChange} name="showHighPriority" />}
            label="重要度の高いタスク"
          />
          <FormControlLabel
            control={<Checkbox checked={localSettings.showMyTasks} onChange={handleChange} name="showMyTasks" />}
            label="あなたの担当タスク"
          />
          <FormControlLabel
            control={<Checkbox checked={localSettings.showUpcoming} onChange={handleChange} name="showUpcoming" />}
            label="期日の近いタスク"
          />
        </FormGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={() => onSave(localSettings)} variant="contained">保存</Button>
      </DialogActions>
    </Dialog>
  );
}