import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Switch } from './ui/Switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/Tabs';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';
import { Settings, Keyboard, RotateCcw, AlertTriangle, Zap, X } from 'lucide-react';

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

export default function SettingsModal({
  isOpen,
  onClose,
  shortcuts,
  onShortcutsChange,
  shortcutsEnabledDefault,
  onShortcutsEnabledChange,
  pulseSettings,
  onPulseSettingsChange,
  showTaskInCompactDefault,
  onShowTaskInCompactDefaultChange,
}) {
  const [tempShortcuts, setTempShortcuts] = useState(shortcuts || DEFAULT_SHORTCUTS);
  const [tempPulseSettings, setTempPulseSettings] = useState(pulseSettings || {
    timeAwarenessEnabled: true,
    timeAwarenessInterval: 30,
    celebrationEnabled: true,
    incognitoEnabled: true,
  });
  const [shortcutsEnabled, setShortcutsEnabled] = useState(true);
  const [bringToFront, setBringToFront] = useState(true);
  const [keepTextAfterCompletion, setKeepTextAfterCompletion] = useState(false);
  const [showTaskInCompact, setShowTaskInCompact] = useState(showTaskInCompactDefault ?? false);
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
        timeAwarenessEnabled: true,
        timeAwarenessInterval: 30,
        celebrationEnabled: true,
        incognitoEnabled: true,
      });

      // Load settings from electron-store
      (async () => {
        const settings = await window.electronAPI.storeGet('settings') || {};
        setShortcutsEnabled(settings.shortcutsEnabled ?? shortcutsEnabledDefault ?? true);
        setBringToFront(settings.bringToFront ?? true);
        setKeepTextAfterCompletion(settings.keepTextAfterCompletion ?? false);
        setShowTaskInCompact(settings.showTaskInCompactDefault ?? showTaskInCompactDefault ?? false);
      })();
    }
  }, [isOpen, shortcuts, pulseSettings, showTaskInCompactDefault, shortcutsEnabledDefault]);

  const handleSave = async () => {
    onShortcutsChange(tempShortcuts);
    onPulseSettingsChange(tempPulseSettings);

    const settings = await window.electronAPI.storeGet('settings') || {};
    settings.shortcutsEnabled = shortcutsEnabled;
    settings.bringToFront = bringToFront;
    settings.keepTextAfterCompletion = keepTextAfterCompletion;
    settings.showTaskInCompactDefault = showTaskInCompact;
    settings.shortcuts = tempShortcuts;
    settings.pulseSettings = tempPulseSettings;
    await window.electronAPI.storeSet('settings', settings);
    onShortcutsEnabledChange?.(shortcutsEnabled);
    onShowTaskInCompactDefaultChange?.(showTaskInCompact);

    onClose();
  };

  const handleRestoreDefaults = () => {
    setTempShortcuts(DEFAULT_SHORTCUTS);
    setTempPulseSettings({
      timeAwarenessEnabled: true,
      timeAwarenessInterval: 30,
      celebrationEnabled: true,
      incognitoEnabled: true,
    });
    setShortcutsEnabled(true);
    setBringToFront(true);
    setKeepTextAfterCompletion(false);
    setShowTaskInCompact(false);
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
      <DialogContent className="dialog-content-lg" style={{ background: '#FFFEF8', borderColor: '#D97706' }}>
        <button className="dialog-close-btn" onClick={onClose} aria-label="Close">
          <X style={{ width: 16, height: 16 }} />
        </button>
        <DialogHeader>
          <DialogTitle style={{ fontSize: '1.25rem', fontWeight: 700, color: '#5C4033', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings style={{ width: 24, height: 24, color: '#D97706' }} />
            Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="shortcuts" style={{ marginTop: '1rem' }}>
          <TabsList style={{ gridTemplateColumns: '1fr 1fr' }}>
            <TabsTrigger value="shortcuts">
              <Keyboard style={{ width: 16, height: 16 }} />
              Shortcuts
            </TabsTrigger>
            <TabsTrigger value="pulse">
              <Zap style={{ width: 16, height: 16 }} />
              Pulse
            </TabsTrigger>
          </TabsList>

          <TabsContent value="shortcuts" className="space-y-4" style={{ marginTop: '1.25rem' }}>
            <div className="space-y-4">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#5C4033' }}>Global Shortcuts</h3>
                  <p style={{ fontSize: '0.875rem', color: '#8B6F47' }}>Work even when Focana isn't focused</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: '#8B6F47' }}>Enable All</span>
                  <Switch checked={shortcutsEnabled} onCheckedChange={setShortcutsEnabled} />
                </div>
              </div>

              {Object.entries(SHORTCUT_DESCRIPTIONS).map(([key, description]) => (
                <div key={key} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  background: '#FFF9E6',
                  borderRadius: '0.5rem',
                  border: '1px solid rgba(139,111,71,0.1)',
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 500, color: '#5C4033', fontSize: '0.875rem' }}>{description}</p>
                    {conflicts[key] && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                        <AlertTriangle style={{ width: 12, height: 12, color: '#DC2626' }} />
                        <span style={{ fontSize: '0.75rem', color: '#DC2626' }}>{conflicts[key]}</span>
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() => handleShortcutRecord(key)}
                    variant="outline"
                    disabled={!shortcutsEnabled}
                    style={{
                      minWidth: 120,
                      fontFamily: 'ui-monospace, monospace',
                      background: recordingKey === key ? '#F59E0B' : 'transparent',
                      color: recordingKey === key ? 'white' : '#5C4033',
                      borderColor: recordingKey === key ? '#F59E0B' : 'rgba(139,111,71,0.3)',
                    }}
                  >
                    {recordingKey === key ? 'Press keys...' : formatShortcutDisplay(tempShortcuts[key])}
                  </Button>
                </div>
              ))}

              <div style={{
                padding: '0.75rem',
                background: '#FFF9E6',
                borderRadius: '0.5rem',
                border: '1px solid rgba(139,111,71,0.1)',
              }} className="space-y-3">
                <h4 style={{ fontWeight: 500, color: '#5C4033' }}>Behavior Settings</h4>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', color: '#8B6F47' }}>Bring Focana to front on shortcut</span>
                  <Switch checked={bringToFront} onCheckedChange={setBringToFront} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', color: '#8B6F47' }}>Keep text after task completion</span>
                  <Switch checked={keepTextAfterCompletion} onCheckedChange={setKeepTextAfterCompletion} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', color: '#8B6F47' }}>Show task in compact mode by default</span>
                  <Switch checked={showTaskInCompact} onCheckedChange={setShowTaskInCompact} />
                </div>
              </div>

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
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#5C4033' }}>Pulse Animations</h3>

              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.75rem', background: '#FFF9E6', borderRadius: '0.5rem', border: '1px solid rgba(139,111,71,0.1)',
              }}>
                <div>
                  <p style={{ fontWeight: 500, color: '#5C4033' }}>Time Awareness Pulse</p>
                  <p style={{ fontSize: '0.875rem', color: '#8B6F47' }}>Gentle reminder every few minutes</p>
                </div>
                <Switch
                  checked={tempPulseSettings.timeAwarenessEnabled}
                  onCheckedChange={(checked) => setTempPulseSettings({ ...tempPulseSettings, timeAwarenessEnabled: checked })}
                />
              </div>

              {tempPulseSettings.timeAwarenessEnabled && (
                <div style={{ marginLeft: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: '#8B6F47' }}>Interval:</span>
                  <Input
                    type="number"
                    value={tempPulseSettings.timeAwarenessInterval}
                    onChange={(e) => setTempPulseSettings({ ...tempPulseSettings, timeAwarenessInterval: parseInt(e.target.value) || 30 })}
                    min="5"
                    max="120"
                    style={{ width: '5rem', textAlign: 'center' }}
                  />
                  <span style={{ fontSize: '0.875rem', color: '#8B6F47' }}>minutes</span>
                </div>
              )}

              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.75rem', background: '#FFF9E6', borderRadius: '0.5rem', border: '1px solid rgba(139,111,71,0.1)',
              }}>
                <div>
                  <p style={{ fontWeight: 500, color: '#5C4033' }}>Celebration Pulse</p>
                  <p style={{ fontSize: '0.875rem', color: '#8B6F47' }}>Celebrate focus milestones (5, 15, 30+ min)</p>
                </div>
                <Switch
                  checked={tempPulseSettings.celebrationEnabled}
                  onCheckedChange={(checked) => setTempPulseSettings({ ...tempPulseSettings, celebrationEnabled: checked })}
                />
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.75rem', background: '#FFF9E6', borderRadius: '0.5rem', border: '1px solid rgba(139,111,71,0.1)',
              }}>
                <div>
                  <p style={{ fontWeight: 500, color: '#5C4033' }}>Incognito Mode Pulse</p>
                  <p style={{ fontSize: '0.875rem', color: '#8B6F47' }}>Subtle presence indicator in pill view</p>
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
          borderTop: '1px solid rgba(139,111,71,0.16)',
          flexWrap: 'wrap',
          rowGap: '0.5rem',
        }}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleRestoreDefaults} variant="outline" style={{ borderColor: 'rgba(139,111,71,0.3)', color: '#8B6F47', marginRight: 'auto' }}>
                <RotateCcw style={{ width: 16, height: 16, marginRight: '0.5rem' }} />
                Restore Defaults
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Reset all settings to default values</p></TooltipContent>
          </Tooltip>
          <Button onClick={onClose} variant="outline" style={{ borderColor: 'rgba(139,111,71,0.3)', color: '#8B6F47' }}>
            Cancel
          </Button>
          <Button onClick={handleSave} style={{ background: '#F59E0B', color: 'white' }}>
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
