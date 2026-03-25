import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Switch } from './ui/Switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/Tabs';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';
import { Settings, Keyboard, RotateCcw, AlertTriangle, X, PanelTop, Pin, Sun, Moon, History, ClipboardList, BellOff, ToggleLeft, ToggleRight } from 'lucide-react';
import { track } from '../utils/analytics';

const DEFAULT_SHORTCUTS = {
  startPause: 'CommandOrControl+Shift+S',
  newTask: 'CommandOrControl+N',
  toggleCompact: 'CommandOrControl+Shift+I',
  completeTask: 'CommandOrControl+Enter',
  openParkingLot: 'CommandOrControl+Shift+P',
};

const IS_MAC = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || '');

const mergeShortcutsWithDefaults = (rawShortcuts) => {
  const merged = { ...DEFAULT_SHORTCUTS };
  if (!rawShortcuts || typeof rawShortcuts !== 'object') return merged;
  for (const key of Object.keys(DEFAULT_SHORTCUTS)) {
    const value = rawShortcuts[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      merged[key] = value;
    }
  }
  return merged;
};

const MODIFIER_ORDER = ['Cmd', 'Ctrl', 'Shift', 'Alt'];

const normalizeShortcutForComparison = (shortcut) => {
  if (typeof shortcut !== 'string') return '';
  const raw = shortcut.trim();
  if (!raw) return '';

  const parts = raw.split('+').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return '';

  const modifiers = [];
  let key = '';

  const addModifier = (modifier) => {
    if (!modifiers.includes(modifier)) modifiers.push(modifier);
  };

  for (const part of parts) {
    const lower = part.toLowerCase();

    if (lower === 'commandorcontrol' || lower === 'cmdorctrl') {
      addModifier(IS_MAC ? 'Cmd' : 'Ctrl');
      continue;
    }
    if (lower === 'cmd' || lower === 'command' || part === '\u2318' || lower === 'meta') {
      addModifier('Cmd');
      continue;
    }
    if (lower === 'ctrl' || lower === 'control') {
      addModifier('Ctrl');
      continue;
    }
    if (lower === 'shift' || part === '\u21e7') {
      addModifier('Shift');
      continue;
    }
    if (lower === 'alt' || lower === 'option' || part === '\u2325') {
      addModifier('Alt');
      continue;
    }
    if (lower === 'space' || part === ' ') {
      key = 'Space';
      continue;
    }
    key = part.length === 1 ? part.toUpperCase() : part;
  }

  modifiers.sort((a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b));
  if (!key) return modifiers.join('+');
  return [...modifiers, key].join('+');
};

const SHORTCUT_DESCRIPTIONS = {
  startPause: 'Start/Pause Timer',
  newTask: 'New/Edit Task',
  toggleCompact: 'Toggle Compact Mode',
  completeTask: 'Complete Task + Celebrate',
  openParkingLot: 'Open Parking Lot (Quick Capture)',
};

const PINNED_CONTROLS_DEFAULT = {
  alwaysOnTop: true,
  dnd: true,
  theme: true,
  parkingLot: true,
  history: true,
  restart: false,
  floatingMinimize: true,
};
const ENABLED_CONTROLS_DEFAULT = {
  alwaysOnTop: true,
  dnd: true,
  theme: true,
  parkingLot: true,
  history: true,
  restart: true,
  floatingMinimize: true,
};

const MAIN_SCREEN_CONTROLS = [
  { key: 'alwaysOnTop', label: 'Always on Top', icon: Pin },
  { key: 'dnd', label: 'Do Not Disturb', icon: BellOff },
  { key: 'theme', label: 'Light mode/Dark mode', icon: Sun },
  { key: 'parkingLot', label: 'View Parking Lot', icon: ClipboardList },
  { key: 'history', label: 'View Session History', icon: History },
  { key: 'restart', label: 'Restart', icon: RotateCcw },
  { key: 'floatingMinimize', label: 'Minimize to Floating', icon: X },
];

function normalizeToolbarControlMap(rawControls, defaults) {
  const source = rawControls && typeof rawControls === 'object' ? rawControls : {};
  const normalized = { ...defaults, ...source };
  if (typeof source.floatingMinimize !== 'boolean' && typeof source.close === 'boolean') {
    normalized.floatingMinimize = source.close;
  }
  delete normalized.close;
  return normalized;
}

function formatUpdateTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getUpdateStatusSummary(updateState) {
  if (!updateState) {
    return 'Loading update status...';
  }

  switch (updateState.status) {
    case 'unsupported':
      return 'Auto-updates are available in packaged builds published to GitHub Releases.';
    case 'checking':
      return 'Checking GitHub Releases for updates...';
    case 'downloading':
      return updateState.availableVersion
        ? `Downloading Focana ${updateState.availableVersion}${Number.isFinite(updateState.downloadPercent) ? ` (${updateState.downloadPercent}%)` : ''}.`
        : 'Downloading update...';
    case 'downloaded':
      return updateState.availableVersion
        ? `Focana ${updateState.availableVersion} is ready to install.`
        : 'Update is ready to install.';
    case 'installing':
      return 'Restarting Focana to install the update...';
    case 'error':
      return updateState.error || 'Could not check for updates.';
    default:
      return updateState.lastCheckSucceeded
        ? 'You are up to date.'
        : 'Automatic update checks run on app launch.';
  }
}

function normalizePreferredName(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 80) : '';
}

function formatLicenseTimestamp(value) {
  if (!value) return 'Not yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not yet';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getLicenseStatusLabel(status) {
  switch (status) {
    case 'active':
      return 'Active';
    case 'offline_grace':
      return 'Offline Grace';
    case 'invalid':
      return 'Invalid';
    case 'config_error':
      return 'Config Error';
    case 'not_required':
      return 'Not Required';
    case 'error':
      return 'Needs Attention';
    default:
      return 'Not Activated';
  }
}

export default function SettingsModal({
  isOpen,
  onClose,
  theme = 'light',
  onToggleTheme,
  onOpenParkingLot,
  onOpenSessionHistory,
  alwaysOnTopDefault,
  onAlwaysOnTopChange,
  onRestartApp,
  onCloseApp,
  shortcuts,
  onShortcutsChange,
  shortcutsEnabledDefault,
  onShortcutsEnabledChange,
  pinnedControlsDefault,
  onPinnedControlsChange,
  enabledControlsDefault,
  onEnabledControlsChange,
  preferredName,
  onPreferredNameChange,
  dndEnabled,
  onDndChange,
  checkInSettings,
  onCheckInSettingsChange,
  updateState,
  onCheckForUpdates,
  onInstallUpdate,
  runtimeInfo,
  licenseStatus,
  onValidateLicense,
  onDeactivateLicense,
}) {
  const [tempShortcuts, setTempShortcuts] = useState(mergeShortcutsWithDefaults(shortcuts));
  const [shortcutsEnabled, setShortcutsEnabled] = useState(true);
  const [alwaysOnTop, setAlwaysOnTop] = useState(alwaysOnTopDefault ?? true);
  const [bringToFront, setBringToFront] = useState(true);
  const [keepTextAfterCompletion, setKeepTextAfterCompletion] = useState(false);
  const [tempPreferredName, setTempPreferredName] = useState(normalizePreferredName(preferredName));
  const [preferredNameError, setPreferredNameError] = useState('');
  const [pinnedControls, setPinnedControls] = useState(normalizeToolbarControlMap(pinnedControlsDefault, PINNED_CONTROLS_DEFAULT));
  const [enabledControls, setEnabledControls] = useState(normalizeToolbarControlMap(enabledControlsDefault, ENABLED_CONTROLS_DEFAULT));
  const [doNotDisturb, setDoNotDisturb] = useState(dndEnabled ?? false);
  const [checkInEnabled, setCheckInEnabled] = useState(checkInSettings?.enabled ?? true);
  const [checkInIntervalFreeflow, setCheckInIntervalFreeflow] = useState(checkInSettings?.intervalFreeflow ?? 15);
  const [recordingKey, setRecordingKey] = useState(null);
  const [conflicts, setConflicts] = useState({});
  const [licenseAction, setLicenseAction] = useState('');
  const recordingCleanupRef = useRef(null);

  useEffect(() => {
    return () => {
      if (recordingCleanupRef.current) {
        recordingCleanupRef.current();
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen) return;
    if (recordingCleanupRef.current) {
      recordingCleanupRef.current();
    }
    setRecordingKey(null);
    setLicenseAction('');
    setPreferredNameError('');
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTempShortcuts(mergeShortcutsWithDefaults(shortcuts));

      // Load settings from electron-store
      (async () => {
        const settings = await window.electronAPI.storeGet('settings') || {};
        setTempShortcuts(mergeShortcutsWithDefaults(settings.shortcuts || shortcuts));
        setShortcutsEnabled(settings.shortcutsEnabled ?? shortcutsEnabledDefault ?? true);
        setAlwaysOnTop(settings.alwaysOnTop ?? alwaysOnTopDefault ?? true);
        setBringToFront(settings.bringToFront ?? true);
        setKeepTextAfterCompletion(settings.keepTextAfterCompletion ?? false);
        setTempPreferredName(normalizePreferredName(await window.electronAPI.storeGet('preferredName')) || normalizePreferredName(preferredName));
        setPinnedControls(normalizeToolbarControlMap({ ...(pinnedControlsDefault || {}), ...(settings.pinnedControls || {}) }, PINNED_CONTROLS_DEFAULT));
        setEnabledControls(normalizeToolbarControlMap({ ...(enabledControlsDefault || {}), ...(settings.mainScreenControlsEnabled || {}) }, ENABLED_CONTROLS_DEFAULT));
        setDoNotDisturb(settings.doNotDisturbEnabled ?? dndEnabled ?? false);
        setCheckInEnabled(settings.checkInEnabled ?? checkInSettings?.enabled ?? true);
        setCheckInIntervalFreeflow(
          Number.isFinite(settings.checkInIntervalFreeflow) ? settings.checkInIntervalFreeflow : (checkInSettings?.intervalFreeflow ?? 15)
        );
      })();
    }
  }, [alwaysOnTopDefault, checkInSettings, dndEnabled, enabledControlsDefault, isOpen, pinnedControlsDefault, preferredName, shortcuts, shortcutsEnabledDefault]);

  const handleSave = async () => {
    const normalizedPreferredName = normalizePreferredName(tempPreferredName);
    if (!normalizedPreferredName) {
      setPreferredNameError('Enter the name you want Focana to use.');
      return;
    }

    const normalizedShortcuts = mergeShortcutsWithDefaults(tempShortcuts);
    onShortcutsChange(normalizedShortcuts);

    const oldSettings = await window.electronAPI.storeGet('settings') || {};
    await window.electronAPI.savePreferredName?.(normalizedPreferredName);
    onPreferredNameChange?.(normalizedPreferredName);

    await Promise.all([
      window.electronAPI.storeSet('settings.shortcutsEnabled', shortcutsEnabled),
      window.electronAPI.setAlwaysOnTop(alwaysOnTop),
      window.electronAPI.storeSet('settings.bringToFront', bringToFront),
      window.electronAPI.storeSet('settings.keepTextAfterCompletion', keepTextAfterCompletion),
      window.electronAPI.storeSet('settings.pinnedControls', pinnedControls),
      window.electronAPI.storeSet('settings.mainScreenControlsEnabled', enabledControls),
      window.electronAPI.storeSet('settings.checkInEnabled', checkInEnabled),
      window.electronAPI.storeSet('settings.checkInIntervalFreeflow', checkInIntervalFreeflow),
      window.electronAPI.storeSet('settings.shortcuts', normalizedShortcuts),
    ]);

    // Track changed settings
    const diffs = {};
    const trackable = {
      shortcutsEnabled, alwaysOnTop, bringToFront, keepTextAfterCompletion,
      pinnedControls, enabledControls, doNotDisturb,
      checkInEnabled, checkInIntervalFreeflow,
      preferredName: normalizedPreferredName,
    };
    const oldMap = {
      shortcutsEnabled: oldSettings.shortcutsEnabled,
      alwaysOnTop: oldSettings.alwaysOnTop,
      bringToFront: oldSettings.bringToFront,
      keepTextAfterCompletion: oldSettings.keepTextAfterCompletion,
      pinnedControls: oldSettings.pinnedControls,
      enabledControls: oldSettings.mainScreenControlsEnabled,
      doNotDisturb: oldSettings.doNotDisturbEnabled,
      checkInEnabled: oldSettings.checkInEnabled,
      checkInIntervalFreeflow: oldSettings.checkInIntervalFreeflow,
      preferredName: normalizePreferredName(preferredName),
    };
    for (const [k, v] of Object.entries(trackable)) {
      if (v !== oldMap[k]) diffs[k] = v;
    }
    if (Object.keys(diffs).length > 0) {
      track('settings_changed', diffs);
    }
    onShortcutsEnabledChange?.(shortcutsEnabled);
    onAlwaysOnTopChange?.(alwaysOnTop);
    onPinnedControlsChange?.(pinnedControls);
    onEnabledControlsChange?.(enabledControls);
    onDndChange?.(doNotDisturb);
    onCheckInSettingsChange?.({ enabled: checkInEnabled, intervalFreeflow: checkInIntervalFreeflow });

    onClose();
  };

  const handleRestoreDefaults = () => {
    setTempShortcuts(DEFAULT_SHORTCUTS);
    setShortcutsEnabled(true);
    setAlwaysOnTop(true);
    setBringToFront(true);
    setKeepTextAfterCompletion(false);
    setTempPreferredName(normalizePreferredName(preferredName));
    setPreferredNameError('');
    setPinnedControls(PINNED_CONTROLS_DEFAULT);
    setEnabledControls(ENABLED_CONTROLS_DEFAULT);
    setDoNotDisturb(false);
    setCheckInEnabled(true);
    setCheckInIntervalFreeflow(15);
    setConflicts({});
  };

  const handleValidateLicense = async () => {
    if (!onValidateLicense || licenseAction) return;
    setLicenseAction('validate');
    try {
      await onValidateLicense();
    } finally {
      setLicenseAction('');
    }
  };

  const handleDeactivateLicense = async () => {
    if (!onDeactivateLicense || licenseAction) return;
    setLicenseAction('deactivate');
    try {
      await onDeactivateLicense();
    } finally {
      setLicenseAction('');
    }
  };

  const handleShortcutRecord = (key) => {
    if (recordingCleanupRef.current) {
      recordingCleanupRef.current();
    }

    setRecordingKey(key);

    const handleKeyPress = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setRecordingKey(null);
        cleanup();
        return;
      }

      if (['Meta', 'Control', 'Shift', 'Alt'].includes(e.key)) {
        return;
      }

      const hasRequiredModifier = e.metaKey || e.ctrlKey || e.altKey;
      if (!hasRequiredModifier) {
        setConflicts((conflictPrev) => ({
          ...conflictPrev,
          [key]: 'Use Cmd/Ctrl or Alt with another key',
        }));
        return;
      }

      const keyName = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (keyName === 'Unidentified' || keyName === 'Dead' || keyName === 'Process') {
        setConflicts((conflictPrev) => ({
          ...conflictPrev,
          [key]: 'Unsupported key. Try another shortcut.',
        }));
        return;
      }

      const modifiers = [];
      if (e.metaKey || e.ctrlKey) modifiers.push(e.metaKey ? 'Cmd' : 'Ctrl');
      if (e.shiftKey) modifiers.push('Shift');
      if (e.altKey) modifiers.push('Alt');

      const shortcut = modifiers.length > 0 ? `${modifiers.join('+')}+${keyName}` : keyName;
      const normalizedShortcut = normalizeShortcutForComparison(shortcut);
      const existingKey = Object.entries(tempShortcuts).find(([k, v]) => (
        k !== key && normalizeShortcutForComparison(v) === normalizedShortcut
      ));
      if (existingKey) {
        setConflicts((conflictPrev) => ({
          ...conflictPrev,
          [key]: `Conflicts with ${SHORTCUT_DESCRIPTIONS[existingKey[0]]}`,
        }));
        return;
      }

      setTempShortcuts((prev) => ({
        ...prev,
        [key]: shortcut,
      }));
      setConflicts((conflictPrev) => ({
        ...conflictPrev,
        [key]: null,
      }));

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

  const updateStatusSummary = getUpdateStatusSummary(updateState);
  const currentVersionLabel = updateState?.currentVersion || 'Unknown';
  const updateChannelLabel = updateState?.channel && updateState.channel !== 'latest'
    ? `${updateState.channel} release`
    : 'latest release';
  const lastCheckedLabel = formatUpdateTimestamp(updateState?.lastCheckedAt);
  const updateActionDisabled = !updateState?.supported || ['checking', 'downloading', 'downloaded', 'installing'].includes(updateState?.status);
  const licenseEnabled = runtimeInfo?.licenseEnforced === true;
  const licenseStatusLabel = getLicenseStatusLabel(licenseStatus?.status);
  const licenseTone = licenseStatus?.status === 'active'
    ? '#166534'
    : licenseStatus?.status === 'offline_grace'
      ? '#92400E'
      : licenseStatus?.status === 'config_error' || licenseStatus?.status === 'invalid' || licenseStatus?.status === 'error'
        ? '#B91C1C'
        : 'var(--text-secondary)';

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
          <TabsList style={{ gridTemplateColumns: '1fr 1fr' }}>
            <TabsTrigger value="main">
              <PanelTop style={{ width: 16, height: 16 }} />
              Main
            </TabsTrigger>
            <TabsTrigger value="shortcuts">
              <Keyboard style={{ width: 16, height: 16 }} />
              Shortcuts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="main" className="space-y-4" style={{ marginTop: '1.25rem' }}>
            <div className="space-y-4">
              <div style={{
                padding: '0.75rem',
                background: 'var(--bg-card)',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-subtle)',
              }} className="space-y-3">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div>
                    <h4 style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Updates</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.8, marginTop: '0.125rem' }}>
                      Current version {currentVersionLabel} on the {updateChannelLabel}.
                    </p>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onCheckForUpdates?.()}
                      disabled={updateActionDisabled}
                      style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
                    >
                      Check for Updates
                    </Button>
                    {updateState?.status === 'downloaded' ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onInstallUpdate?.()}
                        style={{ background: 'var(--brand-primary)', color: 'var(--text-on-brand)' }}
                      >
                        Restart to Update
                      </Button>
                    ) : null}
                  </div>
                </div>
                <p style={{ fontSize: '0.875rem', color: updateState?.status === 'error' ? '#DC2626' : 'var(--text-secondary)' }}>
                  {updateStatusSummary}
                </p>
                {lastCheckedLabel ? (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.75 }}>
                    Last checked {lastCheckedLabel}.
                  </p>
                ) : null}
              </div>

              {licenseEnabled ? (
                <div style={{
                  padding: '0.75rem',
                  background: 'var(--bg-card)',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-subtle)',
                }} className="space-y-3">
                  <div>
                    <h4 style={{ fontWeight: 500, color: 'var(--text-primary)' }}>License</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.8, marginTop: '0.125rem' }}>
                      Focana uses Lemon license keys. Your key lives in the Lemon receipt email and Lemon My Orders.
                    </p>
                  </div>
                  <div style={{
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface)',
                    padding: '0.75rem',
                    display: 'grid',
                    gap: '0.4rem',
                  }}>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                      <strong>Status:</strong> <span style={{ color: licenseTone }}>{licenseStatusLabel}</span>
                    </p>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <strong>Key:</strong> {licenseStatus?.maskedKey || 'Not activated'}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <strong>Last successful check:</strong> {formatLicenseTimestamp(licenseStatus?.lastValidatedAt)}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <strong>Offline grace until:</strong> {formatLicenseTimestamp(licenseStatus?.offlineGraceUntil)}
                    </p>
                    {licenseStatus?.lastError ? (
                      <p style={{ margin: 0, fontSize: '0.8125rem', color: '#B91C1C', lineHeight: 1.45 }}>
                        {licenseStatus.lastError}
                      </p>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleValidateLicense}
                      disabled={licenseAction !== ''}
                      style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
                    >
                      {licenseAction === 'validate' ? 'Checking...' : 'Validate Now'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleDeactivateLicense}
                      disabled={licenseAction !== '' || !licenseStatus?.keyPresent}
                      style={{ borderColor: '#FCA5A5', color: '#B91C1C' }}
                    >
                      {licenseAction === 'deactivate' ? 'Deactivating...' : 'Deactivate this Mac'}
                    </Button>
                  </div>
                </div>
              ) : null}

              <div style={{
                padding: '0.75rem',
                background: 'var(--bg-card)',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-subtle)',
              }} className="space-y-3">
                <div>
                  <h4 style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Profile</h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.8, marginTop: '0.125rem' }}>
                    This name is used in encouragement inside Focana and synced for personalized emails.
                  </p>
                </div>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <label htmlFor="settings-preferred-name" style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    What should Focana call you?
                  </label>
                  <input
                    id="settings-preferred-name"
                    type="text"
                    value={tempPreferredName}
                    onChange={(event) => {
                      setTempPreferredName(event.target.value);
                      if (preferredNameError) setPreferredNameError('');
                    }}
                    placeholder="Your name"
                    className="input"
                    style={{ width: '100%' }}
                  />
                  {preferredNameError ? (
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#B91C1C' }}>
                      {preferredNameError}
                    </p>
                  ) : null}
                </div>
              </div>

              <div style={{
                padding: '0.75rem',
                background: 'var(--bg-card)',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-subtle)',
              }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>Main Screen Controls</h3>
                <div className="space-y-2" style={{ marginTop: '0.75rem' }}>
                  {MAIN_SCREEN_CONTROLS.map(({ key, label, icon: Icon }) => {
                    const pinned = !!pinnedControls[key];
                    const enabled = !!enabledControls[key];
                    return (
                      <div
                        key={key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                          padding: '0.5rem 0.625rem',
                          borderRadius: '0.375rem',
                          border: '1px solid var(--border-subtle)',
                          opacity: enabled ? 1 : 0.55,
                        }}
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                          <Icon style={{ width: 18, height: 18, color: 'var(--brand-action)', flexShrink: 0 }} />
                          <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                        </div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => setEnabledControls((prev) => ({ ...prev, [key]: !prev[key] }))}
                                title={enabled ? `Turn off ${label}` : `Turn on ${label}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '2.5rem',
                                  height: '2rem',
                                  borderRadius: '0.5rem',
                                  border: `1px solid ${enabled ? 'var(--brand-primary)' : 'var(--border-strong)'}`,
                                  background: enabled ? 'color-mix(in srgb, var(--brand-primary) 12%, transparent)' : 'transparent',
                                  color: enabled ? 'var(--brand-primary)' : 'var(--text-secondary)',
                                  cursor: 'pointer',
                                }}
                              >
                                {enabled ? <ToggleRight style={{ width: 16, height: 16 }} /> : <ToggleLeft style={{ width: 16, height: 16 }} />}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent><p>Toggle: turn this control on or off.</p></TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => setPinnedControls((prev) => ({ ...prev, [key]: !prev[key] }))}
                                title={pinned ? `Unpin ${label}` : `Pin ${label}`}
                                disabled={!enabled}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '2.5rem',
                                  height: '2rem',
                                  borderRadius: '0.5rem',
                                  border: `1px solid ${pinned ? 'var(--brand-primary)' : 'var(--border-strong)'}`,
                                  background: pinned ? 'color-mix(in srgb, var(--brand-primary) 12%, transparent)' : 'transparent',
                                  color: pinned ? 'var(--brand-primary)' : 'var(--text-secondary)',
                                  cursor: enabled ? 'pointer' : 'not-allowed',
                                }}
                              >
                                <Pin style={{ width: 14, height: 14, fill: pinned ? 'currentColor' : 'none' }} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent><p>Pin: add this control as a home-screen shortcut.</p></TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    );
                  })}
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
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Keep Focana always on top</span>
                  <Switch checked={alwaysOnTop} onCheckedChange={setAlwaysOnTop} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Bring Focana to front on shortcut</span>
                  <Switch checked={bringToFront} onCheckedChange={setBringToFront} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Keep text after task completion</span>
                  <Switch checked={keepTextAfterCompletion} onCheckedChange={setKeepTextAfterCompletion} />
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
                      type="text"
                      inputMode="numeric"
                      value={checkInIntervalFreeflow}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        if (raw === '') { setCheckInIntervalFreeflow(''); return; }
                        const val = parseInt(raw, 10);
                        if (Number.isFinite(val)) setCheckInIntervalFreeflow(Math.min(60, val));
                      }}
                      onBlur={() => {
                        const val = parseInt(checkInIntervalFreeflow, 10);
                        setCheckInIntervalFreeflow(Number.isFinite(val) ? Math.min(60, Math.max(5, val)) : 15);
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
              </div>

              <div style={{
                padding: '0.75rem',
                background: 'var(--bg-card)',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-subtle)',
              }} className="space-y-3">
                <div>
                  <h4 style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Application</h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.8, marginTop: '0.125rem' }}>
                    Restart or quit Focana without leaving Settings.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onRestartApp?.()}
                    style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
                  >
                    <RotateCcw style={{ width: 14, height: 14, marginRight: '0.4rem' }} />
                    Restart App
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onCloseApp?.()}
                    style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
                  >
                    <X style={{ width: 14, height: 14, marginRight: '0.4rem' }} />
                    Quit Focana
                  </Button>
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
                color: 'var(--info-text)',
                padding: '0.75rem',
                background: 'var(--info-bg)',
                borderRadius: '0.5rem',
                border: '1px solid var(--info-border)',
              }}>
                <p style={{ fontWeight: 500, marginBottom: '0.25rem' }}>macOS Note:</p>
                <p>If Cmd+Space conflicts with Spotlight, consider using Cmd+Shift+S for Start/Pause Timer.</p>
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
