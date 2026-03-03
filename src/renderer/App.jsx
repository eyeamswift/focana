import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './components/ui/Button';
import { Tooltip, TooltipTrigger, TooltipContent } from './components/ui/Tooltip';
import {
  X, Play, Pause, Square, RotateCcw, Minimize2,
  Settings, ClipboardList, History, Sun, Moon,
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
  timerHeight: 220,
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
  }, []);

  const saveSessionWithNotes = useCallback(async (notes) => {
    if (!task.trim() || !sessionToSave.current) return;

    const { duration, completed } = sessionToSave.current;

    if (duration > 0.1) {
      try {
        await SessionStore.create({
          task: task.trim(),
          duration_minutes: duration,
          mode,
          completed,
          notes: notes || undefined,
        });
        await loadSessions();
      } catch (error) {
        console.error('Error saving session:', error);
      }
    }

    sessionToSave.current = null;
  }, [task, mode, loadSessions]);

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

    // Normalize to compact full-view height so bottom spacing stays tight
    // instead of restoring a previously oversized window.
    setTimeout(() => {
      window.electronAPI.ensureMainWindowSize?.(WINDOW_SIZES.baseWidth, WINDOW_SIZES.idleHeight);
    }, 80);
  }, [isRunning, time, task]);

  // Shortcut handlers
  const handleShortcutStartPause = useCallback(() => {
    if (task.trim()) {
      const newRunning = !isRunning;
      setIsRunning(newRunning);
      if (newRunning && !sessionStartTime) {
        setSessionStartTime(Date.now());
        setCelebratedMilestones(new Set());
      }
      showToast('success', newRunning ? 'Session started' : 'Session paused');
    } else {
      if (isIncognito) handleExitIncognito();
      setTimeout(() => { taskInputRef.current?.focus(); }, 100);
      showToast('info', 'Enter a task to start timer');
    }
  }, [task, isRunning, sessionStartTime, isIncognito, handleExitIncognito, showToast]);

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
      if (pulseSettings.celebrationEnabled) triggerPulse('celebration', 1);

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
  }, [task, pulseSettings.celebrationEnabled, triggerPulse, mode, time, initialTime, saveSessionWithNotes, handleClear, showToast, isIncognito, handleExitIncognito]);

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

  // Time Awareness Pulse
  useEffect(() => {
    if (pulseSettings.timeAwarenessEnabled) {
      const checkTimeAwareness = () => {
        const now = Date.now();
        const timeSinceLastCheck = now - lastTimeAwarenessCheck;
        const intervalMs = pulseSettings.timeAwarenessInterval * 60 * 1000;
        if (timeSinceLastCheck >= intervalMs) {
          triggerPulse('gentle', 3);
          setLastTimeAwarenessCheck(now);
        }
      };
      timeAwarenessRef.current = setInterval(checkTimeAwareness, 60000);
      return () => clearInterval(timeAwarenessRef.current);
    }
  }, [pulseSettings.timeAwarenessEnabled, pulseSettings.timeAwarenessInterval, lastTimeAwarenessCheck, triggerPulse]);

  // Celebration Pulse — uses refs for time/milestones to avoid re-creating
  // the interval every second or on every milestone update
  useEffect(() => {
    if (isRunning && pulseSettings.celebrationEnabled && sessionStartTime) {
      const checkMilestones = () => {
        const currentTime = timeRef.current;
        const sessionDuration = mode === 'freeflow' ? currentTime : (initialTime - currentTime);
        const minutes = Math.floor(sessionDuration / 60);
        const milestones = [5, 15, 30, 45, 60, 90, 120];
        milestones.forEach((milestone) => {
          if (minutes >= milestone && !celebratedMilestonesRef.current.has(milestone)) {
            triggerPulse('celebration', 2);
            setCelebratedMilestones((prev) => new Set([...prev, milestone]));
          }
        });
      };
      celebrationCheckRef.current = setInterval(checkMilestones, 10000);
      return () => clearInterval(celebrationCheckRef.current);
    }
  }, [isRunning, pulseSettings.celebrationEnabled, mode, initialTime, sessionStartTime, triggerPulse]);

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
      sessionToSave.current = {
        duration: initialTime / 60,
        completed: true,
      };
      setShowTimeUpModal(true);
    }
  }, [mode, time, isRunning, initialTime]);

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

  const resyncFullWindowSize = useCallback(() => {
    if (isIncognito) return;
    const minHeight =
      contextNotes.trim()
        ? WINDOW_SIZES.contextHeight
        : (isRunning || isTimerVisible ? WINDOW_SIZES.timerHeight : WINDOW_SIZES.idleHeight);
    resizeToMainCardContent(minHeight);
  }, [isIncognito, contextNotes, isRunning, isTimerVisible, resizeToMainCardContent]);

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

  const handleStartSession = (selectedMode, minutes) => {
    setMode(selectedMode);
    if (selectedMode === 'freeflow') {
      setTime(0);
      setInitialTime(0);
    } else {
      const seconds = minutes * 60;
      setTime(seconds);
      setInitialTime(seconds);
    }
    setIsTimerVisible(true);
    setIsRunning(true);
    setSessionStartTime(Date.now());
    setCelebratedMilestones(new Set());
    setIsStartModalOpen(false);
    setTimeout(() => setIsIncognito(true), 100);
  };

  const handleSaveSessionNotes = async (notes) => {
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

  const handleSkipSessionNotes = () => {
    if (isStopFlowAwaitingCompletion) {
      setPendingSessionNotes('');
      setShowNotesModal(false);
      setShowCompletionModal(true);
      return;
    }
    saveSessionWithNotes('');
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
    showToast('success', `Added ${safeMinutes} more minute${safeMinutes === 1 ? '' : 's'}`);
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
      minHeight: session.notes?.trim() ? 360 : 240,
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
      resizeToMainCardContent(WINDOW_SIZES.idleHeight);
    }, 40);

    return () => clearTimeout(resizeTimer);
  }, [
    isIncognito,
    isRunning,
    isTimerVisible,
    task,
    contextNotes,
    isStartModalOpen,
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

    const targetHeight = contextNotes.trim() ? WINDOW_SIZES.contextHeight : WINDOW_SIZES.timerHeight;
    const resizeTimer = setTimeout(() => {
      resizeToMainCardContent(targetHeight);
    }, 40);

    return () => clearTimeout(resizeTimer);
  }, [
    isIncognito,
    isRunning,
    isTimerVisible,
    contextNotes,
    showSettings,
    showHistoryModal,
    showTaskPreview,
    distractionJarOpen,
    showTimeUpModal,
    showNotesModal,
    showCompletionModal,
    showQuickCapture,
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
        />
        <SessionNotesModal isOpen={showNotesModal} onClose={handleSkipSessionNotes} onSave={handleSaveSessionNotes} sessionDuration={sessionToSave.current?.duration || 0} taskName={task} />
        <TaskCompletionModal
          isOpen={showCompletionModal}
          taskName={task}
          onCompleted={() => handleStopFlowCompletionDecision(true)}
          onNotCompleted={() => handleStopFlowCompletionDecision(false)}
          onDismiss={handleStopFlowCompletionDismiss}
        />
        <TimeUpModal isOpen={showTimeUpModal} taskName={task} onEndSession={handleTimeUpEndSession} onKeepGoing={handleTimeUpKeepGoing} />
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
            onFocus={() => setIsNoteFocused(true)}
            onBlur={() => setIsNoteFocused(false)}
            onTaskSubmit={handleTaskSubmit}
            onLockedInteraction={handleLockedTaskInputInteraction}
          />

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
      <TimeUpModal isOpen={showTimeUpModal} taskName={task} onEndSession={handleTimeUpEndSession} onKeepGoing={handleTimeUpKeepGoing} />
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
      />
      <QuickCaptureModal isOpen={showQuickCapture} onClose={() => setShowQuickCapture(false)} onSave={() => showToast('success', 'Saved to Parking Lot')} />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      {showConfetti && <ConfettiBurst burstId={confettiBurstId} />}
    </div>
  );
}
