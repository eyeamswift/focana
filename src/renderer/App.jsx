import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { Button } from './components/ui/Button';
import { Tooltip, TooltipTrigger, TooltipContent } from './components/ui/Tooltip';
import {
  X, Play, Pause, Square, RotateCcw, Minimize2,
  Settings, ClipboardList, History, Sun, Moon, Check, Undo2, BellOff,
} from 'lucide-react';
import { SessionStore } from './adapters/store';
import { formatTime } from './utils/time';
import { track } from './utils/analytics';
import appLockupDark from '../assets/logo-lockup.svg';
import appLockupLight from '../assets/logo-lockup-light.svg';

import ParkingLot from './components/ParkingLot';
import SessionNotesModal from './components/SessionNotesModal';
import TaskCompletionModal from './components/TaskCompletionModal.jsx';
import TimeUpModal from './components/TimeUpModal';
import TaskPreviewModal from './components/TaskPreviewModal';
import ContextBox from './components/ContextBox';
import CompactMode from './components/CompactMode';
import TaskInput from './components/TaskInput';
import HistoryModal from './components/HistoryModal';
import SettingsModal from './components/SettingsModal';
import Toast from './components/Toast';
import QuickCaptureModal from './components/QuickCaptureModal';
import ConfettiBurst from './components/ConfettiBurst';
import CheckInPromptPopup from './components/CheckInPromptPopup';

const DEFAULT_SHORTCUTS = {
  startPause: 'CommandOrControl+Shift+S',
  newTask: 'CommandOrControl+N',
  toggleCompact: 'CommandOrControl+Shift+I',
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
    timeUp: [540, 460],
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
const PINNED_CONTROLS_DEFAULT = {
  theme: true,
  parkingLot: true,
  history: true,
  restart: false,
  close: true,
};
const ENABLED_MAIN_CONTROLS_DEFAULT = {
  theme: true,
  parkingLot: true,
  history: true,
  restart: true,
  close: true,
};

function computeStreak(sessions) {
  const completedDates = new Set();
  for (const s of sessions) {
    if (s.completed && s.createdAt) {
      completedDates.add(new Date(s.createdAt).toDateString());
    }
  }
  let streak = 0;
  const day = new Date();
  while (completedDates.has(day.toDateString())) {
    streak++;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

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
  const [sessionNotesFlowKey, setSessionNotesFlowKey] = useState(0);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showTimeUpModal, setShowTimeUpModal] = useState(false);
  const [isStopFlowAwaitingCompletion, setIsStopFlowAwaitingCompletion] = useState(false);
  const [contextNotes, setContextNotes] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState(null);

  // Task preview
  const [showTaskPreview, setShowTaskPreview] = useState(false);
  const [previewSession, setPreviewSession] = useState(null);
  const modalStackRef = useRef([]);

  // Compact mode
  const [isCompact, setIsCompact] = useState(false);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState(() => getStoredTheme() || getSystemTheme());
  const [isThemeManual, setIsThemeManual] = useState(() => Boolean(getStoredTheme()));
  const [shortcuts, setShortcuts] = useState(DEFAULT_SHORTCUTS);
  const [shortcutsEnabled, setShortcutsEnabled] = useState(true);
  const [shortcutsHydrated, setShortcutsHydrated] = useState(false);
  const [showTaskInCompactDefault, setShowTaskInCompactDefault] = useState(true);
  const [pinnedControls, setPinnedControls] = useState(PINNED_CONTROLS_DEFAULT);
  const [enabledMainControls, setEnabledMainControls] = useState(ENABLED_MAIN_CONTROLS_DEFAULT);
  const [suppressToolbarTooltips, setSuppressToolbarTooltips] = useState(false);
  const [compactTransitioning, setCompactTransitioning] = useState(false);
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
    compactEnabled: true,
  });
  const [isPulsing, setIsPulsing] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);

  const timerRef = useRef(null);
  const sessionToSave = useRef(null);
  const taskInputRef = useRef(null);
  const mainCardRef = useRef(null);
  const thoughtsLoadedRef = useRef(false);
  const confettiTimerRef = useRef(null);
  const pulseIntervalRef = useRef(null);
  const pulseTimeoutRef = useRef(null);
  const timeRef = useRef(0);
  const pendingPostModalResizeRef = useRef(null);
  const postModalResizeTimerRef = useRef(null);
  const parkingLotReturnToCompactRef = useRef(false);
  const wasParkingLotOpenRef = useRef(false);
  const postSessionNotesActionRef = useRef(null); // 'resume-later' | 'move-on' | null
  const checkInReturnToCompactRef = useRef(false);
  const checkInPromptTimeoutRef = useRef(null);
  const checkInResolveTimeoutRef = useRef(null);
  const checkInFreeflowNextRef = useRef(null);
  const checkInTimedThresholdsRef = useRef([]);
  const checkInTimedIndexRef = useRef(0);
  const checkInForcedNextRef = useRef(null);
  const checkInShortIntervalRef = useRef(false);
  const checkInStateRef = useRef('idle');
  const consecutiveMissesRef = useRef(0);
  const compactEnteredAtRef = useRef(null);
  const timeUpReturnToCompactRef = useRef(false);
  const lastInteractionTimeRef = useRef(Date.now());
  const isRunningRef = useRef(false);
  const sessionCreatePromiseRef = useRef(null);
  const suppressToolbarTooltipTimerRef = useRef(null);
  const pendingCompactExitHeightRef = useRef(null);
  const compactRevealTimerRef = useRef(null);
  const compactPrevTimerVisibleRef = useRef(null);
  const wasCompactRef = useRef(false);
  const suppressHistoryPopRef = useRef(false);
  const windowModeDesiredRef = useRef('full');
  const windowModeActualRef = useRef('full');
  const windowModeSyncingRef = useRef(false);

  const pushModal = (modalName) => { modalStackRef.current.push(modalName); };
  const popAndOpenPrevModal = () => {
    const prev = modalStackRef.current.pop();
    if (prev) {
      const openers = {
        settings: () => setShowSettings(true),
        history: () => setShowHistoryModal(true),
        parkingLot: () => setDistractionJarOpen(true),
        taskPreview: () => setShowTaskPreview(true),
      };
      openers[prev]?.();
    }
  };

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

  // Analytics: app opened
  useEffect(() => {
    track('app_opened');

    // Track last interaction for unresponsive session detection
    const updateInteraction = () => { lastInteractionTimeRef.current = Date.now(); };
    window.addEventListener('mousemove', updateInteraction);
    window.addEventListener('keydown', updateInteraction);

    const handleBeforeUnload = () => {
      if (isRunningRef.current) {
        const idleMs = Date.now() - lastInteractionTimeRef.current;
        if (idleMs > 10 * 60 * 1000) {
          track('app_unresponsive_session', { idle_minutes: Math.round(idleMs / 60000) });
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('mousemove', updateInteraction);
      window.removeEventListener('keydown', updateInteraction);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (isThemeManual) {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } else {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    }
  }, [theme, isThemeManual]);

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-window-mode', isCompact ? 'pill' : 'full');
    return () => {
      document.documentElement.removeAttribute('data-window-mode');
    };
  }, [isCompact]);

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
  timeRef.current = time;
  isRunningRef.current = isRunning;

  useEffect(() => {
    return () => {
      if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
      if (pulseIntervalRef.current) clearInterval(pulseIntervalRef.current);
      if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
      if (postModalResizeTimerRef.current) clearTimeout(postModalResizeTimerRef.current);
      if (checkInPromptTimeoutRef.current) clearTimeout(checkInPromptTimeoutRef.current);
      if (checkInResolveTimeoutRef.current) clearTimeout(checkInResolveTimeoutRef.current);
      if (suppressToolbarTooltipTimerRef.current) clearTimeout(suppressToolbarTooltipTimerRef.current);
      if (compactRevealTimerRef.current) clearTimeout(compactRevealTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (showNotesModal) {
      setSessionNotesFlowKey((prev) => prev + 1);
    }
  }, [showNotesModal]);

  // Helpers
  const showToast = useCallback((type, message, duration = 2000) => {
    setToast({ type, message, duration });
  }, []);

  // Snapshot timer-visibility when entering compact so exit restores the
  // previous full-view layout instead of forcing timer UI.
  useEffect(() => {
    if (isCompact && !wasCompactRef.current) {
      compactPrevTimerVisibleRef.current = isTimerVisible;
    }
    wasCompactRef.current = isCompact;
  }, [isCompact, isTimerVisible]);

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

  const ensureCurrentSessionId = useCallback(async (source = 'unknown') => {
    if (currentSessionId) return currentSessionId;
    const trimmedTask = task.trim();
    if (!trimmedTask) return null;

    if (sessionCreatePromiseRef.current) {
      return sessionCreatePromiseRef.current;
    }

    sessionCreatePromiseRef.current = (async () => {
      try {
        const created = await SessionStore.create({
          task: trimmedTask,
          duration_minutes: 0,
          mode,
          completed: false,
          notes: contextNotes || '',
        });
        const nextSessionId = created?.id || null;
        if (nextSessionId) {
          setCurrentSessionId(nextSessionId);
          await loadSessions();
        }
        return nextSessionId;
      } catch (error) {
        console.error(`Error creating session (${source}):`, error);
        return null;
      } finally {
        sessionCreatePromiseRef.current = null;
      }
    })();

    return sessionCreatePromiseRef.current;
  }, [currentSessionId, task, mode, contextNotes, loadSessions]);

  const handleClear = useCallback(() => {
    setIsRunning(false);
    setTime(0);
    setTask('');
    setInitialTime(0);
    setContextNotes('');
    setCurrentSessionId(null);
    setIsTimerVisible(false);
    setIsCompact(false);
    setShowNotesModal(false);
    setShowCompletionModal(false);
    setShowTimeUpModal(false);
    setIsStopFlowAwaitingCompletion(false);
    setSessionStartTime(null);
    sessionCreatePromiseRef.current = null;

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

  const handleExitCompact = useCallback(() => {
    setIsCompact(false);

    const shouldForceIdleLayout = (
      !isRunning
      && !task.trim()
      && !contextNotes.trim()
      && !isStartModalOpen
    );

    // Restore full-view timer visibility to pre-compact state.
    const restoredTimerVisible = shouldForceIdleLayout
      ? false
      : (isRunning
        ? true
        : (compactPrevTimerVisibleRef.current !== null
          ? Boolean(compactPrevTimerVisibleRef.current)
          : isTimerVisible));
    setIsTimerVisible(restoredTimerVisible);
    compactPrevTimerVisibleRef.current = null;

    let exitTargetHeight = isStartModalOpen ? WINDOW_SIZES.startChooserHeight : WINDOW_SIZES.idleHeight;
    if (contextNotes.trim()) {
      exitTargetHeight = WINDOW_SIZES.contextHeight;
    } else if (isRunning || restoredTimerVisible) {
      if (checkInState === 'prompting') exitTargetHeight = WINDOW_SIZES.timerCheckInPromptHeight;
      else if (checkInState === 'detour-choice') exitTargetHeight = WINDOW_SIZES.timerCheckInDetourChoiceHeight;
      else if (checkInState === 'detour-resolved') exitTargetHeight = WINDOW_SIZES.timerCheckInDetourResolvedHeight;
      else if (checkInState === 'resolved') exitTargetHeight = WINDOW_SIZES.timerCheckInResolvedHeight;
      else exitTargetHeight = WINDOW_SIZES.timerHeight;
    }

    // Suppress transient tooltip artifacts during compact->full transition.
    if (suppressToolbarTooltipTimerRef.current) clearTimeout(suppressToolbarTooltipTimerRef.current);
    setSuppressToolbarTooltips(true);
    suppressToolbarTooltipTimerRef.current = setTimeout(() => {
      setSuppressToolbarTooltips(false);
      suppressToolbarTooltipTimerRef.current = null;
    }, 260);

    // Store desired full-view size and apply right after exit-pill-mode resolves.
    pendingCompactExitHeightRef.current = exitTargetHeight;
  }, [isRunning, task, contextNotes, isTimerVisible, checkInState, isStartModalOpen]);

  // Shortcut handlers
  const handleShortcutStartPause = useCallback(() => {
    if (task.trim()) {
      const newRunning = !isRunning;
      setIsRunning(newRunning);
      if (newRunning && !sessionStartTime) {
        setSessionStartTime(Date.now());
        if (!currentSessionId) void ensureCurrentSessionId('shortcut start');
        resetCheckInSchedule(mode, initialTime, getElapsedSeconds());
      }
      showToast('success', newRunning ? 'Session started' : 'Session paused');
    } else {
      if (isCompact) handleExitCompact();
      setTimeout(() => { taskInputRef.current?.focus(); }, 100);
      showToast('info', 'Enter a task to start timer');
    }
  }, [task, isRunning, sessionStartTime, isCompact, handleExitCompact, showToast, currentSessionId, mode, initialTime, ensureCurrentSessionId]);

  const handleShortcutNewTask = useCallback(() => {
    if (isCompact) handleExitCompact();
    setTimeout(() => {
      taskInputRef.current?.focus();
      taskInputRef.current?.select();
    }, 100);
  }, [isCompact, handleExitCompact]);

  const handleShortcutToggleCompact = useCallback(() => {
    const newCompact = !isCompact;
    if (newCompact) {
      setIsCompact(true);
    } else {
      handleExitCompact();
    }
    showToast('info', newCompact ? 'Compact Mode On' : 'Compact Mode Off');
  }, [isCompact, handleExitCompact, showToast]);

  const handleShortcutCompleteTask = useCallback(async () => {
    if (task.trim()) {
      setIsRunning(false);
      setSessionStartTime(null);

      const durationMin = mode === 'freeflow' ? time / 60 : (initialTime - time) / 60;
      sessionToSave.current = {
        duration: durationMin,
        completed: true,
      };
      track('session_completed', { mode, duration_minutes: Math.round(durationMin * 10) / 10, source: 'shortcut' });

      // Session streak
      try {
        const allSessions = await SessionStore.list();
        const streak = computeStreak(allSessions);
        if (streak >= 2) track('session_streak', { streak_count: streak });
      } catch (_) { /* non-critical */ }

      const settings = await window.electronAPI.storeGet('settings') || {};
      const keepText = settings.keepTextAfterCompletion ?? false;

      if (keepText) {
        setIsStopFlowAwaitingCompletion(false);
        if (isCompact) {
          handleExitCompact();
        }
        setShowNotesModal(true);
      } else {
        saveSessionWithNotes('');
        handleClear();
        showToast('success', 'Task completed!');
      }
    }
  }, [task, mode, time, initialTime, saveSessionWithNotes, handleClear, showToast, isCompact, handleExitCompact]);

  const handleShortcutAction = useCallback((action) => {
    (async () => {
      const settings = await window.electronAPI.storeGet('settings') || {};
      const bringToFront = settings.bringToFront ?? true;
      if (bringToFront) window.electronAPI.bringToFront();

      switch (action) {
        case 'startPause': handleShortcutStartPause(); break;
        case 'newTask': handleShortcutNewTask(); break;
        case 'toggleCompact': handleShortcutToggleCompact(); break;
        case 'completeTask': handleShortcutCompleteTask(); break;
        case 'openParkingLot': setShowQuickCapture(true); break;
      }
    })();
  }, [handleShortcutStartPause, handleShortcutNewTask, handleShortcutToggleCompact, handleShortcutCompleteTask]);

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
        setPinnedControls({ ...PINNED_CONTROLS_DEFAULT, ...(settings.pinnedControls || {}) });
        setEnabledMainControls({ ...ENABLED_MAIN_CONTROLS_DEFAULT, ...(settings.mainScreenControlsEnabled || {}) });
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
      track('dnd_toggled', { enabled, source: 'tray' });
      (async () => {
        const settings = await window.electronAPI.storeGet('settings') || {};
        settings.doNotDisturbEnabled = enabled;
        await window.electronAPI.storeSet('settings', settings);
      })();
    });
    return () => { if (cleanup) cleanup(); };
  }, []);

  useEffect(() => {
    const cleanup = window.electronAPI.onTrayOpenHistory?.(() => {
      setShowSettings(false);
      setShowTaskPreview(false);
      setShowHistoryModal(true);
    });
    return () => { if (cleanup) cleanup(); };
  }, []);

  useEffect(() => {
    const cleanup = window.electronAPI.onTrayThemeSelect?.((nextTheme) => {
      if (nextTheme !== 'light' && nextTheme !== 'dark') return;
      setTheme(nextTheme);
      setIsThemeManual(true);
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
    checkInReturnToCompactRef.current = false;
    clearCheckInUi();
  }, [clearCheckInUi]);

  const resetCheckInSchedule = useCallback((nextMode, nextInitialTimeSec = initialTime, elapsedSec = 0) => {
    const previousFreeflowNext = checkInFreeflowNextRef.current;
    const previousTimedThresholds = checkInTimedThresholdsRef.current;
    const previousTimedIndex = checkInTimedIndexRef.current;

    checkInFreeflowNextRef.current = null;
    checkInTimedThresholdsRef.current = [];
    checkInTimedIndexRef.current = 0;
    checkInForcedNextRef.current = null;
    checkInShortIntervalRef.current = false;

    if (!checkInSettings.enabled) return;

    if (nextMode === 'freeflow') {
      const intervalSeconds = getStandardCheckInIntervalSeconds(nextMode, nextInitialTimeSec);
      const nextTarget = elapsedSec + intervalSeconds;
      if (Number.isFinite(previousFreeflowNext) && previousFreeflowNext > elapsedSec) {
        checkInFreeflowNextRef.current = Math.min(previousFreeflowNext, nextTarget);
      } else {
        checkInFreeflowNextRef.current = nextTarget;
      }
      return;
    }

    const safeTotal = Math.max(1, Number(nextInitialTimeSec) || 0);
    const percents = (Array.isArray(checkInSettings.timedPercents) ? checkInSettings.timedPercents : [0.4, 0.8])
      .map((p) => Number(p))
      .filter((p) => Number.isFinite(p) && p > 0 && p < 1)
      .sort((a, b) => a - b);
    const nextThresholds = percents.map((p) => Math.round(safeTotal * p));
    let nextTimedIndex = 0;
    while (nextTimedIndex < nextThresholds.length && elapsedSec > nextThresholds[nextTimedIndex]) {
      nextTimedIndex += 1;
    }

    const sameThresholds = (
      previousTimedThresholds.length === nextThresholds.length
      && previousTimedThresholds.every((value, idx) => value === nextThresholds[idx])
    );
    if (sameThresholds) {
      nextTimedIndex = Math.max(nextTimedIndex, previousTimedIndex);
    }

    checkInTimedThresholdsRef.current = nextThresholds;
    checkInTimedIndexRef.current = nextTimedIndex;
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
    if (!task.trim()) return null;
    const sessionId = currentSessionId || await ensureCurrentSessionId('check-in log');
    if (!sessionId) return null;
    try {
      return await window.electronAPI.checkInAdd?.({
        sessionId,
        taskText: task.trim(),
        elapsedMinutes: Number((elapsedSec / 60).toFixed(2)),
        status,
      });
    } catch (error) {
      console.error('Failed to save check-in:', error);
      return null;
    }
  }, [currentSessionId, task, ensureCurrentSessionId]);

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
      track('checkin_responded', { response: 'focused' });
      if (checkInShortIntervalRef.current) {
        checkInShortIntervalRef.current = false;
        checkInForcedNextRef.current = null;
        resetCheckInSchedule(mode, initialTime, elapsedSec);
      } else {
        advanceCheckInScheduleAfterResult(elapsedSec);
      }
      consecutiveMissesRef.current = 0;
      if (isCompact) {
        setCheckInMessage('');
        setCheckInCelebrating(false);
        setCheckInCelebrationType('none');
        triggerConfetti(1200);
      } else {
        const randomMessage = CHECKIN_MESSAGES[Math.floor(Math.random() * CHECKIN_MESSAGES.length)];
        setCheckInMessage(randomMessage);
        setCheckInCelebrating(true);
        setCheckInCelebrationType('focused');
      }
    } else {
      track('checkin_responded', { response: 'missed' });
      consecutiveMissesRef.current += 1;
      if (consecutiveMissesRef.current >= 3) {
        track('checkin_dismissed_streak', { streak_count: consecutiveMissesRef.current });
      }
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
    if (checkInPromptTimeoutRef.current) clearTimeout(checkInPromptTimeoutRef.current);

    if (status === 'focused' && isCompact) {
      clearCheckInUi();
      return;
    }

    setCheckInState('resolved');
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
    isCompact,
    triggerConfetti,
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

    if (isCompact) {
      checkInReturnToCompactRef.current = true;
      handleExitCompact();
      setTimeout(() => {
        applyDetourChoiceState();
      }, 120);
      return;
    }

    checkInReturnToCompactRef.current = false;
    applyDetourChoiceState();
  }, [isCompact, handleExitCompact]);

  const handleCheckInFinished = useCallback(async () => {
    if (checkInStateRef.current !== 'detour-choice') return;
    if (checkInPromptTimeoutRef.current) clearTimeout(checkInPromptTimeoutRef.current);
    if (checkInResolveTimeoutRef.current) clearTimeout(checkInResolveTimeoutRef.current);
    checkInReturnToCompactRef.current = false; // session ending — no return to compact

    const elapsedSec = getElapsedSeconds();
    await logCheckIn('completed', elapsedSec);
    track('checkin_responded', { response: 'completed' });
    consecutiveMissesRef.current = 0;

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
    track('checkin_responded', { response: 'detour' });
    consecutiveMissesRef.current = 0;

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
    const shouldReturnToCompact = checkInReturnToCompactRef.current;
    checkInReturnToCompactRef.current = false;
    triggerPulse('celebration', 1);
    setCheckInCelebrating(true);
    setCheckInCelebrationType('focused');
    checkInResolveTimeoutRef.current = setTimeout(() => {
      clearCheckInUi();
      if (shouldReturnToCompact) {
        setTimeout(() => setIsCompact(true), 80);
      }
    }, 700);
  }, [clearCheckInUi, triggerPulse]);

  const triggerCheckInPrompt = useCallback(() => {
    if (!checkInSettings.enabled) return false;
    if (dndEnabled) return false;
    if (!isRunning) return false;
    if (!isTimerVisible) return false;
    if (!task.trim()) return false;
    if (!currentSessionId) {
      void ensureCurrentSessionId('check-in prompt');
    }
    if (checkInStateRef.current !== 'idle') return false;

    track('checkin_triggered', { mode, elapsed_minutes: Math.round(getElapsedSeconds() / 6) / 10 });
    setCheckInState('prompting');
    setCheckInResult(null);
    setCheckInMessage('');
    setCheckInCelebrating(false);
    setCheckInCelebrationType('none');

    if (checkInPromptTimeoutRef.current) clearTimeout(checkInPromptTimeoutRef.current);
    checkInPromptTimeoutRef.current = setTimeout(() => {
      resolveCheckIn('missed');
    }, 10000);
    return true;
  }, [checkInSettings.enabled, dndEnabled, isRunning, isTimerVisible, task, currentSessionId, ensureCurrentSessionId, resolveCheckIn, mode, getElapsedSeconds]);

  useEffect(() => {
    checkInStateRef.current = checkInState;
  }, [checkInState]);

  // When check-ins are disabled mid-session, clean up runtime state
  useEffect(() => {
    if (!checkInSettings.enabled) {
      clearCheckInRuntime();
    }
  }, [checkInSettings.enabled, clearCheckInRuntime]);

  useEffect(() => {
    if (!isRunning || !isTimerVisible || !task.trim() || !checkInSettings.enabled) {
      return;
    }
    if (checkInState !== 'idle') return;

    const elapsed = getElapsedSeconds();

    if (mode === 'freeflow') {
      // Forced short-interval check-in (after detour/miss)
      if (Number.isFinite(checkInForcedNextRef.current) && elapsed >= checkInForcedNextRef.current) {
        triggerCheckInPrompt();
        return;
      }

      // Lazy-init freeflow schedule if not yet set
      if (!Number.isFinite(checkInFreeflowNextRef.current)) {
        const intervalSeconds = getStandardCheckInIntervalSeconds('freeflow', initialTime);
        checkInFreeflowNextRef.current = elapsed + intervalSeconds;
      }
      if (elapsed >= checkInFreeflowNextRef.current) {
        triggerCheckInPrompt();
      }
      return;
    }

    // Timed mode — check thresholds directly from refs (set at session start)
    const idx = checkInTimedIndexRef.current;
    const thresholds = checkInTimedThresholdsRef.current;
    if (idx < thresholds.length && elapsed >= thresholds[idx]) {
      if (triggerCheckInPrompt()) {
        // Timed thresholds are mandatory; don't let a forced short interval suppress them.
        checkInForcedNextRef.current = null;
        checkInShortIntervalRef.current = false;
        checkInTimedIndexRef.current = idx + 1;
        return;
      }
    }

    // Non-threshold fallback in timed mode for detour short-interval follow-up.
    if (Number.isFinite(checkInForcedNextRef.current) && elapsed >= checkInForcedNextRef.current) {
      triggerCheckInPrompt();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time]);

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
      timeUpReturnToCompactRef.current = isCompact;
      setIsRunning(false);
      setIsStopFlowAwaitingCompletion(false);
      setIsCompact(false);
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
  }, [mode, time, isRunning, initialTime, clearCheckInRuntime, isCompact]);

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
    track('parking_lot_opened', { source: 'manual' });
    if (isCompact) {
      parkingLotReturnToCompactRef.current = true;
      handleExitCompact();
      setTimeout(() => setDistractionJarOpen(true), 140);
      return;
    }
    parkingLotReturnToCompactRef.current = false;
    setDistractionJarOpen(true);
  }, [isCompact, handleExitCompact]);

  const handleCloseParkingLot = useCallback(() => {
    setDistractionJarOpen(false);
    popAndOpenPrevModal();
  }, []);

  const handleCheckInParkIt = useCallback(() => {
    track('detour_parked');
    const shouldReturnToCompact = checkInReturnToCompactRef.current;
    checkInReturnToCompactRef.current = false;
    clearCheckInUi();
    // We're already in full view (exited compact for detour UI).
    // Pass the return-to-compact intent to the parking lot flow.
    parkingLotReturnToCompactRef.current = shouldReturnToCompact;
    setDistractionJarOpen(true);
  }, [clearCheckInUi]);

  useEffect(() => {
    const wasOpen = wasParkingLotOpenRef.current;
    if (wasOpen && !distractionJarOpen && parkingLotReturnToCompactRef.current) {
      parkingLotReturnToCompactRef.current = false;
      const t = setTimeout(() => {
        setIsCompact(true);
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
    if (isCompact) return;
    const minHeight = (isRunning || isTimerVisible)
      ? getActiveScreenDefaultHeight()
      : getIdleScreenDefaultHeight();
    resizeToMainCardContent(minHeight);
  }, [isCompact, isRunning, isTimerVisible, resizeToMainCardContent, getActiveScreenDefaultHeight, getIdleScreenDefaultHeight]);

  // Hard guard: when truly idle, force the compact full-screen height target.
  // This prevents stale larger bounds after compact->full race conditions.
  useEffect(() => {
    if (isCompact) return;
    if (isRunning) return;
    if (isTimerVisible) return;
    if (isStartModalOpen) return;
    if (contextNotes.trim()) return;
    if (task.trim()) return;
    window.electronAPI.ensureMainWindowSize?.(WINDOW_SIZES.baseWidth, WINDOW_SIZES.idleHeight);
    const t = setTimeout(() => {
      window.electronAPI.ensureMainWindowSize?.(WINDOW_SIZES.baseWidth, WINDOW_SIZES.idleHeight);
    }, 100);
    return () => clearTimeout(t);
  }, [isCompact, isRunning, isTimerVisible, isStartModalOpen, contextNotes, task]);

  const handlePlay = useCallback(() => {
    const trimmedTask = task.trim();
    if (!trimmedTask) return;

    setIsRunning(true);
    if (!isTimerVisible) {
      setIsTimerVisible(true);
    }
    if (!sessionStartTime) {
      setSessionStartTime(Date.now());
    }

    if (!currentSessionId) {
      void ensureCurrentSessionId('compact play');
    }
  }, [task, isTimerVisible, sessionStartTime, currentSessionId, ensureCurrentSessionId]);

  const handlePause = () => setIsRunning(false);

  const handleStop = () => {
    setIsRunning(false);
    setSessionStartTime(null);

    clearCheckInRuntime();
    if (isCompact) {
      handleExitCompact();
    }
    setIsStopFlowAwaitingCompletion(false);
    sessionToSave.current = {
      duration: mode === 'freeflow' ? time / 60 : (initialTime - time) / 60,
      completed: false,
    };
    setShowCompletionModal(true);
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
    track('session_started', { mode: selectedMode, duration_minutes: selectedMode === 'timed' ? minutes : null });

    clearCheckInRuntime();
    resetCheckInSchedule(selectedMode, initialSeconds, 0);
    setIsStartModalOpen(false);
    setTimeout(() => setIsCompact(true), 100);
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
  
      return;
    }

    if (isStopFlowAwaitingCompletion) {
      await finalizeIncompleteStop(notes);
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
  
      return;
    }

    if (isStopFlowAwaitingCompletion) {
      await finalizeIncompleteStop('');
      return;
    }
    await saveSessionWithNotes('');
    setShowNotesModal(false);
    handleClear();
  };

  const finalizeIncompleteStop = useCallback(async (notes = '') => {
    if (!sessionToSave.current) {
      setShowNotesModal(false);
      setIsStopFlowAwaitingCompletion(false);
      return;
    }

    const durationMin = sessionToSave.current?.duration || 0;
    sessionToSave.current = {
      ...sessionToSave.current,
      completed: false,
    };
    await saveSessionWithNotes(notes);

    setShowNotesModal(false);
    setIsStopFlowAwaitingCompletion(false);

    // Not completed: keep task text, but reset timer/session state.
    track('session_abandoned', { mode, duration_minutes: Math.round(durationMin * 10) / 10 });
    setIsRunning(false);
    setTime(0);
    setInitialTime(0);
    setIsTimerVisible(false);
    setSessionStartTime(null);
    showToast('info', 'Session saved. Task kept active');
  }, [mode, saveSessionWithNotes, showToast]);

  const handleStopFlowCompletionDismiss = () => {
    setShowCompletionModal(false);
    setIsStopFlowAwaitingCompletion(false);
    sessionToSave.current = null;
  };

  const handleStopFlowCompletionDecision = async (completed) => {
    if (!sessionToSave.current) {
      setShowCompletionModal(false);
      setIsStopFlowAwaitingCompletion(false);
      return;
    }

    if (completed) {
      const durationMin = sessionToSave.current?.duration || 0;
      sessionToSave.current = {
        ...sessionToSave.current,
        completed: true,
      };
      await saveSessionWithNotes('');

      setShowCompletionModal(false);
      setIsStopFlowAwaitingCompletion(false);

      track('session_completed', { mode, duration_minutes: Math.round(durationMin * 10) / 10, source: 'stop_flow' });

      const settings = await window.electronAPI.storeGet('settings') || {};
      const keepText = settings.keepTextAfterCompletion ?? false;

      if (keepText) {
        setIsRunning(false);
        setTime(0);
        setInitialTime(0);
        setIsTimerVisible(false);
        setSessionStartTime(null);

      } else {
        handleClear();
      }
      triggerConfetti();

      // Session streak
      try {
        const allSessions = await SessionStore.list();
        const streak = computeStreak(allSessions);
        if (streak >= 2) track('session_streak', { streak_count: streak });
      } catch (_) { /* non-critical */ }
      return;
    }

    setShowCompletionModal(false);
    setIsStopFlowAwaitingCompletion(true);
    setShowNotesModal(true);
  };

  const handleTimeUpEndSession = () => {
    track('post_session_choice', { choice: 'end_session' });
    setShowTimeUpModal(false);
    timeUpReturnToCompactRef.current = false;
    setSessionStartTime(null);

    clearCheckInRuntime();
    setShowNotesModal(true);
  };

  const handleTimeUpKeepGoing = (extraMinutes) => {
    track('post_session_choice', { choice: 'keep_going', extra_minutes: Math.min(Math.max(extraMinutes || 5, 1), 240) });
    const safeMinutes = Math.min(Math.max(extraMinutes || 5, 1), 240);
    const extraSeconds = safeMinutes * 60;
    const shouldReturnToCompact = timeUpReturnToCompactRef.current;
    timeUpReturnToCompactRef.current = false;

    setInitialTime((prev) => prev + extraSeconds);
    setTime(extraSeconds);
    setIsTimerVisible(true);
    setIsRunning(true);
    setShowTimeUpModal(false);
    resetCheckInSchedule('timed', initialTime + extraSeconds, 0);
    if (shouldReturnToCompact) {
      setTimeout(() => setIsCompact(true), 80);
    }
  };

  // Phase 3.5 — "Resume Later" from TimeUpModal
  const handleTimeUpResumeLater = () => {
    track('post_session_choice', { choice: 'resume_later' });
    setShowTimeUpModal(false);
    timeUpReturnToCompactRef.current = false;
    setSessionStartTime(null);

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
    if (!session || typeof session !== 'object') {
      setShowHistoryModal(false);
      return;
    }
    const nextTask = (
      (typeof session.task === 'string' && session.task)
      || (typeof session.taskText === 'string' && session.taskText)
      || ''
    );
    const nextNotes = (
      (typeof session.notes === 'string' && session.notes)
      || (typeof session.contextNote === 'string' && session.contextNote)
      || ''
    );

    // Prevent stale modal-stack reopen when "Use task" already performs
    // explicit modal closing.
    modalStackRef.current = [];
    suppressHistoryPopRef.current = true;
    setTask(nextTask);
    setTime(0);
    setInitialTime(0);
    setIsRunning(false);
    setIsCompact(false);
    setContextNotes(nextNotes);
    setCurrentSessionId(null);
    setShowNotesModal(false);
    setShowCompletionModal(false);
    setShowTimeUpModal(false);
    setShowSettings(false);
    setDistractionJarOpen(false);
    setShowQuickCapture(false);
    setShowTaskPreview(false);
    setShowHistoryModal(false);
    setIsStartModalOpen(false);
    setIsTimerVisible(true);
    setSessionStartTime(null);

    window.electronAPI.storeSet('currentTask', {
      text: nextTask,
      contextNote: nextNotes,
      startedAt: null,
    });
    window.electronAPI.storeSet('timerState', {
      mode: 'freeflow',
      seconds: 0,
      isRunning: false,
      initialTime: 0,
    });

    try {
      track('session_history_reused', { was_completed: session.completed ?? false });
      if (!session.completed) {
        track('resume_later_returned');
      }
    } catch (error) {
      console.error('Analytics tracking failed in handleUseTask:', error);
    }

    pendingPostModalResizeRef.current = {
      minWidth: 500,
      minHeight: nextNotes.trim() ? WINDOW_SIZES.contextHeight : WINDOW_SIZES.timerHeight,
    };
  };

  const handlePreviewTask = (session) => {
    setPreviewSession(session);
    pushModal('history');
    setShowTaskPreview(true);
    setShowHistoryModal(false);
  };

  const handleCloseTaskPreview = () => {
    setShowTaskPreview(false);
    popAndOpenPrevModal();
  };

  const handleCloseHistory = () => {
    setShowHistoryModal(false);
    if (suppressHistoryPopRef.current) {
      suppressHistoryPopRef.current = false;
      return;
    }
    popAndOpenPrevModal();
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
  const handleQuickCaptureSave = useCallback((text) => {
    if (!text?.trim()) return;
    setThoughts((prev) => [...prev, { id: Date.now().toString(36) + Math.random().toString(36).slice(2), text: text.trim(), completed: false }]);
    showToast('success', 'Saved to Parking Lot');
  }, [showToast]);
  const removeThought = (index) => setThoughts((prev) => prev.filter((_, i) => i !== index));
  const toggleThought = (index) => {
    const newThoughts = [...thoughts];
    newThoughts[index].completed = !newThoughts[index].completed;
    setThoughts(newThoughts);
  };
  const clearCompletedThoughts = () => {
    const completedCount = thoughts.filter((t) => t.completed).length;
    if (completedCount > 0) track('parking_lot_cleared', { cleared_count: completedCount });
    setThoughts((prev) => prev.filter((t) => !t.completed));
  };

  const getPulseClassName = () => {
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

    if (isCompact || hasModalOpen) return undefined;
    if (isRunning || isTimerVisible || contextNotes.trim()) return undefined;

    const resizeTimer = setTimeout(() => {
      resizeToMainCardContent(getIdleScreenDefaultHeight());
    }, 40);

    return () => clearTimeout(resizeTimer);
  }, [
    isCompact,
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

    if (isCompact || hasModalOpen) return undefined;
    if (!isRunning && !isTimerVisible && !contextNotes.trim()) return undefined;

    const targetHeight = getActiveScreenDefaultHeight();
    const resizeTimer = setTimeout(() => {
      resizeToMainCardContent(targetHeight);
    }, 40);

    return () => clearTimeout(resizeTimer);
  }, [
    isCompact,
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

  const syncWindowMode = useCallback(async () => {
    if (windowModeSyncingRef.current) return;
    windowModeSyncingRef.current = true;

    try {
      while (windowModeActualRef.current !== windowModeDesiredRef.current) {
        const targetMode = windowModeDesiredRef.current;

        if (targetMode === 'pill') {
          compactEnteredAtRef.current = Date.now();
          setCompactTransitioning(true);
          await window.electronAPI.enterPillMode();
          windowModeActualRef.current = 'pill';

          if (compactRevealTimerRef.current) clearTimeout(compactRevealTimerRef.current);
          compactRevealTimerRef.current = setTimeout(() => {
            setCompactTransitioning(false);
            compactRevealTimerRef.current = null;
          }, 40);
        } else {
          setCompactTransitioning(false);
          if (compactEnteredAtRef.current) {
            const durationSec = Math.round((Date.now() - compactEnteredAtRef.current) / 1000);
            track('view_mode_session', { mode: 'compact', duration_seconds: durationSec });
            compactEnteredAtRef.current = null;
          }

          await window.electronAPI.exitPillMode();
          windowModeActualRef.current = 'full';

          const pendingHeight = pendingCompactExitHeightRef.current;
          if (Number.isFinite(pendingHeight)) {
            window.electronAPI.ensureMainWindowSize?.(WINDOW_SIZES.baseWidth, pendingHeight);
            pendingCompactExitHeightRef.current = null;
          }
        }
      }
    } finally {
      windowModeSyncingRef.current = false;
      if (windowModeActualRef.current !== windowModeDesiredRef.current) {
        void syncWindowMode();
      }
    }
  }, []);

  // Resize window for pill/full mode (serialized to prevent enter/exit races).
  useEffect(() => {
    windowModeDesiredRef.current = isCompact ? 'pill' : 'full';
    void syncWindowMode();
  }, [isCompact, syncWindowMode]);

  // Safety net: if no active task/session in full mode, keep timer panel hidden.
  useEffect(() => {
    if (isCompact) return;
    if (isRunning) return;
    if (isStartModalOpen) return;
    if (contextNotes.trim()) return;
    if (task.trim()) return;
    if (!isTimerVisible) return;
    setIsTimerVisible(false);
  }, [isCompact, isRunning, isStartModalOpen, contextNotes, task, isTimerVisible]);

  // Compact mode render
  if (isCompact) {
    return (
      // electron-draggable on the outer container lets users drag the pill window
      // from the transparent corner pixels (outside the rounded pill shape).
      // The pill itself is electron-no-drag so its mouse events fire normally.
      <div className={`app-container pill-mode electron-draggable${compactTransitioning ? ' pill-mode--transitioning' : ''}`}>
        <CompactMode
          task={task}
          isRunning={isRunning}
          time={time}
          showTaskByDefault={showTaskInCompactDefault}
          onDoubleClick={handleExitCompact}
          onOpenDistractionJar={handleOpenParkingLot}
          thoughtCount={thoughts.length}
          onPlay={handlePlay}
          onPause={handlePause}
          onStop={handleStop}
          pulseEnabled={pulseSettings.compactEnabled}
          dndActive={dndEnabled}
          checkInState={checkInState}
        />
        <CheckInPromptPopup
          isOpen={checkInState === 'prompting'}
          onFocused={() => resolveCheckIn('focused')}
          onDetour={openCheckInDetourChoice}
          variant="compact"
        />
        <SessionNotesModal
          isOpen={showNotesModal}
          onClose={handleSkipSessionNotes}
          onSave={handleSaveSessionNotes}
          sessionDuration={sessionToSave.current?.duration || 0}
          taskName={task}
          sessionFlowKey={sessionNotesFlowKey}
        />
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
          onClose={handleCloseHistory}
          sessions={sessions}
          onUseTask={handleUseTask}
          onPreviewTask={handlePreviewTask}
          onDeleteSession={handleDeleteSession}
          onDeleteSessions={handleDeleteSessions}
        />
        <QuickCaptureModal isOpen={showQuickCapture} onClose={() => setShowQuickCapture(false)} onSave={handleQuickCaptureSave} />
        <Toast toast={toast} onDismiss={() => setToast(null)} />
        {showConfetti && <ConfettiBurst burstId={confettiBurstId} />}
      </div>
    );
  }

  // Full view render
  return (
    <div className={`app-container${suppressToolbarTooltips ? ' app-container--suppress-tooltips' : ''}`}>
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
            {enabledMainControls.restart && pinnedControls.restart && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => window.electronAPI.restartApp?.()} size="icon" variant="ghost" style={{ height: '2rem', width: '2rem', color: 'var(--text-secondary)' }}>
                    <RotateCcw style={{ width: 18, height: 18 }} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Restart App</p></TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => setShowSettings(true)} size="icon" variant="ghost" style={{ height: '2rem', width: '2rem', color: 'var(--text-secondary)' }}>
                  <Settings style={{ width: 20, height: 20 }} />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Settings & Shortcuts</p></TooltipContent>
            </Tooltip>
            {enabledMainControls.theme && pinnedControls.theme && (
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
            )}
            {enabledMainControls.history && pinnedControls.history && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => setShowHistoryModal(true)} size="icon" variant="ghost" style={{ height: '2rem', width: '2rem', color: 'var(--text-secondary)' }}>
                    <History style={{ width: 18, height: 18 }} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Session History</p></TooltipContent>
              </Tooltip>
            )}
            {enabledMainControls.parkingLot && pinnedControls.parkingLot && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => setDistractionJarOpen(true)} size="icon" variant="ghost" style={{ height: '2rem', width: '2rem', color: 'var(--text-secondary)', position: 'relative' }}>
                    <ClipboardList style={{ width: 20, height: 20 }} />
                    {thoughts.length > 0 && <span className="badge">{thoughts.length}</span>}
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Open Parking Lot</p></TooltipContent>
              </Tooltip>
            )}
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
                <Button onClick={() => setIsCompact(true)} size="icon" variant="ghost" style={{ height: '2rem', width: '2rem', color: 'var(--text-secondary)' }}>
                  <Minimize2 style={{ width: 16, height: 16 }} />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Compact Mode</p></TooltipContent>
            </Tooltip>
            {enabledMainControls.close && pinnedControls.close && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleCloseWindow} size="icon" variant="ghost" style={{ height: '2rem', width: '2rem', color: 'var(--text-secondary)' }}>
                    <X style={{ width: 16, height: 16 }} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Close Application</p></TooltipContent>
              </Tooltip>
            )}
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

          {(checkInState === 'detour-choice' || checkInState === 'detour-resolved' || checkInState === 'resolved') && (
            <div
              style={{
                width: '100%',
                maxWidth: checkInState === 'detour-choice' || checkInState === 'detour-resolved' ? 480 : 460,
                marginTop: '0.5rem',
                border: `1px solid ${checkInState === 'detour-choice' ? '#D97706' : 'var(--border-subtle)'}`,
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
              {checkInState === 'resolved' && (
                <>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                    {checkInMessage || (checkInResult === 'missed' ? 'Check-in missed' : '')}
                  </span>
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
                    Jot it down
                  </Button>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    and refocus.
                  </span>
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
      <SessionNotesModal
        isOpen={showNotesModal}
        onClose={handleSkipSessionNotes}
        onSave={handleSaveSessionNotes}
        sessionDuration={sessionToSave.current?.duration || 0}
        taskName={task}
        sessionFlowKey={sessionNotesFlowKey}
      />
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
        onClose={handleCloseHistory}
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
          parkingLotReturnToCompactRef.current = false;
          pushModal('settings');
          setDistractionJarOpen(true);
        }}
        onOpenSessionHistory={() => {
          setShowSettings(false);
          pushModal('settings');
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

        showTaskInCompactDefault={showTaskInCompactDefault}
        onShowTaskInCompactDefaultChange={setShowTaskInCompactDefault}
        pinnedControlsDefault={pinnedControls}
        onPinnedControlsChange={setPinnedControls}
        enabledControlsDefault={enabledMainControls}
        onEnabledControlsChange={setEnabledMainControls}
        dndEnabled={dndEnabled}
        onDndChange={(enabled) => {
          setDndEnabled(enabled);
          window.electronAPI.setDnd?.(enabled);
          track('dnd_toggled', { enabled });
        }}
        checkInSettings={checkInSettings}
        onCheckInSettingsChange={({ enabled, intervalFreeflow }) => {
          setCheckInSettings((prev) => ({
            ...prev,
            enabled: enabled ?? prev.enabled,
            intervalFreeflow: Number.isFinite(intervalFreeflow) ? intervalFreeflow : prev.intervalFreeflow,
          }));
        }}
      />
      <CheckInPromptPopup
        isOpen={checkInState === 'prompting'}
        onFocused={() => resolveCheckIn('focused')}
        onDetour={openCheckInDetourChoice}
        variant="full"
      />
      <QuickCaptureModal isOpen={showQuickCapture} onClose={() => setShowQuickCapture(false)} onSave={handleQuickCaptureSave} />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      {showConfetti && <ConfettiBurst burstId={confettiBurstId} />}
    </div>
  );
}
