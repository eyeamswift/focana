import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './components/ui/Button';
import { Tooltip, TooltipTrigger, TooltipContent } from './components/ui/Tooltip';
import {
  Brain, X, Play, Pause, Square, RotateCcw, Minimize2,
  History, Pin, Settings, ClipboardList,
} from 'lucide-react';
import { SessionStore } from './adapters/store';
import { formatTime } from './utils/time';

import ParkingLot from './components/ParkingLot';
import SessionNotesModal from './components/SessionNotesModal';
import TaskCompletionModal from './components/TaskCompletionModal.jsx';
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

  // Always on top
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [shortcuts, setShortcuts] = useState(DEFAULT_SHORTCUTS);
  const [shortcutsEnabled, setShortcutsEnabled] = useState(true);
  const [shortcutsHydrated, setShortcutsHydrated] = useState(false);
  const [showTaskInCompactDefault, setShowTaskInCompactDefault] = useState(false);
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
  const thoughtsLoadedRef = useRef(false);
  const confettiTimerRef = useRef(null);
  const pulseIntervalRef = useRef(null);
  const pulseTimeoutRef = useRef(null);
  const celebratedMilestonesRef = useRef(new Set());
  const timeRef = useRef(0);
  const pendingPostModalResizeRef = useRef(null);
  const postModalResizeTimerRef = useRef(null);

  useEffect(() => {
    const onResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    // Normalize full-view size on launch so hidden oversized window bounds
    // from prior modal flows don't make drag feel "sticky" near bottom edge.
    window.electronAPI.ensureMainWindowSize?.(500, 240);
  }, []);

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
        setShowTaskInCompactDefault(settings.showTaskInCompactDefault ?? false);
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
      setSessionStartTime(null);
      setCelebratedMilestones(new Set());
      setIsStopFlowAwaitingCompletion(false);
      setPendingSessionNotes('');
      setIsIncognito(false);
      sessionToSave.current = {
        duration: initialTime / 60,
        completed: true,
      };
      setShowNotesModal(true);
    }
  }, [mode, time, isRunning, initialTime]);

  // Actions
  const handleToggleAlwaysOnTop = async () => {
    const result = await window.electronAPI.toggleAlwaysOnTop();
    setIsAlwaysOnTop(result);
  };

  const handleCloseWindow = () => {
    window.electronAPI.closeWindow();
  };

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
    if (task.trim()) setIsStartModalOpen(true);
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
      [showSettings,       420, 580],
      [showHistoryModal,   420, 500],
      [showTaskPreview,    520, 620],
      [distractionJarOpen, 420, 500],
      [showNotesModal,     420, 500],
      [showCompletionModal, 420, 300],
      [showQuickCapture,   420, 340],
    ];
    const active = MODAL_SIZES.find(([open]) => open);
    if (active) {
      window.electronAPI.modalOpened(active[1], active[2]);
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
      }
    }
  }, [showSettings, showHistoryModal, showTaskPreview, distractionJarOpen, showNotesModal, showCompletionModal, showQuickCapture]);

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
          onOpenDistractionJar={() => setDistractionJarOpen(true)}
          thoughtCount={thoughts.length}
          onPlay={handlePlay}
          onPause={handlePause}
          onStop={handleStop}
          pulseEnabled={pulseSettings.incognitoEnabled}
        />

        <ParkingLot isOpen={distractionJarOpen} onClose={() => setDistractionJarOpen(false)} thoughts={thoughts} onAddThought={addThought} onRemoveThought={removeThought} onToggleThought={toggleThought} onClearCompleted={clearCompletedThoughts} />
        <SessionNotesModal isOpen={showNotesModal} onClose={handleSkipSessionNotes} onSave={handleSaveSessionNotes} sessionDuration={sessionToSave.current?.duration || 0} taskName={task} />
        <TaskCompletionModal isOpen={showCompletionModal} taskName={task} onCompleted={() => handleStopFlowCompletionDecision(true)} onNotCompleted={() => handleStopFlowCompletionDecision(false)} />
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
      <div className={`main-card electron-draggable ${getPulseClassName()}`}>
        {/* Header */}
        <div className="electron-draggable" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Brain style={{ width: 20, height: 20, color: '#D97706' }} />
            <h1 style={{ fontSize: '1rem', fontWeight: 700, color: '#5C4033' }}>Focana</h1>
          </div>
          <div className="electron-no-drag" style={{ display: 'flex', alignItems: 'center' }}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => setShowSettings(true)} size="icon" variant="ghost" style={{ height: '2rem', width: '2rem', color: '#8B6F47' }}>
                  <Settings style={{ width: 20, height: 20 }} />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Settings & Shortcuts</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => setShowHistoryModal(true)} size="icon" variant="ghost" style={{ height: '2rem', width: '2rem', color: '#8B6F47' }}>
                  <History style={{ width: 20, height: 20 }} />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>View Session History</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => setDistractionJarOpen(true)} size="icon" variant="ghost" style={{ height: '2rem', width: '2rem', color: '#8B6F47', position: 'relative' }}>
                  <ClipboardList style={{ width: 20, height: 20 }} />
                  {thoughts.length > 0 && <span className="badge">{thoughts.length}</span>}
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Open Parking Lot</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleToggleAlwaysOnTop}
                  size="icon"
                  variant="ghost"
                  style={{ height: '2rem', width: '2rem', color: isAlwaysOnTop ? '#D97706' : '#8B6F47' }}
                >
                  <Pin style={{ width: 16, height: 16 }} />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>{isAlwaysOnTop ? 'Disable' : 'Enable'} Always on Top</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => setIsIncognito(true)} size="icon" variant="ghost" style={{ height: '2rem', width: '2rem', color: '#8B6F47' }}>
                  <Minimize2 style={{ width: 16, height: 16 }} />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Compact Mode</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleCloseWindow} size="icon" variant="ghost" style={{ height: '2rem', width: '2rem', color: '#8B6F47' }}>
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
              background: '#FFF9E6',
              borderRadius: '0.625rem',
              border: '1px solid rgba(217, 119, 6, 0.3)',
            }}>
              <Button
                onClick={() => handleStartSession('freeflow', 0)}
                style={{ background: '#F59E0B', color: 'white', fontSize: '0.8125rem', height: '2rem', padding: '0 0.75rem', flexShrink: 0, borderRadius: '0.375rem' }}
              >
                Freeflow
              </Button>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#8B6F47', flexShrink: 0 }}>OR</span>
              <Button
                onClick={() => handleStartSession('timed', parseInt(sessionMinutes) || 25)}
                style={{ background: '#F59E0B', color: 'white', fontSize: '0.8125rem', height: '2rem', padding: '0 0.75rem', flexShrink: 0, borderRadius: '0.375rem' }}
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
              <span style={{ fontSize: '0.75rem', color: '#8B6F47', flexShrink: 0 }}>min</span>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => setIsStartModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#8B6F47', padding: '0.25rem', display: 'flex', alignItems: 'center', flexShrink: 0, borderRadius: '0.25rem' }}
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
                  color: isRunning ? '#D97706' : '#8B6F47',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}>
                  {formatTime(time)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isShortFullWindow ? '0.3rem' : '0.4rem' }}>
                  {!isRunning ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button onClick={handlePlay} disabled={!task.trim()} style={{
                          width: isShortFullWindow ? '2.15rem' : '2.6rem', height: isShortFullWindow ? '2.15rem' : '2.6rem', borderRadius: '9999px',
                          background: '#F59E0B', color: 'white', padding: 0,
                        }}>
                          <Play style={{ width: isShortFullWindow ? 17 : 21, height: isShortFullWindow ? 17 : 21 }} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Resume Timer</p></TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button onClick={handlePause} style={{
                          width: isShortFullWindow ? '2.15rem' : '2.6rem', height: isShortFullWindow ? '2.15rem' : '2.6rem', borderRadius: '9999px',
                          background: '#D97706', color: 'white', padding: 0,
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
                        borderColor: 'rgba(139,111,71,0.3)', color: '#8B6F47', padding: 0,
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
                        color: '#8B6F47', padding: 0,
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
      <ParkingLot isOpen={distractionJarOpen} onClose={() => setDistractionJarOpen(false)} thoughts={thoughts} onAddThought={addThought} onRemoveThought={removeThought} onToggleThought={toggleThought} onClearCompleted={clearCompletedThoughts} />
      <SessionNotesModal isOpen={showNotesModal} onClose={handleSkipSessionNotes} onSave={handleSaveSessionNotes} sessionDuration={sessionToSave.current?.duration || 0} taskName={task} />
      <TaskCompletionModal isOpen={showCompletionModal} taskName={task} onCompleted={() => handleStopFlowCompletionDecision(true)} onNotCompleted={() => handleStopFlowCompletionDecision(false)} />
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
      />
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        shortcuts={shortcuts}
        onShortcutsChange={setShortcuts}
        shortcutsEnabledDefault={shortcutsEnabled}
        onShortcutsEnabledChange={setShortcutsEnabled}
        pulseSettings={pulseSettings}
        onPulseSettingsChange={setPulseSettings}
        showTaskInCompactDefault={showTaskInCompactDefault}
        onShowTaskInCompactDefaultChange={setShowTaskInCompactDefault}
      />
      <QuickCaptureModal isOpen={showQuickCapture} onClose={() => setShowQuickCapture(false)} onSave={() => showToast('success', 'Saved to Parking Lot')} />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      {showConfetti && <ConfettiBurst burstId={confettiBurstId} />}
    </div>
  );
}
