import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './components/ui/Button';
import { Tooltip, TooltipTrigger, TooltipContent } from './components/ui/Tooltip';
import {
  X, Play, Pause, Square, RotateCcw, Minimize2,
  Settings, ClipboardList, History, Sun, Moon, ThumbsUp, ThumbsDown, Check, Undo2, BellOff,
} from 'lucide-react';
import { SessionStore } from './adapters/store';
import { formatTime } from './utils/time';
import appLockupDark from '../assets/logo-lockup.svg';
import appLockupLight from '../assets/logo-lockup-light.svg';

import ParkingLot from './components/ParkingLot';
import SessionNotesModal from './components/SessionNotesModal';
import TaskCompletionModal from './components/TaskCompletionModal.jsx';
import TimeUpModal from './components/TimeUpModal';
import TaskPreviewModal from './components/TaskPreviewModal';
import ContextBox from './components/ContextBox';
import IncognitoMode from './components/IncognitoMode';
import TaskInput from './components/TaskInput';
import HistoryModal from './components/HistoryModal';
import SettingsModal from './components/SettingsModal';
import Toast from './components/Toast';
import QuickCaptureModal from './components/QuickCaptureModal';
import ConfettiBurst from './components/ConfettiBurst';

const DEFAULT_SHORTCUTS = {
  startPause: 'CommandOrControl+Shift+S',
  newTask: 'CommandOrControl+N',
  toggleIncognito: 'CommandOrControl+Shift+I',
  completeTask: 'CommandOrControl+Enter',
  openParkingLot: 'CommandOrControl+Shift+P',
};

const THEME_STORAGE_KEY = 'focana-theme';
const WINDOW_SIZES = {
  baseWidth: 500,
  idleHeight: 140,
  startChooserHeight: 188,
  timerHeight: 220,
  timerCheckInPromptHeight: 268,
  timerCheckInDetourChoiceHeight: 284,
  timerCheckInDetourResolvedHeight: 300,
  timerCheckInResolvedHeight: 248,
  contextHeight: 360,
  timeUpHeight: 560,
  modal: {
    settings: [420, 580],
    history: [420, 500],
    taskPreview: [520, 620],
    parkingLot: [420, 500],
    timeUp: [460, 420],
    notes: [420, 500],
    completion: [420, 300],
    quickCapture: [420, 340],
  },
};
const CHECKIN_MESSAGES = [
  'Nice, keep going',
  "You're locked in",
  'Still at it, love that',
  'Crushing it',
  'In the zone',
];
const CHECKIN_COMPLETED_MESSAGES = [
  'Done! What a win',
  'Checked off, nice work',
  "That's a wrap",
];
const CHECKIN_DETOUR_MESSAGES = [
  "No worries, let's get back to it",
  'Happens to everyone, you caught it',
  "Quick reset, you've got this",
  'Detours happen, refocusing now',
];

function getStoredTheme() {
  if (typeof window === 'undefined') return null;
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return null;
}

function getSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  // Core state
  const [task, setTask] = useState('');
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState('freeflow');
  const [initialTime, setInitialTime] = useState(0);
  const [isTimerVisible, setIsTimerVisible] = useState(false);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [sessionMinutes, setSessionMinutes] = useState('25');
  const [windowHeight, setWindowHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 500
  );

  // Parking Lot state
  const [distractionJarOpen, setDistractionJarOpen] = useState(false);
  const [thoughts, setThoughts] = useState([]);

  // History
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [sessions, setSessions] = useState([]);

  // Focus
  const [isNoteFocused, setIsNoteFocused] = useState(false);

  // Session notes
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showTimeUpModal, setShowTimeUpModal] = useState(false);
  const [isStopFlowAwaitingCompletion, setIsStopFlowAwaitingCompletion] = useState(false);
  const [pendingSessionNotes, setPendingSessionNotes] = useState('');
  const [contextNotes, setContextNotes] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState(null);

  // Task preview
  const [showTaskPreview, setShowTaskPreview] = useState(false);
  const [previewSession, setPreviewSession] = useState(null);
  const [previewReturnToHistory, setPreviewReturnToHistory] = useState(false);

  // Incognito
  const [isIncognito, setIsIncognito] = useState(false);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState(() => getStoredTheme() || getSystemTheme());
  const [isThemeManual, setIsThemeManual] = useState(() => Boolean(getStoredTheme()));
  const [shortcuts, setShortcuts] = useState(DEFAULT_SHORTCUTS);
  const [shortcutsEnabled, setShortcutsEnabled] = useState(true);
  const [shortcutsHydrated, setShortcutsHydrated] = useState(false);
  const [showTaskInCompactDefault, setShowTaskInCompactDefault] = useState(true);
  const [pinControlsToToolbar, setPinControlsToToolbar] = useState(false);
  const [toast, setToast] = useState(null);
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiBurstId, setConfettiBurstId] = useState(0);
  const [dndEnabled, setDndEnabled] = useState(false);
  const [checkInSettings, setCheckInSettings] = useState({
    enabled: true,
    intervalFreeflow: 15,
    timedPercents: [0.4, 0.8],
  });
  const [checkInState, setCheckInState] = useState('idle'); // idle | prompting | detour-choice | detour-resolved | resolved
  const [checkInResult, setCheckInResult] = useState(null); // focused | detour | completed | missed
  const [checkInMessage, setCheckInMessage] = useState('');
  const [checkInCelebrating, setCheckInCelebrating] = useState(false);
  const [checkInCelebrationType, setCheckInCelebrationType] = useState('none'); // none | focused | completed

  // Pulse
  const [pulseSettings, setPulseSettings] = useState({
    timeAwarenessEnabled: true,
    timeAwarenessInterval: 30,
    celebrationEnabled: true,
    incognitoEnabled: true,
  });
  const [isPulsing, setIsPulsing] = useState(false);
  const [lastTimeAwarenessCheck, setLastTimeAwarenessCheck] = useState(Date.now());
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [celebratedMilestones, setCelebratedMilestones] = useState(new Set());

  const timerRef = useRef(null);
  const sessionToSave = useRef(null);
  const timeAwarenessRef = useRef(null);
  const celebrationCheckRef = useRef(null);
  const taskInputRef = useRef(null);
  const mainCardRef = useRef(null);
  const thoughtsLoadedRef = useRef(false);
  const confettiTimerRef = useRef(null);
  const pulseIntervalRef = useRef(null);
  const pulseTimeoutRef = useRef(null);
  const celebratedMilestonesRef = useRef(new Set());
  const timeRef = useRef(0);
  const pendingPostModalResizeRef = useRef(null);
  const postModalResizeTimerRef = useRef(null);
  const parkingLotReturnToIncognitoRef = useRef(false);
  const wasParkingLotOpenRef = useRef(false);
  const postSessionNotesActionRef = useRef(null); // 'resume-later' | 'move-on' | null
  const checkInReturnToIncognitoRef = useRef(false);
  const checkInPromptTimeoutRef = useRef(null);
  const checkInResolveTimeoutRef = useRef(null);
  const checkInFreeflowNextRef = useRef(null);
  const checkInTimedThresholdsRef = useRef([]);
  const checkInTimedIndexRef = useRef(0);
  const checkInForcedNextRef = useRef(null);
  const checkInShortIntervalRef = useRef(false);
  const checkInStateRef = useRef('idle');

  useEffect(() => {
    const onResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    // Normalize full-view size on launch so hidden oversized window bounds
    // from prior modal flows don't make drag feel "sticky" near bottom edge.
    window.electronAPI.ensureMainWindowSize?.(WINDOW_SIZES.baseWidth, WINDOW_SIZES.idleHeight);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (isThemeManual) {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } else {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    }
  }, [theme, isThemeManual]);

  useEffect(() => {
    document.documentElement.setAttribute('data-window-mode', isIncognito ? 'pill' : 'full');
    return () => {
      document.documentElement.removeAttribute('data-window-mode');
    };
  }, [isIncognito]);

  useEffect(() => {
    if (isThemeManual || !window.matchMedia) return undefined;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (event) => {
      setTheme(event.matches ? 'dark' : 'light');
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleThemeChange);
      return () => mediaQuery.removeEventListener('change', handleThemeChange);
    }

    mediaQuery.addListener(handleThemeChange);
    return () => mediaQuery.removeListener(handleThemeChange);
  }, [isThemeManual]);

  // Keep refs in sync with state for use in intervals/effects
  celebratedMilestonesRef.current = celebratedMilestones;
  timeRef.current = time;

  useEffect(() => {
    return () => {
      if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
      if (pulseIntervalRef.current) clearInterval(pulseIntervalRef.current);
      if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
      if (postModalResizeTimerRef.current) clearTimeout(postModalResizeTimerRef.current);
      if (checkInPromptTimeoutRef.current) clearTimeout(checkInPromptTimeoutRef.current);
      if (checkInResolveTimeoutRef.current) clearTimeout(checkInResolveTimeoutRef.current);
    };
  }, []);

  // Helpers
  const showToast = useCallback((type, message, duration = 2000) => {
    setToast({ type, message, duration });
  }, []);

  const triggerConfetti = useCallback((duration = 1800) => {
    if (confettiTimerRef.current) {
      clearTimeout(confettiTimerRef.current);
    }
    setConfettiBurstId((prev) => prev + 1);
    setShowConfetti(true);
    confettiTimerRef.current = setTimeout(() => {
      setShowConfetti(false);
    }, duration);
  }, []);

  const handleLockedTaskInputInteraction = useCallback(() => {
    showToast('info', 'Task is locked while timer is running. Pause or stop to edit.');
  }, [showToast]);

  const loadSessions = useCallback(async () => {
    const data = await SessionStore.list();
    setSessions(data);
  }, []);

  const handleClear = useCallback(() => {
    setIsRunning(false);
    setTime(0);
    setTask('');
    setInitialTime(0);
    setContextNotes('');
    setCurrentSessionId(null);
    setIsTimerVisible(false);
    setIsIncognito(false);
    setShowNotesModal(false);
    setShowCompletionModal(false);
    setShowTimeUpModal(false);
    setIsStopFlowAwaitingCompletion(false);
    setPendingSessionNotes('');
    setSessionStartTime(null);
    setCelebratedMilestones(new Set());
    clearCheckInRuntime();
  }, []);

  const saveSessionWithNotes = useCallback(async (notes) => {
    if (!task.trim() || !sessionToSave.current) return;

    const { duration, completed } = sessionToSave.current;
    const activeSessionId = currentSessionId;

    try {
      if (duration > 0.1) {
        if (activeSessionId) {
          await SessionStore.update(activeSessionId, {
            task: task.trim(),
            durationMinutes: duration,
            mode,
            completed,
            notes: notes || '',
          });
        } else {
          await SessionStore.create({
            task: task.trim(),
            duration_minutes: duration,
            mode,
            completed,
            notes: notes || undefined,
          });
        }
      } else if (activeSessionId) {
        // Preserve existing "very short sessions are not kept" behavior.
        await SessionStore.delete(activeSessionId);
      }

      await loadSessions();
    } catch (error) {
      console.error('Error saving session:', error);
    }

    sessionToSave.current = null;
    setCurrentSessionId(null);
  }, [task, mode, loadSessions, currentSessionId]);

  // Pulse animation
  const triggerPulse = useCallback((type = 'gentle', repeats = 2) => {
    if (pulseIntervalRef.current) clearInterval(pulseIntervalRef.current);
    if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);

    setIsPulsing(type);
    let count = 0;
    pulseIntervalRef.current = setInterval(() => {
      count++;
      if (count >= repeats) {
        clearInterval(pulseIntervalRef.current);
        pulseIntervalRef.current = null;
        pulseTimeoutRef.current = setTimeout(() => {
          setIsPulsing(false);
          pulseTimeoutRef.current = null;
        }, 1000);
      }
    }, 1200);
  }, []);

  const handleExitIncognito = useCallback(() => {
    setIsIncognito(false);

    // Ensure full timer controls are shown again after exiting compact mode.
    if (isRunning || time > 0 || task.trim()) {
      setIsTimerVisible(true);
    }

    let exitTargetHeight = isStartModalOpen ? WINDOW_SIZES.startChooserHeight : WINDOW_SIZES.idleHeight;
    if (contextNotes.trim()) {
      exitTargetHeight = WINDOW_SIZES.contextHeight;
    } else if (isRunning || isTimerVisible) {
      if (checkInState === 'prompting') exitTargetHeight = WINDOW_SIZES.timerCheckInPromptHeight;
      else if (checkInState === 'detour-choice') exitTargetHeight = WINDOW_SIZES.timerCheckInDetourChoiceHeight;
      else if (checkInState === 'detour-resolved') exitTargetHeight = WINDOW_SIZES.timerCheckInDetourResolvedHeight;
      else if (checkInState === 'resolved') exitTargetHeight = WINDOW_SIZES.timerCheckInResolvedHeight;
      else exitTargetHeight = WINDOW_SIZES.timerHeight;
    }

    // Normalize to the current full-view screen default height on compact exit.
    setTimeout(() => {
      window.electronAPI.ensureMainWindowSize?.(WINDOW_SIZES.baseWidth, exitTargetHeight);
    }, 80);
  }, [isRunning, time, task, contextNotes, isTimerVisible, checkInState, isStartModalOpen]);

  // Shortcut handlers
  const handleShortcutStartPause = useCallback(() => {
    if (task.trim()) {
      const newRunning = !isRunning;
      setIsRunning(newRunning);
      if (newRunning && !sessionStartTime) {
        setSessionStartTime(Date.now());
        setCelebratedMilestones(new Set());
        if (!currentSessionId) {
          (async () => {
            try {
              const created = await SessionStore.create({
                task: task.trim(),
                duration_minutes: 0,
                mode,
                completed: false,
                notes: contextNotes || '',
              });
              if (created?.id) {
                setCurrentSessionId(created.id);
                await loadSessions();
              }
            } catch (error) {
              console.error('Error creating session at shortcut start:', error);
            }
          })();
        }
        resetCheckInSchedule(mode, initialTime, getElapsedSeconds());
      }
      showToast('success', newRunning ? 'Session started' : 'Session paused');
    } else {
      if (isIncognito) handleExitIncognito();
      setTimeout(() => { taskInputRef.current?.focus(); }, 100);
      showToast('info', 'Enter a task to start timer');
    }
  }, [task, isRunning, sessionStartTime, isIncognito, handleExitIncognito, showToast, currentSessionId, mode, contextNotes, loadSessions, initialTime]);

  const handleShortcutNewTask = useCallback(() => {
    if (isIncognito) handleExitIncognito();
    setTimeout(() => {
      taskInputRef.current?.focus();
      taskInputRef.current?.select();
    }, 100);
  }, [isIncognito, handleExitIncognito]);

  const handleShortcutToggleIncognito = useCallback(() => {
    const newIncognito = !isIncognito;
    if (newIncognito) {
      setIsIncognito(true);
    } else {
      handleExitIncognito();
    }
    showToast('info', newIncognito ? 'Incognito Mode On' : 'Incognito Mode Off');
  }, [isIncognito, handleExitIncognito, showToast]);

  const handleShortcutCompleteTask = useCallback(async () => {
    if (task.trim()) {
      setIsRunning(false);
      setSessionStartTime(null);
      setCelebratedMilestones(new Set());
      sessionToSave.current = {
        duration: mode === 'freeflow' ? time / 60 : (initialTime - time) / 60,
        completed: true,
      };

      const settings = await window.electronAPI.storeGet('settings') || {};
      const keepText = settings.keepTextAfterCompletion ?? false;

      if (keepText) {
        setIsStopFlowAwaitingCompletion(false);
        setPendingSessionNotes('');
        if (isIncognito) {
          handleExitIncognito();
        }
        setShowNotesModal(true);
      } else {
        saveSessionWithNotes('');
        handleClear();
        showToast('success', 'Task completed!');
      }
    }
  }, [task, mode, time, initialTime, saveSessionWithNotes, handleClear, showToast, isIncognito, handleExitIncognito]);

  const handleShortcutAction = useCallback((action) => {
    (async () => {
      const settings = await window.electronAPI.storeGet('settings') || {};
      const bringToFront = settings.bringToFront ?? true;
      if (bringToFront) window.electronAPI.bringToFront();

      switch (action) {
        case 'startPause': handleShortcutStartPause(); break;
        case 'newTask': handleShortcutNewTask(); break;
        case 'toggleIncognito': handleShortcutToggleIncognito(); break;
        case 'completeTask': handleShortcutCompleteTask(); break;
        case 'openParkingLot': setShowQuickCapture(true); break;
      }
    })();
  }, [handleShortcutStartPause, handleShortcutNewTask, handleShortcutToggleIncognito, handleShortcutCompleteTask]);

  // Load data from electron-store on mount
  useEffect(() => {
    (async () => {
      try {
        await loadSessions();

        const savedThoughts = await window.electronAPI.storeGet('thoughts');
        if (savedThoughts) setThoughts(savedThoughts);
        thoughtsLoadedRef.current = true;

        const settings = await window.electronAPI.storeGet('settings') || {};
        if (settings.shortcuts) setShortcuts(settings.shortcuts);
        if (settings.pulseSettings) setPulseSettings(settings.pulseSettings);
        setCheckInSettings({
          enabled: settings.checkInEnabled ?? true,
          intervalFreeflow: Number.isFinite(settings.checkInIntervalFreeflow) ? settings.checkInIntervalFreeflow : 15,
          timedPercents: Array.isArray(settings.checkInIntervalTimed) && settings.checkInIntervalTimed.length
            ? settings.checkInIntervalTimed
            : [0.4, 0.8],
        });
        const hasExplicitCompactSetting = settings.showTaskInCompactCustomized === true;
        if (hasExplicitCompactSetting) {
          setShowTaskInCompactDefault(settings.showTaskInCompactDefault ?? true);
        } else {
          // Migration: older installs may still have legacy false persisted.
          // New default behavior is task visible in compact mode.
          settings.showTaskInCompactDefault = true;
          settings.showTaskInCompactCustomized = false;
          await window.electronAPI.storeSet('settings', settings);
          setShowTaskInCompactDefault(true);
        }
        setPinControlsToToolbar(settings.pinControlsToToolbar ?? false);
        setShortcutsEnabled(settings.shortcutsEnabled ?? true);
        setDndEnabled(settings.doNotDisturbEnabled ?? false);

        const currentTask = await window.electronAPI.storeGet('currentTask');
        if (currentTask) {
          setTask(currentTask.text || '');
          setContextNotes(currentTask.contextNote || '');
        }

        const timerState = await window.electronAPI.storeGet('timerState');
        if (timerState) {
          setTime(timerState.seconds || 0);
          setMode(timerState.mode || 'freeflow');
          setInitialTime(timerState.initialTime || 0);
          if (timerState.seconds > 0 || timerState.mode !== 'freeflow') {
            setIsTimerVisible(true);
          }
        }
      } finally {
        setShortcutsHydrated(true);
      }
    })();
  }, [loadSessions]);

  // DND — listen for tray toggle and sync state + persist
  useEffect(() => {
    const cleanup = window.electronAPI.onDndToggle?.((enabled) => {
      setDndEnabled(enabled);
      (async () => {
        const settings = await window.electronAPI.storeGet('settings') || {};
        settings.doNotDisturbEnabled = enabled;
        await window.electronAPI.storeSet('settings', settings);
      })();
    });
    return () => { if (cleanup) cleanup(); };
  }, []);

  // Shortcut event subscription
  useEffect(() => {
    const cleanup = window.electronAPI.onShortcut((action) => {
      handleShortcutAction(action);
    });
    return () => { if (cleanup) cleanup(); };
  }, [handleShortcutAction]);

  // Register/unregister global shortcuts based on settings
  useEffect(() => {
    if (!shortcutsHydrated) return undefined;

    if (shortcutsEnabled) {
      window.electronAPI.registerGlobalShortcuts(shortcuts);
    } else {
      window.electronAPI.unregisterGlobalShortcuts();
    }

    return () => {
      window.electronAPI.unregisterGlobalShortcuts();
    };
  }, [shortcuts, shortcutsEnabled, shortcutsHydrated]);

  // Save thoughts to electron-store (guarded: skip the initial mount render
  // before the async load resolves, which would otherwise wipe persisted data)
  useEffect(() => {
    if (!thoughtsLoadedRef.current) return;
    window.electronAPI.storeSet('thoughts', thoughts);
  }, [thoughts]);

  useEffect(() => {
    if (!isRunning) {
      window.electronAPI.storeSet('currentTask', {
        text: task,
        contextNote: contextNotes,
        startedAt: null,
      });
      window.electronAPI.storeSet('timerState', {
        mode,
        seconds: time,
        isRunning: false,
        initialTime,
      });
    }
  }, [task, time, mode, initialTime, contextNotes, isRunning]);

  const getElapsedSeconds = useCallback(() => {
    return mode === 'freeflow' ? time : Math.max(0, initialTime - time);
  }, [mode, time, initialTime]);

  const getStandardCheckInIntervalSeconds = useCallback((nextMode = mode, nextInitialTimeSec = initialTime) => {
    if (nextMode === 'freeflow') {
      const intervalMinutes = Math.max(1, Number(checkInSettings.intervalFreeflow) || 15);
      return intervalMinutes * 60;
    }

    const safeTotal = Math.max(1, Number(nextInitialTimeSec) || 0);
    const percents = (Array.isArray(checkInSettings.timedPercents) ? checkInSettings.timedPercents : [0.4, 0.8])
      .map((p) => Number(p))
      .filter((p) => Number.isFinite(p) && p > 0 && p < 1)
      .sort((a, b) => a - b);

    if (percents.length >= 2) {
      return Math.max(60, Math.round((percents[1] - percents[0]) * safeTotal));
    }

    return Math.max(60, Math.round((percents[0] || 0.4) * safeTotal));
  }, [mode, initialTime, checkInSettings.intervalFreeflow, checkInSettings.timedPercents]);

  const getShortCheckInIntervalSeconds = useCallback((nextMode = mode, nextInitialTimeSec = initialTime) => {
    const standardInterval = getStandardCheckInIntervalSeconds(nextMode, nextInitialTimeSec);
    return Math.max(60, Math.round(standardInterval * 0.4));
  }, [mode, initialTime, getStandardCheckInIntervalSeconds]);

  const clearCheckInUi = useCallback(() => {
    if (checkInPromptTimeoutRef.current) clearTimeout(checkInPromptTimeoutRef.current);
    if (checkInResolveTimeoutRef.current) clearTimeout(checkInResolveTimeoutRef.current);
    checkInPromptTimeoutRef.current = null;
    checkInResolveTimeoutRef.current = null;
    setCheckInState('idle');
    setCheckInResult(null);
    setCheckInMessage('');
    setCheckInCelebrating(false);
    setCheckInCelebrationType('none');
  }, []);

  const clearCheckInRuntime = useCallback(() => {
    checkInFreeflowNextRef.current = null;
    checkInTimedThresholdsRef.current = [];
    checkInTimedIndexRef.current = 0;
    checkInForcedNextRef.current = null;
    checkInShortIntervalRef.current = false;
    checkInReturnToIncognitoRef.current = false;
    clearCheckInUi();
  }, [clearCheckInUi]);

  const resetCheckInSchedule = useCallback((nextMode, nextInitialTimeSec = initialTime, elapsedSec = 0) => {
    checkInFreeflowNextRef.current = null;
    checkInTimedThresholdsRef.current = [];
    checkInTimedIndexRef.current = 0;
    checkInForcedNextRef.current = null;
    checkInShortIntervalRef.current = false;

    if (!checkInSettings.enabled) return;

    if (nextMode === 'freeflow') {
      const intervalSeconds = getStandardCheckInIntervalSeconds(nextMode, nextInitialTimeSec);
      checkInFreeflowNextRef.current = elapsedSec + intervalSeconds;
      return;
    }

    const safeTotal = Math.max(1, Number(nextInitialTimeSec) || 0);
    const percents = (Array.isArray(checkInSettings.timedPercents) ? checkInSettings.timedPercents : [0.4, 0.8])
      .map((p) => Number(p))
      .filter((p) => Number.isFinite(p) && p > 0 && p < 1)
      .sort((a, b) => a - b);
    checkInTimedThresholdsRef.current = percents.map((p) => Math.round(safeTotal * p));
    while (
      checkInTimedIndexRef.current < checkInTimedThresholdsRef.current.length &&
      elapsedSec >= checkInTimedThresholdsRef.current[checkInTimedIndexRef.current]
    ) {
      checkInTimedIndexRef.current += 1;
    }
  }, [checkInSettings.enabled, checkInSettings.timedPercents, initialTime, getStandardCheckInIntervalSeconds]);

  const advanceCheckInScheduleAfterResult = useCallback((elapsedSec) => {
    if (!checkInSettings.enabled) return;
    if (mode === 'freeflow') {
      const intervalSeconds = getStandardCheckInIntervalSeconds(mode, initialTime);
      checkInFreeflowNextRef.current = elapsedSec + intervalSeconds;
      return;
    }
    while (
      checkInTimedIndexRef.current < checkInTimedThresholdsRef.current.length &&
      elapsedSec >= checkInTimedThresholdsRef.current[checkInTimedIndexRef.current]
    ) {
      checkInTimedIndexRef.current += 1;
    }
  }, [checkInSettings.enabled, mode, initialTime, getStandardCheckInIntervalSeconds]);

  const logCheckIn = useCallback(async (status, elapsedSec) => {
    if (!currentSessionId || !task.trim()) return null;
    try {
      return await window.electronAPI.checkInAdd?.({
        sessionId: currentSessionId,
        taskText: task.trim(),
        elapsedMinutes: Number((elapsedSec / 60).toFixed(2)),
        status,
      });
    } catch (error) {
      console.error('Failed to save check-in:', error);
      return null;
    }
  }, [currentSessionId, task]);

  const completeSessionFromCheckIn = useCallback(async (elapsedSec) => {
    try {
      const durationMinutes = Number((elapsedSec / 60).toFixed(2));
      if (currentSessionId) {
        await SessionStore.update(currentSessionId, {
          task: task.trim(),
          durationMinutes,
          mode,
          completed: true,
          notes: contextNotes || '',
        });
      } else if (task.trim()) {
        await SessionStore.create({
          task: task.trim(),
          duration_minutes: durationMinutes,
          mode,
          completed: true,
          notes: contextNotes || '',
        });
      }
      await loadSessions();
    } catch (error) {
      console.error('Failed to finalize session after check-in completion:', error);
    }

    handleClear();
    setTimeout(() => taskInputRef.current?.focus(), 140);
  }, [currentSessionId, task, mode, contextNotes, loadSessions, handleClear]);

  const resolveCheckIn = useCallback(async (status) => {
    if (checkInStateRef.current !== 'prompting') return;
    const elapsedSec = getElapsedSeconds();
    await logCheckIn(status, elapsedSec);

    if (status === 'focused') {
      if (checkInShortIntervalRef.current) {
        checkInShortIntervalRef.current = false;
        checkInForcedNextRef.current = null;
        resetCheckInSchedule(mode, initialTime, elapsedSec);
      } else {
        advanceCheckInScheduleAfterResult(elapsedSec);
      }
      const randomMessage = CHECKIN_MESSAGES[Math.floor(Math.random() * CHECKIN_MESSAGES.length)];
      setCheckInMessage(randomMessage);
      setCheckInCelebrating(true);
      setCheckInCelebrationType('focused');
    } else {
      if (checkInShortIntervalRef.current) {
        const shortInterval = getShortCheckInIntervalSeconds(mode, initialTime);
        checkInForcedNextRef.current = elapsedSec + shortInterval;
      } else {
        advanceCheckInScheduleAfterResult(elapsedSec);
      }
      setCheckInMessage('Check-in missed');
      setCheckInCelebrating(false);
      setCheckInCelebrationType('none');
    }

    setCheckInResult(status);
    setCheckInState('resolved');
    if (checkInPromptTimeoutRef.current) clearTimeout(checkInPromptTimeoutRef.current);

    if (checkInResolveTimeoutRef.current) clearTimeout(checkInResolveTimeoutRef.current);
    checkInResolveTimeoutRef.current = setTimeout(() => {
      clearCheckInUi();
    }, status === 'focused' ? 1500 : 800);
  }, [
    advanceCheckInScheduleAfterResult,
    clearCheckInUi,
    getElapsedSeconds,
    getShortCheckInIntervalSeconds,
    logCheckIn,
    resetCheckInSchedule,
    mode,
    initialTime,
  ]);

  const openCheckInDetourChoice = useCallback(() => {
    if (checkInStateRef.current !== 'prompting') return;
    if (checkInPromptTimeoutRef.current) clearTimeout(checkInPromptTimeoutRef.current);
    const applyDetourChoiceState = () => {
      setCheckInState('detour-choice');
      setCheckInResult(null);
      setCheckInMessage('');
      setCheckInCelebrating(false);
      setCheckInCelebrationType('none');
    };

    if (isIncognito) {
      checkInReturnToIncognitoRef.current = true;
      handleExitIncognito();
      setTimeout(() => {
        applyDetourChoiceState();
      }, 120);
      return;
    }

    checkInReturnToIncognitoRef.current = false;
    applyDetourChoiceState();
  }, [isIncognito, handleExitIncognito]);

  const handleCheckInFinished = useCallback(async () => {
    if (checkInStateRef.current !== 'detour-choice') return;
    if (checkInPromptTimeoutRef.current) clearTimeout(checkInPromptTimeoutRef.current);
    if (checkInResolveTimeoutRef.current) clearTimeout(checkInResolveTimeoutRef.current);
    checkInReturnToIncognitoRef.current = false; // session ending — no return to compact

    const elapsedSec = getElapsedSeconds();
    await logCheckIn('completed', elapsedSec);

    setIsRunning(false);
    setCheckInResult('completed');
    setCheckInState('resolved');
    setCheckInMessage(CHECKIN_COMPLETED_MESSAGES[Math.floor(Math.random() * CHECKIN_COMPLETED_MESSAGES.length)]);
    setCheckInCelebrating(true);
    setCheckInCelebrationType('completed');
    triggerConfetti(2200);

    checkInResolveTimeoutRef.current = setTimeout(() => {
      completeSessionFromCheckIn(elapsedSec);
    }, 2000);
  }, [getElapsedSeconds, logCheckIn, triggerConfetti, completeSessionFromCheckIn]);

  const handleCheckInDetour = useCallback(async () => {
    if (checkInStateRef.current !== 'detour-choice') return;
    if (checkInPromptTimeoutRef.current) clearTimeout(checkInPromptTimeoutRef.current);
    if (checkInResolveTimeoutRef.current) clearTimeout(checkInResolveTimeoutRef.current);

    const elapsedSec = getElapsedSeconds();
    await logCheckIn('detour', elapsedSec);

    const shortInterval = getShortCheckInIntervalSeconds(mode, initialTime);
    checkInShortIntervalRef.current = true;
    checkInForcedNextRef.current = elapsedSec + shortInterval;

    setCheckInResult('detour');
    setCheckInState('detour-resolved');
    setCheckInMessage(CHECKIN_DETOUR_MESSAGES[Math.floor(Math.random() * CHECKIN_DETOUR_MESSAGES.length)]);
    setCheckInCelebrating(false);
    setCheckInCelebrationType('none');
  }, [getElapsedSeconds, getShortCheckInIntervalSeconds, initialTime, logCheckIn, mode]);

  const handleCheckInDetourDismiss = useCallback(() => {
    if (checkInResolveTimeoutRef.current) clearTimeout(checkInResolveTimeoutRef.current);
    const shouldReturnToIncognito = checkInReturnToIncognitoRef.current;
    checkInReturnToIncognitoRef.current = false;
    triggerPulse('celebration', 1);
    setCheckInCelebrating(true);
    setCheckInCelebrationType('focused');
    checkInResolveTimeoutRef.current = setTimeout(() => {
      clearCheckInUi();
      if (shouldReturnToIncognito) {
        setTimeout(() => setIsIncognito(true), 80);
      }
    }, 700);
  }, [clearCheckInUi, triggerPulse]);

  const triggerCheckInPrompt = useCallback(() => {
    if (!checkInSettings.enabled) return;
    if (dndEnabled) return;
    if (!isRunning || !isTimerVisible || !task.trim() || !currentSessionId) return;
    if (checkInStateRef.current !== 'idle') return;

    setCheckInState('prompting');
    setCheckInResult(null);
    setCheckInMessage('');
    setCheckInCelebrating(false);
    setCheckInCelebrationType('none');

    if (checkInPromptTimeoutRef.current) clearTimeout(checkInPromptTimeoutRef.current);
    checkInPromptTimeoutRef.current = setTimeout(() => {
      resolveCheckIn('missed');
    }, 10000);
  }, [checkInSettings.enabled, dndEnabled, isRunning, isTimerVisible, task, currentSessionId, resolveCheckIn]);

  useEffect(() => {
    checkInStateRef.current = checkInState;
  }, [checkInState]);

  useEffect(() => {
    if (!checkInSettings.enabled) {
      clearCheckInRuntime();
      return undefined;
    }
    return undefined;
  }, [checkInSettings.enabled, clearCheckInRuntime]);

  useEffect(() => {
    if (!isRunning || !isTimerVisible || !task.trim() || !currentSessionId || !checkInSettings.enabled) return;
    if (checkInState !== 'idle') return;

    const elapsed = getElapsedSeconds();
    if (Number.isFinite(checkInForcedNextRef.current)) {
      if (elapsed >= checkInForcedNextRef.current) {
        triggerCheckInPrompt();
      }
      return;
    }

    if (mode === 'freeflow') {
      if (!Number.isFinite(checkInFreeflowNextRef.current)) {
        resetCheckInSchedule('freeflow', initialTime, elapsed);
      }
      if (Number.isFinite(checkInFreeflowNextRef.current) && elapsed >= checkInFreeflowNextRef.current) {
        triggerCheckInPrompt();
      }
      return;
    }

    const thresholds = checkInTimedThresholdsRef.current;
    const idx = checkInTimedIndexRef.current;
    if (idx < thresholds.length && elapsed >= thresholds[idx]) {
      checkInTimedIndexRef.current = idx + 1;
      triggerCheckInPrompt();
    }
  }, [
    isRunning,
    isTimerVisible,
    task,
    currentSessionId,
    checkInSettings.enabled,
    checkInState,
    mode,
    time,
    initialTime,
    getElapsedSeconds,
    resetCheckInSchedule,
    triggerCheckInPrompt,
  ]);

  // Timer logic — counts up (freeflow) or down (timed)
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTime((prevTime) => {
          if (mode === 'timed' && prevTime <= 1) {
            return 0;
          }
          return mode === 'freeflow' ? prevTime + 1 : prevTime - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning, mode, initialTime]);

  // Handle timed session expiration — separated from setTime to avoid
  // calling state setters inside another state setter callback
  useEffect(() => {
    if (mode === 'timed' && time === 0 && isRunning) {
      setIsRunning(false);
      setIsStopFlowAwaitingCompletion(false);
      setPendingSessionNotes('');
      setIsIncognito(false);
      setShowNotesModal(false);
      setShowCompletionModal(false);
      setIsTimerVisible(true);
      clearCheckInRuntime();
      sessionToSave.current = {
        duration: initialTime / 60,
        completed: true,
      };
      setShowTimeUpModal(true);
    }
  }, [mode, time, isRunning, initialTime, clearCheckInRuntime]);

  useEffect(() => {
    if (!showTimeUpModal) return undefined;
    // Ensure enough full-window space so timeout actions are immediately visible.
    const resizeTimer = setTimeout(() => {
      window.electronAPI.ensureMainWindowSize?.(WINDOW_SIZES.baseWidth, WINDOW_SIZES.timeUpHeight);
    }, 80);
    return () => clearTimeout(resizeTimer);
  }, [showTimeUpModal]);

  // Actions
  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
    setIsThemeManual(true);
  };

  const handleCloseWindow = () => {
    window.electronAPI.closeWindow();
  };

  const handleOpenParkingLot = useCallback(() => {
    if (isIncognito) {
      parkingLotReturnToIncognitoRef.current = true;
      handleExitIncognito();
      setTimeout(() => setDistractionJarOpen(true), 140);
      return;
    }
    parkingLotReturnToIncognitoRef.current = false;
    setDistractionJarOpen(true);
  }, [isIncognito, handleExitIncognito]);

  const handleCloseParkingLot = useCallback(() => {
    setDistractionJarOpen(false);
  }, []);

  const handleCheckInParkIt = useCallback(() => {
    const shouldReturnToIncognito = checkInReturnToIncognitoRef.current;
    checkInReturnToIncognitoRef.current = false;
    clearCheckInUi();
    // We're already in full view (exited incognito for detour UI).
    // Pass the return-to-incognito intent to the parking lot flow.
    parkingLotReturnToIncognitoRef.current = shouldReturnToIncognito;
    setDistractionJarOpen(true);
  }, [clearCheckInUi]);

  useEffect(() => {
    const wasOpen = wasParkingLotOpenRef.current;
    if (wasOpen && !distractionJarOpen && parkingLotReturnToIncognitoRef.current) {
      parkingLotReturnToIncognitoRef.current = false;
      const t = setTimeout(() => {
        setIsIncognito(true);
      }, 80);
      wasParkingLotOpenRef.current = distractionJarOpen;
      return () => clearTimeout(t);
    }
    wasParkingLotOpenRef.current = distractionJarOpen;
    return undefined;
  }, [distractionJarOpen]);

  const resizeToMainCardContent = useCallback((minHeight) => {
    const card = mainCardRef.current;
    const measuredHeight = card
      ? Math.ceil(card.scrollHeight || card.getBoundingClientRect().height || 0)
      : 0;
    const targetHeight = Math.max(minHeight, measuredHeight);
    window.electronAPI.ensureMainWindowSize?.(WINDOW_SIZES.baseWidth, targetHeight);
  }, []);

  const getActiveScreenDefaultHeight = useCallback(() => {
    if (contextNotes.trim()) return WINDOW_SIZES.contextHeight;
    if (checkInState === 'prompting') return WINDOW_SIZES.timerCheckInPromptHeight;
    if (checkInState === 'detour-choice') return WINDOW_SIZES.timerCheckInDetourChoiceHeight;
    if (checkInState === 'detour-resolved') return WINDOW_SIZES.timerCheckInDetourResolvedHeight;
    if (checkInState === 'resolved') return WINDOW_SIZES.timerCheckInResolvedHeight;
    return WINDOW_SIZES.timerHeight;
  }, [contextNotes, checkInState]);

  const getIdleScreenDefaultHeight = useCallback(() => {
    return isStartModalOpen ? WINDOW_SIZES.startChooserHeight : WINDOW_SIZES.idleHeight;
  }, [isStartModalOpen]);

  const resyncFullWindowSize = useCallback(() => {
    if (isIncognito) return;
    const minHeight = (isRunning || isTimerVisible)
      ? getActiveScreenDefaultHeight()
      : getIdleScreenDefaultHeight();
    resizeToMainCardContent(minHeight);
  }, [isIncognito, isRunning, isTimerVisible, resizeToMainCardContent, getActiveScreenDefaultHeight, getIdleScreenDefaultHeight]);

  const handlePlay = () => {
    if (task.trim()) {
      setIsRunning(true);
      if (!sessionStartTime) {
        setSessionStartTime(Date.now());
        setCelebratedMilestones(new Set());
      }
    }
  };

  const handlePause = () => setIsRunning(false);

  const handleStop = () => {
    setIsRunning(false);
    setSessionStartTime(null);
    setCelebratedMilestones(new Set());
    clearCheckInRuntime();
    if (isIncognito) {
      handleExitIncognito();
    }
    setIsStopFlowAwaitingCompletion(true);
    setPendingSessionNotes('');
    sessionToSave.current = {
      duration: mode === 'freeflow' ? time / 60 : (initialTime - time) / 60,
      completed: false,
    };
    setShowNotesModal(true);
  };

  const handleTaskSubmit = () => {
    if (!task.trim()) return;

    const hasPausedSessionToResume =
      isTimerVisible &&
      !isRunning &&
      (time > 0 || mode !== 'freeflow' || initialTime > 0 || sessionStartTime !== null);

    if (hasPausedSessionToResume) {
      setIsStartModalOpen(false);
      handlePlay();
      return;
    }

    setIsStartModalOpen(true);
  };

  const handleStartSession = async (selectedMode, minutes) => {
    let createdSessionId = null;
    try {
      const created = await SessionStore.create({
        task: task.trim(),
        duration_minutes: 0,
        mode: selectedMode,
        completed: false,
        notes: contextNotes || '',
      });
      createdSessionId = created?.id || null;
      if (createdSessionId) {
        setCurrentSessionId(createdSessionId);
        await loadSessions();
      }
    } catch (error) {
      console.error('Error creating session at start:', error);
    }

    setMode(selectedMode);
    let initialSeconds = 0;
    if (selectedMode === 'freeflow') {
      setTime(0);
      setInitialTime(0);
    } else {
      const seconds = minutes * 60;
      initialSeconds = seconds;
      setTime(seconds);
      setInitialTime(seconds);
    }
    setIsTimerVisible(true);
    setIsRunning(true);
    setSessionStartTime(Date.now());
    setCelebratedMilestones(new Set());
    clearCheckInRuntime();
    resetCheckInSchedule(selectedMode, initialSeconds, 0);
    setIsStartModalOpen(false);
    setTimeout(() => setIsIncognito(true), 100);
  };

  const handleSaveSessionNotes = async (notes) => {
    const postAction = postSessionNotesActionRef.current;
    postSessionNotesActionRef.current = null;

    if (postAction === 'resume-later') {
      await saveSessionWithNotes(notes);
      setShowNotesModal(false);
      // Keep task text, reset timer to idle
      setIsRunning(false);
      setTime(0);
      setInitialTime(0);
      setIsTimerVisible(false);
      setSessionStartTime(null);
      setCelebratedMilestones(new Set());
      return;
    }

    if (isStopFlowAwaitingCompletion) {
      setPendingSessionNotes(notes);
      setShowNotesModal(false);
      setShowCompletionModal(true);
      return;
    }
    await saveSessionWithNotes(notes);
    setShowNotesModal(false);
    handleClear();
  };

  const handleSkipSessionNotes = async () => {
    const postAction = postSessionNotesActionRef.current;
    postSessionNotesActionRef.current = null;

    if (postAction === 'resume-later') {
      await saveSessionWithNotes('');
      setShowNotesModal(false);
      setIsRunning(false);
      setTime(0);
      setInitialTime(0);
      setIsTimerVisible(false);
      setSessionStartTime(null);
      setCelebratedMilestones(new Set());
      return;
    }

    if (isStopFlowAwaitingCompletion) {
      setPendingSessionNotes('');
      setShowNotesModal(false);
      setShowCompletionModal(true);
      return;
    }
    await saveSessionWithNotes('');
    setShowNotesModal(false);
    handleClear();
  };

  const handleStopFlowCompletionDismiss = () => {
    setShowCompletionModal(false);
    setIsStopFlowAwaitingCompletion(false);
    setPendingSessionNotes('');
    sessionToSave.current = null;
  };

  const handleStopFlowCompletionDecision = async (completed) => {
    if (!sessionToSave.current) {
      setShowCompletionModal(false);
      setIsStopFlowAwaitingCompletion(false);
      setPendingSessionNotes('');
      return;
    }

    sessionToSave.current = {
      ...sessionToSave.current,
      completed,
    };

    await saveSessionWithNotes(pendingSessionNotes);

    setShowCompletionModal(false);
    setIsStopFlowAwaitingCompletion(false);
    setPendingSessionNotes('');

    if (completed) {
      const settings = await window.electronAPI.storeGet('settings') || {};
      const keepText = settings.keepTextAfterCompletion ?? false;

      if (keepText) {
        setIsRunning(false);
        setTime(0);
        setInitialTime(0);
        setIsTimerVisible(false);
        setSessionStartTime(null);
        setCelebratedMilestones(new Set());
      } else {
        handleClear();
      }
      triggerConfetti();
      return;
    }

    // Not completed: keep task text, but reset timer/session state.
    setIsRunning(false);
    setTime(0);
    setInitialTime(0);
    setIsTimerVisible(false);
    setSessionStartTime(null);
    setCelebratedMilestones(new Set());
    showToast('info', 'Session saved. Task kept active');
  };

  const handleTimeUpEndSession = () => {
    setShowTimeUpModal(false);
    setSessionStartTime(null);
    setCelebratedMilestones(new Set());
    clearCheckInRuntime();
    setShowNotesModal(true);
  };

  const handleTimeUpKeepGoing = (extraMinutes) => {
    const safeMinutes = Math.min(Math.max(extraMinutes || 5, 1), 240);
    const extraSeconds = safeMinutes * 60;

    setInitialTime((prev) => prev + extraSeconds);
    setTime(extraSeconds);
    setIsTimerVisible(true);
    setIsRunning(true);
    setShowTimeUpModal(false);
    resetCheckInSchedule('timed', initialTime + extraSeconds, 0);
    showToast('success', `Added ${safeMinutes} more minute${safeMinutes === 1 ? '' : 's'}`);
  };

  // Phase 3.5 — "Resume Later" from TimeUpModal
  const handleTimeUpResumeLater = () => {
    setShowTimeUpModal(false);
    setSessionStartTime(null);
    setCelebratedMilestones(new Set());
    clearCheckInRuntime();
    // Override completed flag — task is not finished
    sessionToSave.current = {
      ...sessionToSave.current,
      completed: false,
    };
    postSessionNotesActionRef.current = 'resume-later';
    setShowNotesModal(true);
  };

  const handleUseTask = (session) => {
    setTask(session.task);
    setTime(0);
    setInitialTime(0);
    setIsRunning(false);
    setIsIncognito(false);
    setContextNotes(session.notes || '');
    setCurrentSessionId(session.id);
    setShowNotesModal(false);
    setShowCompletionModal(false);
    setShowTimeUpModal(false);
    setShowSettings(false);
    setDistractionJarOpen(false);
    setShowQuickCapture(false);
    setShowTaskPreview(false);
    setPreviewReturnToHistory(false);
    setShowHistoryModal(false);
    setIsStartModalOpen(false);
    setIsTimerVisible(true);
    setSessionStartTime(null);
    setCelebratedMilestones(new Set());
    pendingPostModalResizeRef.current = {
      minWidth: 500,
      minHeight: session.notes?.trim() ? WINDOW_SIZES.contextHeight : WINDOW_SIZES.timerHeight,
    };
  };

  const handlePreviewTask = (session) => {
    setPreviewSession(session);
    setPreviewReturnToHistory(true);
    setShowTaskPreview(true);
    setShowHistoryModal(false);
  };

  const handleCloseTaskPreview = () => {
    setShowTaskPreview(false);
    if (previewReturnToHistory) {
      setShowHistoryModal(true);
    }
    setPreviewReturnToHistory(false);
  };

  const handleUpdateTaskNotes = async (sessionId, newNotes) => {
    try {
      await SessionStore.update(sessionId, { notes: newNotes });
      await loadSessions();
      if (previewSession && previewSession.id === sessionId) {
        setPreviewSession({ ...previewSession, notes: newNotes });
      }
      if (currentSessionId === sessionId) {
        setContextNotes(newNotes);
      }
    } catch (error) {
      console.error('Error updating session notes:', error);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      const removed = await SessionStore.delete(sessionId);
      if (!removed) return;

      await loadSessions();

      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setContextNotes('');
      }

      if (previewSession?.id === sessionId) {
        setShowTaskPreview(false);
        setPreviewSession(null);
        setPreviewReturnToHistory(false);
      }

      showToast('success', 'Session deleted');
    } catch (error) {
      console.error('Error deleting session:', error);
      showToast('warning', 'Could not delete session');
    }
  };

  const handleDeleteSessions = async (sessionIds) => {
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) return;

    try {
      const removedCount = await SessionStore.deleteMany(sessionIds);
      if (!removedCount) return;

      await loadSessions();

      if (currentSessionId && sessionIds.includes(currentSessionId)) {
        setCurrentSessionId(null);
        setContextNotes('');
      }

      if (previewSession?.id && sessionIds.includes(previewSession.id)) {
        setShowTaskPreview(false);
        setPreviewSession(null);
        setPreviewReturnToHistory(false);
      }

      showToast('success', `Deleted ${removedCount} session${removedCount === 1 ? '' : 's'}`);
    } catch (error) {
      console.error('Error deleting sessions:', error);
      showToast('warning', 'Could not delete selected sessions');
    }
  };

  const handleUpdateContextNotes = async (newNotes) => {
    setContextNotes(newNotes);
    if (currentSessionId && newNotes !== contextNotes) {
      try {
        await SessionStore.update(currentSessionId, { notes: newNotes });
        await loadSessions();
      } catch (error) {
        console.error('Error updating session notes:', error);
      }
    }
  };

  const addThought = (text) => setThoughts((prev) => [...prev, { id: Date.now().toString(36) + Math.random().toString(36).slice(2), text, completed: false }]);
  const removeThought = (index) => setThoughts((prev) => prev.filter((_, i) => i !== index));
  const toggleThought = (index) => {
    const newThoughts = [...thoughts];
    newThoughts[index].completed = !newThoughts[index].completed;
    setThoughts(newThoughts);
  };
  const clearCompletedThoughts = () => setThoughts((prev) => prev.filter((t) => !t.completed));

  const getPulseClassName = () => {
    if (!isPulsing) return '';
    if (isPulsing === 'gentle') return 'animate-pulse-gentle';
    if (isPulsing === 'celebration') return 'animate-pulse-celebration';
    return '';
  };

  const isShortFullWindow = windowHeight < 300;

  // Expand window to fit modals, restore when all closed
  useEffect(() => {
    const MODAL_SIZES = [
      [showSettings, ...WINDOW_SIZES.modal.settings],
      [showHistoryModal, ...WINDOW_SIZES.modal.history],
      [showTaskPreview, ...WINDOW_SIZES.modal.taskPreview],
      [distractionJarOpen, ...WINDOW_SIZES.modal.parkingLot],
      [showTimeUpModal, ...WINDOW_SIZES.modal.timeUp],
      [showNotesModal, ...WINDOW_SIZES.modal.notes],
      [showCompletionModal, ...WINDOW_SIZES.modal.completion],
      [showQuickCapture, ...WINDOW_SIZES.modal.quickCapture],
    ];
    const active = MODAL_SIZES.find(([open]) => open);
    if (active) {
      window.electronAPI.modalOpened(active[1], active[2]);
      const retryTimer = setTimeout(() => {
        window.electronAPI.modalOpened(active[1], active[2]);
      }, 120);
      return () => clearTimeout(retryTimer);
    } else {
      window.electronAPI.modalClosed();
      const pendingResize = pendingPostModalResizeRef.current;
      if (pendingResize) {
        pendingPostModalResizeRef.current = null;
        if (postModalResizeTimerRef.current) {
          clearTimeout(postModalResizeTimerRef.current);
        }
        // Wait a tick so main-process modal-close restoration applies first.
        postModalResizeTimerRef.current = setTimeout(() => {
          window.electronAPI.ensureMainWindowSize?.(pendingResize.minWidth, pendingResize.minHeight);
          postModalResizeTimerRef.current = null;
        }, 30);
      } else {
        // Modal close can restore older bounds from main process;
        // re-apply current screen target after restoration settles.
        const settleTimer = setTimeout(() => {
          resyncFullWindowSize();
          setTimeout(() => resyncFullWindowSize(), 140);
        }, 60);
        return () => clearTimeout(settleTimer);
      }
    }
    return undefined;
  }, [showSettings, showHistoryModal, showTaskPreview, distractionJarOpen, showTimeUpModal, showNotesModal, showCompletionModal, showQuickCapture, resyncFullWindowSize]);

  // No active timer: keep full view tightly fit to content.
  // Base height matches the compact no-timer layout, then grows with
  // multi-line task input (and start-session chooser when shown).
  useEffect(() => {
    const hasModalOpen =
      showSettings ||
      showHistoryModal ||
      showTaskPreview ||
      distractionJarOpen ||
      showTimeUpModal ||
      showNotesModal ||
      showCompletionModal ||
      showQuickCapture;

    if (isIncognito || hasModalOpen) return undefined;
    if (isRunning || isTimerVisible || contextNotes.trim()) return undefined;

    const resizeTimer = setTimeout(() => {
      resizeToMainCardContent(getIdleScreenDefaultHeight());
    }, 40);

    return () => clearTimeout(resizeTimer);
  }, [
    isIncognito,
    isRunning,
    isTimerVisible,
    task,
    contextNotes,
    isStartModalOpen,
    getIdleScreenDefaultHeight,
    resizeToMainCardContent,
    showSettings,
    showHistoryModal,
    showTaskPreview,
    distractionJarOpen,
    showTimeUpModal,
    showNotesModal,
    showCompletionModal,
    showQuickCapture,
  ]);

  // Active full-view states: deterministic default heights by screen.
  useEffect(() => {
    const hasModalOpen =
      showSettings ||
      showHistoryModal ||
      showTaskPreview ||
      distractionJarOpen ||
      showTimeUpModal ||
      showNotesModal ||
      showCompletionModal ||
      showQuickCapture;

    if (isIncognito || hasModalOpen) return undefined;
    if (!isRunning && !isTimerVisible && !contextNotes.trim()) return undefined;

    const targetHeight = getActiveScreenDefaultHeight();
    const resizeTimer = setTimeout(() => {
      resizeToMainCardContent(targetHeight);
    }, 40);

    return () => clearTimeout(resizeTimer);
  }, [
    isIncognito,
    isRunning,
    isTimerVisible,
    contextNotes,
    checkInState,
    checkInResult,
    checkInMessage,
    showSettings,
    showHistoryModal,
    showTaskPreview,
    distractionJarOpen,
    showTimeUpModal,
    showNotesModal,
    showCompletionModal,
    showQuickCapture,
    getActiveScreenDefaultHeight,
    resizeToMainCardContent,
  ]);

  // Resize window for pill/full mode
  useEffect(() => {
    if (isIncognito) {
      window.electronAPI.enterPillMode();
    } else {
      window.electronAPI.exitPillMode();
    }
  }, [isIncognito]);

  // Incognito mode render
  if (isIncognito) {
    return (
      // electron-draggable on the outer container lets users drag the pill window
      // from the transparent corner pixels (outside the rounded pill shape).
      // The pill itself is electron-no-drag so its mouse events fire normally.
      <div className="app-container pill-mode electron-draggable">
        <IncognitoMode
          task={task}
          isRunning={isRunning}
          time={time}
          showTaskByDefault={showTaskInCompactDefault}
          onDoubleClick={handleExitIncognito}
          onOpenDistractionJar={handleOpenParkingLot}
          thoughtCount={thoughts.length}
          onPlay={handlePlay}
          onPause={handlePause}
          onStop={handleStop}
          pulseEnabled={pulseSettings.incognitoEnabled}
          dndActive={dndEnabled}
          checkInState={checkInState}
          checkInMessage={checkInMessage}
          onCheckInFocused={() => resolveCheckIn('focused')}
          onCheckInThumbsDown={openCheckInDetourChoice}
          onCheckInFinished={handleCheckInFinished}
          onCheckInDetour={handleCheckInDetour}
          onCheckInParkIt={handleCheckInParkIt}
          onCheckInDismiss={handleCheckInDetourDismiss}
        />
        <SessionNotesModal isOpen={showNotesModal} onClose={handleSkipSessionNotes} onSave={handleSaveSessionNotes} sessionDuration={sessionToSave.current?.duration || 0} taskName={task} />
        <TaskCompletionModal
          isOpen={showCompletionModal}
          taskName={task}
          onCompleted={() => handleStopFlowCompletionDecision(true)}
          onNotCompleted={() => handleStopFlowCompletionDecision(false)}
          onDismiss={handleStopFlowCompletionDismiss}
        />
        <TimeUpModal isOpen={showTimeUpModal} taskName={task} onEndSession={handleTimeUpEndSession} onKeepGoing={handleTimeUpKeepGoing} onResumeLater={handleTimeUpResumeLater} />
        <TaskPreviewModal
          isOpen={showTaskPreview}
          onClose={handleCloseTaskPreview}
          session={previewSession}
          sessions={sessions}
          onUseTask={handleUseTask}
          onUpdateNotes={handleUpdateTaskNotes}
        />
        <HistoryModal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          sessions={sessions}
          onUseTask={handleUseTask}
          onPreviewTask={handlePreviewTask}
          onDeleteSession={handleDeleteSession}
          onDeleteSessions={handleDeleteSessions}
        />
        <QuickCaptureModal isOpen={showQuickCapture} onClose={() => setShowQuickCapture(false)} onSave={() => showToast('success', 'Saved to Parking Lot')} />
        <Toast toast={toast} onDismiss={() => setToast(null)} />
        {showConfetti && <ConfettiBurst burstId={confettiBurstId} />}
      </div>
    );
  }

  // Full view render
  return (
    <div className="app-container">
      <div ref={mainCardRef} className={`main-card electron-draggable ${getPulseClassName()}`}>
        {/* Header */}
        <div className="electron-draggable" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
            <img
              src={theme === 'light' ? appLockupLight : appLockupDark}
              alt="Focana"
              style={{
                height: 36,
                width: '100%',
                maxWidth: 1296,
                objectFit: 'contain',
                objectPosition: 'left center',
                flexShrink: 1,
                display: 'block',
              }}
            />
          </div>
          <div className="electron-no-drag top-toolbar" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {pinControlsToToolbar && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={handleToggleTheme} size="icon" variant="ghost" style={{ height: '2rem', width: '2rem', color: 'var(--text-secondary)' }}>
                      {theme === 'dark'
                        ? <Sun style={{ width: 18, height: 18 }} />
                        : <Moon style={{ width: 18, height: 18 }} />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>{theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={() => setShowHistoryModal(true)} size="icon" variant="ghost" style={{ height: '2rem', width: '2rem', color: 'var(--text-secondary)' }}>
                      <History style={{ width: 18, height: 18 }} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Session History</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={() => window.electronAPI.restartApp?.()} size="icon" variant="ghost" style={{ height: '2rem', width: '2rem', color: 'var(--text-secondary)' }}>
                      <RotateCcw style={{ width: 18, height: 18 }} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Restart App</p></TooltipContent>
                </Tooltip>
              </>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => setShowSettings(true)} size="icon" variant="ghost" style={{ height: '2rem', width: '2rem', color: 'var(--text-secondary)' }}>
                  <Settings style={{ width: 20, height: 20 }} />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Settings & Shortcuts</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => setDistractionJarOpen(true)} size="icon" variant="ghost" style={{ height: '2rem', width: '2rem', color: 'var(--text-secondary)', position: 'relative' }}>
                  <ClipboardList style={{ width: 20, height: 20 }} />
                  {thoughts.length > 0 && <span className="badge">{thoughts.length}</span>}
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Open Parking Lot</p></TooltipContent>
            </Tooltip>
            {dndEnabled && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '2rem', width: '2rem', color: 'var(--brand-action)', opacity: 0.7 }}>
                    <BellOff style={{ width: 15, height: 15 }} />
                  </span>
                </TooltipTrigger>
                <TooltipContent><p>Do Not Disturb is on</p></TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => setIsIncognito(true)} size="icon" variant="ghost" style={{ height: '2rem', width: '2rem', color: 'var(--text-secondary)' }}>
                  <Minimize2 style={{ width: 16, height: 16 }} />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Compact Mode</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleCloseWindow} size="icon" variant="ghost" style={{ height: '2rem', width: '2rem', color: 'var(--text-secondary)' }}>
                  <X style={{ width: 16, height: 16 }} />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Close Application</p></TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Content */}
        <div className="electron-no-drag" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <TaskInput
            ref={taskInputRef}
            task={task}
            setTask={setTask}
            isActive={isNoteFocused || isRunning}
            isLocked={isRunning}
            checkInPromptActive={checkInState === 'prompting' || checkInState === 'detour-choice'}
            checkInCelebrating={checkInCelebrating}
            checkInCelebrationType={checkInCelebrationType}
            onFocus={() => setIsNoteFocused(true)}
            onBlur={() => setIsNoteFocused(false)}
            onTaskSubmit={handleTaskSubmit}
            onLockedInteraction={handleLockedTaskInputInteraction}
          />

          {(checkInState === 'prompting' || checkInState === 'detour-choice' || checkInState === 'detour-resolved' || checkInState === 'resolved') && (
            <div
              style={{
                width: '100%',
                maxWidth: checkInState === 'detour-choice' || checkInState === 'detour-resolved' ? 480 : 460,
                marginTop: '0.5rem',
                border: `1px solid ${checkInState === 'prompting' || checkInState === 'detour-choice' ? '#D97706' : 'var(--border-subtle)'}`,
                borderRadius: '0.5rem',
                padding: '0.5rem 0.625rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                background: 'var(--bg-card)',
                transition: 'all 0.25s ease',
                opacity: checkInState === 'resolved' && checkInResult === 'missed' ? 0.75 : 1,
              }}
            >
              {(checkInState === 'prompting' || checkInState === 'resolved') && (
                <>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                    {checkInState === 'prompting' ? 'Still focused?' : (checkInMessage || (checkInResult === 'missed' ? 'Check-in missed' : ''))}
                  </span>
                  {checkInState === 'prompting' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => resolveCheckIn('focused')}
                        style={{ width: '1.9rem', height: '1.9rem', borderRadius: '9999px' }}
                        title="Still focused"
                      >
                        <ThumbsUp style={{ width: 14, height: 14 }} />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={openCheckInDetourChoice}
                        style={{ width: '1.9rem', height: '1.9rem', borderRadius: '9999px' }}
                        title="Not focused"
                      >
                        <ThumbsDown style={{ width: 14, height: 14 }} />
                      </Button>
                    </div>
                  )}
                </>
              )}

              {checkInState === 'detour-choice' && (
                <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 600, flexShrink: 0 }}>
                    What happened?
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginLeft: 'auto' }}>
                    <Button
                      size="sm"
                      onClick={handleCheckInFinished}
                      style={{ height: '1.9rem', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      title="Finished"
                    >
                      <Check style={{ width: 13, height: 13 }} />
                      Finished
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCheckInDetour}
                      style={{ height: '1.9rem', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      title="Took a detour"
                    >
                      <Undo2 style={{ width: 13, height: 13 }} />
                      Took a detour
                    </Button>
                  </div>
                </div>
              )}

              {checkInState === 'detour-resolved' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                    {checkInMessage}
                  </span>
                  <Button
                    size="sm"
                    onClick={handleCheckInParkIt}
                    style={{ height: '1.85rem', borderRadius: '9999px', flexShrink: 0 }}
                    title="Open Parking Lot"
                  >
                    Park it?
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={handleCheckInDetourDismiss}
                    style={{ width: '1.85rem', height: '1.85rem', borderRadius: '9999px', flexShrink: 0 }}
                    title="Dismiss"
                  >
                    <X style={{ width: 12, height: 12 }} />
                  </Button>
                </div>
              )}
            </div>
          )}

          {isStartModalOpen && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              width: '100%',
              marginTop: '0.625rem',
              padding: '0.5rem 0.625rem',
              background: 'var(--bg-card)',
              borderRadius: '0.625rem',
              border: '1px solid var(--border-strong)',
            }}>
              <Button
                onClick={() => handleStartSession('freeflow', 0)}
                style={{ background: 'var(--brand-primary)', color: 'var(--text-on-brand)', fontSize: '0.8125rem', height: '2rem', padding: '0 0.75rem', flexShrink: 0, borderRadius: '0.375rem' }}
              >
                Freeflow
              </Button>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>OR</span>
              <Button
                onClick={() => handleStartSession('timed', parseInt(sessionMinutes) || 25)}
                style={{ background: 'var(--brand-primary)', color: 'var(--text-on-brand)', fontSize: '0.8125rem', height: '2rem', padding: '0 0.75rem', flexShrink: 0, borderRadius: '0.375rem' }}
              >
                Set Timer
              </Button>
              <input
                type="number"
                value={sessionMinutes}
                onChange={(e) => setSessionMinutes(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleStartSession('timed', parseInt(sessionMinutes) || 25); }}
                min="1"
                max="240"
                className="input"
                style={{ width: '3.25rem', textAlign: 'center', height: '2rem', fontSize: '0.8125rem', padding: '0 0.25rem', flexShrink: 0 }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', flexShrink: 0 }}>min</span>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => setIsStartModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.25rem', display: 'flex', alignItems: 'center', flexShrink: 0, borderRadius: '0.25rem' }}
                aria-label="Cancel"
              >
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>
          )}

          {contextNotes && (
            <ContextBox
              notes={contextNotes}
              onUpdateNotes={handleUpdateContextNotes}
              onDismiss={() => setContextNotes('')}
              isSessionActive={isRunning}
            />
          )}

          {isTimerVisible && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', width: '100%', marginTop: isShortFullWindow ? '0.5rem' : '1rem' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isShortFullWindow ? '0.5rem' : '0.75rem' }}>
                <div style={{
                  fontSize: isShortFullWindow ? '2rem' : '2.75rem',
                  fontWeight: 700,
                  transition: 'color 0.3s',
                  color: isRunning ? 'var(--timer-running)' : 'var(--text-secondary)',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}>
                  {formatTime(time)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isShortFullWindow ? '0.3rem' : '0.4rem' }}>
                  {!isRunning ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button onClick={handlePlay} disabled={!task.trim()} variant="outline" className="timer-run-btn" style={{
                          width: isShortFullWindow ? '2.15rem' : '2.6rem', height: isShortFullWindow ? '2.15rem' : '2.6rem', borderRadius: '9999px',
                          borderColor: 'var(--border-strong)', color: 'var(--text-secondary)', padding: 0,
                        }}>
                          <Play style={{ width: isShortFullWindow ? 17 : 21, height: isShortFullWindow ? 17 : 21 }} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Resume Timer</p></TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button onClick={handlePause} variant="outline" className="timer-run-btn" style={{
                          width: isShortFullWindow ? '2.15rem' : '2.6rem', height: isShortFullWindow ? '2.15rem' : '2.6rem', borderRadius: '9999px',
                          borderColor: 'var(--border-strong)', color: 'var(--text-secondary)', padding: 0,
                        }}>
                          <Pause style={{ width: isShortFullWindow ? 17 : 21, height: isShortFullWindow ? 17 : 21 }} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Pause Timer</p></TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={handleStop} disabled={!task.trim()} variant="outline" style={{
                        width: isShortFullWindow ? '2.15rem' : '2.6rem', height: isShortFullWindow ? '2.15rem' : '2.6rem', borderRadius: '9999px',
                        borderColor: 'var(--border-strong)', color: 'var(--text-secondary)', padding: 0,
                      }}>
                        <Square style={{ width: isShortFullWindow ? 17 : 21, height: isShortFullWindow ? 17 : 21 }} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Stop & Save Session</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={handleClear} size="icon" variant="ghost" style={{
                        width: isShortFullWindow ? '2.15rem' : '2.6rem', height: isShortFullWindow ? '2.15rem' : '2.6rem', borderRadius: '9999px',
                        color: 'var(--text-secondary)', padding: 0,
                      }}>
                        <RotateCcw style={{ width: isShortFullWindow ? 17 : 21, height: isShortFullWindow ? 17 : 21 }} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Clear Current Task & Timer</p></TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <ParkingLot isOpen={distractionJarOpen} onClose={handleCloseParkingLot} thoughts={thoughts} onAddThought={addThought} onRemoveThought={removeThought} onToggleThought={toggleThought} onClearCompleted={clearCompletedThoughts} />
      <SessionNotesModal isOpen={showNotesModal} onClose={handleSkipSessionNotes} onSave={handleSaveSessionNotes} sessionDuration={sessionToSave.current?.duration || 0} taskName={task} />
      <TaskCompletionModal
        isOpen={showCompletionModal}
        taskName={task}
        onCompleted={() => handleStopFlowCompletionDecision(true)}
        onNotCompleted={() => handleStopFlowCompletionDecision(false)}
        onDismiss={handleStopFlowCompletionDismiss}
      />
      <TaskPreviewModal
        isOpen={showTaskPreview}
        onClose={handleCloseTaskPreview}
        session={previewSession}
        sessions={sessions}
        onUseTask={handleUseTask}
        onUpdateNotes={handleUpdateTaskNotes}
      />
      <HistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        sessions={sessions}
        onUseTask={handleUseTask}
        onPreviewTask={handlePreviewTask}
        onDeleteSession={handleDeleteSession}
        onDeleteSessions={handleDeleteSessions}
      />
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenParkingLot={() => {
          setShowSettings(false);
          parkingLotReturnToIncognitoRef.current = false;
          setDistractionJarOpen(true);
        }}
        onOpenSessionHistory={() => {
          setShowSettings(false);
          setShowHistoryModal(true);
        }}
        onRestartApp={() => {
          setShowSettings(false);
          window.electronAPI.restartApp?.();
        }}
        onCloseApp={() => {
          setShowSettings(false);
          handleCloseWindow();
        }}
        shortcuts={shortcuts}
        onShortcutsChange={setShortcuts}
        shortcutsEnabledDefault={shortcutsEnabled}
        onShortcutsEnabledChange={setShortcutsEnabled}
        pulseSettings={pulseSettings}
        onPulseSettingsChange={setPulseSettings}
        showTaskInCompactDefault={showTaskInCompactDefault}
        onShowTaskInCompactDefaultChange={setShowTaskInCompactDefault}
        pinControlsToToolbarDefault={pinControlsToToolbar}
        onPinControlsToToolbarChange={setPinControlsToToolbar}
        dndEnabled={dndEnabled}
        onDndChange={(enabled) => {
          setDndEnabled(enabled);
          window.electronAPI.setDnd?.(enabled);
        }}
      />
      <QuickCaptureModal isOpen={showQuickCapture} onClose={() => setShowQuickCapture(false)} onSave={() => showToast('success', 'Saved to Parking Lot')} />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      {showConfetti && <ConfettiBurst burstId={confettiBurstId} />}
    </div>
  );
}
