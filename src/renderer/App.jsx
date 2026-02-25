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
import StatusBar from './components/StatusBar';
import SessionNotesModal from './components/SessionNotesModal';
import TaskPreviewModal from './components/TaskPreviewModal';
import ContextBox from './components/ContextBox';
import IncognitoMode from './components/IncognitoMode';
import TaskInput from './components/TaskInput';
import HistoryModal from './components/HistoryModal';
import SettingsModal from './components/SettingsModal';
import Toast from './components/Toast';
import QuickCaptureModal from './components/QuickCaptureModal';

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
  const [contextNotes, setContextNotes] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState(null);

  // Task preview
  const [showTaskPreview, setShowTaskPreview] = useState(false);
  const [previewSession, setPreviewSession] = useState(null);

  // Incognito
  const [isIncognito, setIsIncognito] = useState(false);

  // Always on top
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [shortcuts, setShortcuts] = useState(DEFAULT_SHORTCUTS);
  const [toast, setToast] = useState(null);
  const [showQuickCapture, setShowQuickCapture] = useState(false);

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

  // Helpers
  const showToast = useCallback((type, message, duration = 2000) => {
    setToast({ type, message, duration });
  }, []);

  const loadSessions = useCallback(async () => {
    const data = await SessionStore.list(50);
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
    setIsPulsing(type);
    let count = 0;
    const pulseInterval = setInterval(() => {
      count++;
      if (count >= repeats) {
        clearInterval(pulseInterval);
        setTimeout(() => setIsPulsing(false), 1000);
      }
    }, 1200);
  }, []);

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
      if (isIncognito) setIsIncognito(false);
      setTimeout(() => { taskInputRef.current?.focus(); }, 100);
      showToast('info', 'Enter a task to start timer');
    }
  }, [task, isRunning, sessionStartTime, isIncognito, showToast]);

  const handleShortcutNewTask = useCallback(() => {
    if (isIncognito) setIsIncognito(false);
    setTimeout(() => {
      taskInputRef.current?.focus();
      taskInputRef.current?.select();
    }, 100);
  }, [isIncognito]);

  const handleShortcutToggleIncognito = useCallback(() => {
    const newIncognito = !isIncognito;
    setIsIncognito(newIncognito);
    showToast('info', newIncognito ? 'Incognito Mode On' : 'Incognito Mode Off');
  }, [isIncognito, showToast]);

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
        setShowNotesModal(true);
      } else {
        saveSessionWithNotes('');
        handleClear();
        showToast('success', 'Task completed!');
      }
    }
  }, [task, pulseSettings.celebrationEnabled, triggerPulse, mode, time, initialTime, saveSessionWithNotes, handleClear, showToast]);

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
      await loadSessions();

      const savedThoughts = await window.electronAPI.storeGet('thoughts');
      if (savedThoughts) setThoughts(savedThoughts);
      thoughtsLoadedRef.current = true;

      const settings = await window.electronAPI.storeGet('settings') || {};
      if (settings.shortcuts) setShortcuts(settings.shortcuts);
      if (settings.pulseSettings) setPulseSettings(settings.pulseSettings);

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
    })();
  }, [loadSessions]);

  // Register shortcuts
  useEffect(() => {
    window.electronAPI.registerGlobalShortcuts(shortcuts);
    window.electronAPI.onShortcut((action) => {
      handleShortcutAction(action);
    });
  }, [shortcuts, handleShortcutAction]);

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

  // Celebration Pulse
  useEffect(() => {
    if (isRunning && pulseSettings.celebrationEnabled && sessionStartTime) {
      const checkMilestones = () => {
        const sessionDuration = mode === 'freeflow' ? time : (initialTime - time);
        const minutes = Math.floor(sessionDuration / 60);
        const milestones = [5, 15, 30, 45, 60, 90, 120];
        milestones.forEach((milestone) => {
          if (minutes >= milestone && !celebratedMilestones.has(milestone)) {
            triggerPulse('celebration', 2);
            setCelebratedMilestones((prev) => new Set([...prev, milestone]));
          }
        });
      };
      celebrationCheckRef.current = setInterval(checkMilestones, 10000);
      return () => clearInterval(celebrationCheckRef.current);
    }
  }, [isRunning, pulseSettings.celebrationEnabled, time, initialTime, mode, sessionStartTime, celebratedMilestones, triggerPulse]);

  // Timer logic
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTime((prevTime) => {
          if (mode === 'timed' && prevTime <= 1) {
            setIsRunning(false);
            setSessionStartTime(null);
            setCelebratedMilestones(new Set());
            sessionToSave.current = {
              duration: (initialTime - prevTime + 1) / 60,
              completed: true,
            };
            setShowNotesModal(true);
            return 0;
          }
          return mode === 'freeflow' ? prevTime + 1 : prevTime - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning, mode, initialTime]);

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
    await saveSessionWithNotes(notes);
    setShowNotesModal(false);
    handleClear();
  };

  const handleSkipSessionNotes = () => {
    saveSessionWithNotes('');
    setShowNotesModal(false);
    handleClear();
  };

  const handleUseTask = (session) => {
    setTask(session.task);
    setTime(0);
    setInitialTime(0);
    setIsRunning(false);
    setContextNotes(session.notes || '');
    setCurrentSessionId(session.id);
    setShowHistoryModal(false);
    setIsTimerVisible(true);
    setSessionStartTime(null);
    setCelebratedMilestones(new Set());
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

  const addThought = (text) => setThoughts((prev) => [...prev, { text, completed: false }]);
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

  // Expand window to fit modals, restore when all closed
  useEffect(() => {
    const MODAL_SIZES = [
      [showSettings,       420, 580],
      [showHistoryModal,   420, 500],
      [distractionJarOpen, 420, 500],
      [showNotesModal,     420, 400],
      [showQuickCapture,   420, 340],
    ];
    const active = MODAL_SIZES.find(([open]) => open);
    if (active) {
      window.electronAPI.modalOpened(active[1], active[2]);
    } else {
      window.electronAPI.modalClosed();
    }
  }, [showSettings, showHistoryModal, distractionJarOpen, showNotesModal, showQuickCapture]);

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
          onDoubleClick={() => setIsIncognito(false)}
          onOpenDistractionJar={() => setDistractionJarOpen(true)}
          thoughtCount={thoughts.length}
          onPlay={handlePlay}
          onPause={handlePause}
          onStop={handleStop}
          pulseEnabled={pulseSettings.incognitoEnabled}
        />

        <ParkingLot isOpen={distractionJarOpen} onClose={() => setDistractionJarOpen(false)} thoughts={thoughts} onAddThought={addThought} onRemoveThought={removeThought} onToggleThought={toggleThought} onClearCompleted={clearCompletedThoughts} />
        <SessionNotesModal isOpen={showNotesModal} onClose={handleSkipSessionNotes} onSave={handleSaveSessionNotes} sessionDuration={sessionToSave.current?.duration || 0} taskName={task} />
        <TaskPreviewModal isOpen={showTaskPreview} onClose={() => setShowTaskPreview(false)} session={previewSession} onUseTask={handleUseTask} onUpdateNotes={handleUpdateTaskNotes} />
        <HistoryModal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} sessions={sessions} onUseTask={handleUseTask} />
        <QuickCaptureModal isOpen={showQuickCapture} onClose={() => setShowQuickCapture(false)} onSave={() => showToast('success', 'Saved to Parking Lot')} />
        <Toast toast={toast} onDismiss={() => setToast(null)} />
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
            onFocus={() => setIsNoteFocused(true)}
            onTaskSubmit={handleTaskSubmit}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', width: '100%', marginTop: '1rem' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  fontSize: '3rem',
                  fontWeight: 700,
                  transition: 'color 0.3s',
                  color: isRunning ? '#D97706' : '#8B6F47',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {formatTime(time)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {!isRunning ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button onClick={handlePlay} disabled={!task.trim()} style={{
                          width: '3rem', height: '3rem', borderRadius: '9999px',
                          background: '#F59E0B', color: 'white', padding: 0,
                        }}>
                          <Play style={{ width: 24, height: 24 }} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Resume Timer</p></TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button onClick={handlePause} style={{
                          width: '3rem', height: '3rem', borderRadius: '9999px',
                          background: '#D97706', color: 'white', padding: 0,
                        }}>
                          <Pause style={{ width: 24, height: 24 }} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Pause Timer</p></TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={handleStop} disabled={!task.trim()} variant="outline" style={{
                        width: '3rem', height: '3rem', borderRadius: '9999px',
                        borderColor: 'rgba(139,111,71,0.3)', color: '#8B6F47', padding: 0,
                      }}>
                        <Square style={{ width: 24, height: 24 }} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Stop & Save Session</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={handleClear} size="icon" variant="ghost" style={{
                        width: '3rem', height: '3rem', borderRadius: '9999px',
                        color: '#8B6F47', padding: 0,
                      }}>
                        <RotateCcw style={{ width: 24, height: 24 }} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Clear Current Task & Timer</p></TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          )}

          <StatusBar task={task} isRunning={isRunning} time={time} isTimerVisible={isTimerVisible} />
        </div>
      </div>

      {/* Modals */}
      <ParkingLot isOpen={distractionJarOpen} onClose={() => setDistractionJarOpen(false)} thoughts={thoughts} onAddThought={addThought} onRemoveThought={removeThought} onToggleThought={toggleThought} onClearCompleted={clearCompletedThoughts} />
      <SessionNotesModal isOpen={showNotesModal} onClose={handleSkipSessionNotes} onSave={handleSaveSessionNotes} sessionDuration={sessionToSave.current?.duration || 0} taskName={task} />
      <TaskPreviewModal isOpen={showTaskPreview} onClose={() => setShowTaskPreview(false)} session={previewSession} onUseTask={handleUseTask} onUpdateNotes={handleUpdateTaskNotes} />
      <HistoryModal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} sessions={sessions} onUseTask={handleUseTask} />
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} shortcuts={shortcuts} onShortcutsChange={setShortcuts} pulseSettings={pulseSettings} onPulseSettingsChange={setPulseSettings} />
      <QuickCaptureModal isOpen={showQuickCapture} onClose={() => setShowQuickCapture(false)} onSave={() => showToast('success', 'Saved to Parking Lot')} />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
