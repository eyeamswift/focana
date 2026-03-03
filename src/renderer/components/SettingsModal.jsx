import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Switch } from './ui/Switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/Tabs';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';
import { Settings, Keyboard, RotateCcw, AlertTriangle, Zap, X, PanelTop } from 'lucide-react';

const DEFAULT_SHORTCUTS = {
  startPause: 'CommandOrControl+Shift+S',
  newTask: 'CommandOrControl+N',
  toggleIncognito: 'CommandOrControl+Shift+I',
  completeTask: 'CommandOrControl+Enter',
  openParkingLot: 'CommandOrControl+Shift+P',
};

const SHORTCUT_DESCRIPTIONS = {
  startPause: 'Start/Pause Timer',
  newTask: 'New/Edit Task',
  toggleIncognito: 'Toggle Incognito Mode',
  completeTask: 'Complete Task + Celebrate',
  openParkingLot: 'Open Parking Lot (Quick Capture)',
};

const MAIN_SCREEN_ACTIONS = [
  'Light mode/Dark mode',
  'View Parking Lot',
  'View Session History',
  'Restart',
  'Close',
];

export default function SettingsModal({
  isOpen,
  onClose,
  theme = 'light',
  onToggleTheme,
  onOpenParkingLot,
  onOpenSessionHistory,
  onRestartApp,
  onCloseApp,
  shortcuts,
  onShortcutsChange,
  shortcutsEnabledDefault,
  onShortcutsEnabledChange,
  pulseSettings,
  onPulseSettingsChange,
  showTaskInCompactDefault,
  pinControlsToToolbarDefault,
  onPinControlsToToolbarChange,
  onShowTaskInCompactDefaultChange,
  dndEnabled,
  onDndChange,
  checkInSettings,
  onCheckInSettingsChange,
}) {
  const [tempShortcuts, setTempShortcuts] = useState(shortcuts || DEFAULT_SHORTCUTS);
  const [tempPulseSettings, setTempPulseSettings] = useState(pulseSettings || {
    incognitoEnabled: true,
  });
  const [shortcutsEnabled, setShortcutsEnabled] = useState(true);
  const [bringToFront, setBringToFront] = useState(true);
  const [keepTextAfterCompletion, setKeepTextAfterCompletion] = useState(false);
  const [showTaskInCompact, setShowTaskInCompact] = useState(showTaskInCompactDefault ?? true);
  const [pinControlsToToolbar, setPinControlsToToolbar] = useState(pinControlsToToolbarDefault ?? false);
  const [doNotDisturb, setDoNotDisturb] = useState(dndEnabled ?? false);
  const [checkInEnabled, setCheckInEnabled] = useState(checkInSettings?.enabled ?? true);
  const [checkInIntervalFreeflow, setCheckInIntervalFreeflow] = useState(checkInSettings?.intervalFreeflow ?? 15);
  const [recordingKey, setRecordingKey] = useState(null);
  const [conflicts, setConflicts] = useState({});
  const recordingCleanupRef = useRef(null);

  useEffect(() => {
    return () => {
      if (recordingCleanupRef.current) {
        recordingCleanupRef.current();
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTempShortcuts(shortcuts || DEFAULT_SHORTCUTS);
      setTempPulseSettings(pulseSettings || {
        incognitoEnabled: true,
      });

      // Load settings from electron-store
      (async () => {
        const settings = await window.electronAPI.storeGet('settings') || {};
        setShortcutsEnabled(settings.shortcutsEnabled ?? shortcutsEnabledDefault ?? true);
        setBringToFront(settings.bringToFront ?? true);
        setKeepTextAfterCompletion(settings.keepTextAfterCompletion ?? false);
        const hasExplicitCompactSetting = settings.showTaskInCompactCustomized === true;
        setShowTaskInCompact(
          hasExplicitCompactSetting
            ? (settings.showTaskInCompactDefault ?? showTaskInCompactDefault ?? true)
            : true
        );
        setPinControlsToToolbar(settings.pinControlsToToolbar ?? pinControlsToToolbarDefault ?? false);
        setDoNotDisturb(settings.doNotDisturbEnabled ?? dndEnabled ?? false);
        setCheckInEnabled(settings.checkInEnabled ?? checkInSettings?.enabled ?? true);
        setCheckInIntervalFreeflow(
          Number.isFinite(settings.checkInIntervalFreeflow) ? settings.checkInIntervalFreeflow : (checkInSettings?.intervalFreeflow ?? 15)
        );
      })();
    }
  }, [isOpen, shortcuts, pulseSettings, showTaskInCompactDefault, shortcutsEnabledDefault, pinControlsToToolbarDefault, dndEnabled, checkInSettings]);

  const handleSave = async () => {
    onShortcutsChange(tempShortcuts);
    onPulseSettingsChange(tempPulseSettings);

    const settings = await window.electronAPI.storeGet('settings') || {};
    settings.shortcutsEnabled = shortcutsEnabled;
    settings.bringToFront = bringToFront;
    settings.keepTextAfterCompletion = keepTextAfterCompletion;
    settings.showTaskInCompactDefault = showTaskInCompact;
    settings.showTaskInCompactCustomized = true;
    settings.pinControlsToToolbar = pinControlsToToolbar;
    settings.doNotDisturbEnabled = doNotDisturb;
    settings.checkInEnabled = checkInEnabled;
    settings.checkInIntervalFreeflow = checkInIntervalFreeflow;
    settings.shortcuts = tempShortcuts;
    settings.pulseSettings = tempPulseSettings;
    await window.electronAPI.storeSet('settings', settings);
    onShortcutsEnabledChange?.(shortcutsEnabled);
    onShowTaskInCompactDefaultChange?.(showTaskInCompact);
    onPinControlsToToolbarChange?.(pinControlsToToolbar);
    onDndChange?.(doNotDisturb);
    onCheckInSettingsChange?.({ enabled: checkInEnabled, intervalFreeflow: checkInIntervalFreeflow });

    onClose();
  };

  const handleRestoreDefaults = () => {
    setTempShortcuts(DEFAULT_SHORTCUTS);
    setTempPulseSettings({
      incognitoEnabled: true,
    });
    setShortcutsEnabled(true);
    setBringToFront(true);
    setKeepTextAfterCompletion(false);
    setShowTaskInCompact(true);
    setPinControlsToToolbar(false);
    setDoNotDisturb(false);
    setCheckInEnabled(true);
    setCheckInIntervalFreeflow(15);
    setConflicts({});
  };

  const handleShortcutRecord = (key) => {
    if (recordingCleanupRef.current) {
      recordingCleanupRef.current();
    }

    setRecordingKey(key);

    const handleKeyPress = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const modifiers = [];
      if (e.metaKey || e.ctrlKey) modifiers.push(e.metaKey ? 'Cmd' : 'Ctrl');
      if (e.shiftKey) modifiers.push('Shift');
      if (e.altKey) modifiers.push('Alt');

      const keyName = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
      const shortcut = modifiers.length > 0 ? `${modifiers.join('+')}+${keyName}` : keyName;

      const existingKey = Object.entries(tempShortcuts).find(([k, v]) => k !== key && v === shortcut);
      if (existingKey) {
        setConflicts({ [key]: `Conflicts with ${SHORTCUT_DESCRIPTIONS[existingKey[0]]}` });
      } else {
        setConflicts({ ...conflicts, [key]: null });
        setTempShortcuts({ ...tempShortcuts, [key]: shortcut });
      }

      setRecordingKey(null);
      cleanup();
    };

    const timeoutId = setTimeout(() => {
      setRecordingKey(null);
      cleanup();
    }, 10000);

    const cleanup = () => {
      document.removeEventListener('keydown', handleKeyPress);
      clearTimeout(timeoutId);
      recordingCleanupRef.current = null;
    };

    document.addEventListener('keydown', handleKeyPress);
    recordingCleanupRef.current = cleanup;
  };

  const formatShortcutDisplay = (shortcut) => {
    if (!shortcut) return '';
    return shortcut
      .replace('CommandOrControl', '\u2318')
      .replace('Cmd', '\u2318')
      .replace('Ctrl', 'Ctrl')
      .replace('Shift', '\u21E7')
      .replace('Alt', '\u2325');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="dialog-content-lg" style={{ background: 'var(--bg-surface)', borderColor: 'var(--brand-action)' }}>
        <button className="dialog-close-btn" onClick={onClose} aria-label="Close">
          <X style={{ width: 16, height: 16 }} />
        </button>
        <DialogHeader>
          <DialogTitle style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings style={{ width: 24, height: 24, color: 'var(--brand-action)' }} />
            Settings
          </DialogTitle>
        </DialogHeader>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <Button onClick={handleSave} size="sm" style={{ background: 'var(--brand-primary)', color: 'var(--text-on-brand)' }}>
            Save Settings
          </Button>
        </div>

        <Tabs defaultValue="main" style={{ marginTop: '1rem' }}>
          <TabsList style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <TabsTrigger value="main">
              <PanelTop style={{ width: 16, height: 16 }} />
              Main
            </TabsTrigger>
            <TabsTrigger value="shortcuts">
              <Keyboard style={{ width: 16, height: 16 }} />
              Shortcuts
            </TabsTrigger>
            <TabsTrigger value="pulse">
              <Zap style={{ width: 16, height: 16 }} />
              Pulse
            </TabsTrigger>
          </TabsList>

          <TabsContent value="main" className="space-y-4" style={{ marginTop: '1.25rem' }}>
            <div className="space-y-4">
              <div style={{
                padding: '0.75rem',
                background: 'var(--bg-card)',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-subtle)',
              }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>Main Screen Controls</h3>
                <div className="space-y-2" style={{ marginTop: '0.75rem' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    padding: '0.5rem 0.625rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{MAIN_SCREEN_ACTIONS[0]}</span>
                    <Switch
                      checked={theme === 'dark'}
                      onCheckedChange={(checked) => {
                        if ((theme === 'dark') !== checked) onToggleTheme?.();
                      }}
                    />
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    padding: '0.5rem 0.625rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{MAIN_SCREEN_ACTIONS[1]}</span>
                    <Button size="sm" variant="outline" onClick={onOpenParkingLot} style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}>
                      Open
                    </Button>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    padding: '0.5rem 0.625rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{MAIN_SCREEN_ACTIONS[2]}</span>
                    <Button size="sm" variant="outline" onClick={onOpenSessionHistory} style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}>
                      Open
                    </Button>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    padding: '0.5rem 0.625rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{MAIN_SCREEN_ACTIONS[3]}</span>
                    <Button size="sm" variant="outline" onClick={onRestartApp} style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}>
                      Restart
                    </Button>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    padding: '0.5rem 0.625rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{MAIN_SCREEN_ACTIONS[4]}</span>
                    <Button size="sm" variant="outline" onClick={onCloseApp} style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}>
                      Close
                    </Button>
                  </div>
                </div>
              </div>

              <div style={{
                padding: '0.75rem',
                background: 'var(--bg-card)',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-subtle)',
              }} className="space-y-3">
                <h4 style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Behavior Settings</h4>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Lock task in compact mode</span>
                  <Switch checked={showTaskInCompact} onCheckedChange={setShowTaskInCompact} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Bring Focana to front on shortcut</span>
                  <Switch checked={bringToFront} onCheckedChange={setBringToFront} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Keep text after task completion</span>
                  <Switch checked={keepTextAfterCompletion} onCheckedChange={setKeepTextAfterCompletion} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Pin controls to toolbar</span>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.7, marginTop: '0.125rem' }}>Show theme, history, and restart in the top bar</p>
                  </div>
                  <Switch checked={pinControlsToToolbar} onCheckedChange={setPinControlsToToolbar} />
                </div>
              </div>

              <div style={{
                padding: '0.75rem',
                background: 'var(--bg-card)',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-subtle)',
              }} className="space-y-3">
                <h4 style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Focus Check-ins</h4>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Focus check-ins</span>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.7, marginTop: '0.125rem' }}>Periodic nudges to check if you're still focused</p>
                  </div>
                  <Switch checked={checkInEnabled} onCheckedChange={setCheckInEnabled} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: checkInEnabled ? 1 : 0.5 }}>
                  <div>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Check-in interval (freeflow)</span>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.7, marginTop: '0.125rem' }}>Minutes between check-ins in freeflow sessions</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <input
                      type="number"
                      min="5"
                      max="60"
                      value={checkInIntervalFreeflow}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (Number.isFinite(val)) setCheckInIntervalFreeflow(Math.min(60, Math.max(5, val)));
                      }}
                      disabled={!checkInEnabled}
                      className="input"
                      style={{
                        width: '3.5rem',
                        textAlign: 'center',
                        height: '2rem',
                        fontSize: '0.8125rem',
                        padding: '0 0.25rem',
                      }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>min</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Do Not Disturb</span>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.7, marginTop: '0.125rem' }}>Mute check-in prompts and ambient pulse</p>
                  </div>
                  <Switch checked={doNotDisturb} onCheckedChange={setDoNotDisturb} />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="shortcuts" className="space-y-4" style={{ marginTop: '1.25rem' }}>
            <div className="space-y-4">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>Global Shortcuts</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Click the action to set shortcut</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Enable All</span>
                  <Switch checked={shortcutsEnabled} onCheckedChange={setShortcutsEnabled} />
                </div>
              </div>

              {Object.entries(SHORTCUT_DESCRIPTIONS).map(([key, description]) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => handleShortcutRecord(key)}
                  disabled={!shortcutsEnabled}
                  style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: 'var(--bg-card)',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-subtle)',
                  cursor: shortcutsEnabled ? 'pointer' : 'not-allowed',
                  opacity: shortcutsEnabled ? 1 : 0.65,
                  textAlign: 'left',
                }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{description}</p>
                    {conflicts[key] && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                        <AlertTriangle style={{ width: 12, height: 12, color: '#DC2626' }} />
                        <span style={{ fontSize: '0.75rem', color: '#DC2626' }}>{conflicts[key]}</span>
                      </div>
                    )}
                  </div>
                  <span
                    style={{
                      minWidth: 120,
                      marginLeft: '0.75rem',
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      borderRadius: '0.375rem',
                      padding: '0.375rem 0.5rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      whiteSpace: 'nowrap',
                      background: recordingKey === key ? 'var(--brand-primary)' : 'var(--pause-bg)',
                      color: recordingKey === key ? 'var(--text-on-brand)' : 'var(--pause-fg)',
                      border: recordingKey === key ? '1px solid var(--brand-primary)' : '1px solid var(--border-strong)',
                    }}
                  >
                    {recordingKey === key ? 'Press keys...' : formatShortcutDisplay(tempShortcuts[key])}
                  </span>
                </button>
              ))}

              <div style={{
                fontSize: '0.75rem',
                color: '#1E40AF',
                padding: '0.75rem',
                background: '#EFF6FF',
                borderRadius: '0.5rem',
                border: '1px solid #BFDBFE',
              }}>
                <p style={{ fontWeight: 500, marginBottom: '0.25rem' }}>macOS Note:</p>
                <p>If Cmd+Space conflicts with Spotlight, consider using Cmd+Shift+S for Start/Pause Timer.</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="pulse" className="space-y-4" style={{ marginTop: '1.25rem' }}>
            <div className="space-y-4">
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>Incognito Pulse</h3>

              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)',
              }}>
                <div>
                  <p style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Incognito Mode Pulse</p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Subtle presence indicator in pill view</p>
                </div>
                <Switch
                  checked={tempPulseSettings.incognitoEnabled}
                  onCheckedChange={(checked) => setTempPulseSettings({ ...tempPulseSettings, incognitoEnabled: checked })}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter style={{
          gap: '0.5rem',
          marginTop: '1.25rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--border-default)',
          flexWrap: 'wrap',
          rowGap: '0.5rem',
        }}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleRestoreDefaults} variant="outline" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)', marginRight: 'auto' }}>
                <RotateCcw style={{ width: 16, height: 16, marginRight: '0.5rem' }} />
                Restore Defaults
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Reset all settings to default values</p></TooltipContent>
          </Tooltip>
          <Button onClick={onClose} variant="outline" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}>
            Cancel
          </Button>
          <Button onClick={handleSave} style={{ background: 'var(--brand-primary)', color: 'var(--text-on-brand)' }}>
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
