
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Brain, X, Play, Pause, Square, RotateCcw, Minimize2, History, Pin, Settings, ClipboardList } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FocusSession } from "@/entities/FocusSession";

import DistractionJar from "../components/DistractionJar";
import StatusBar from "../components/StatusBar";
import SessionNotesModal from "../components/SessionNotesModal";
import TaskPreviewModal from "../components/TaskPreviewModal";
import ContextBox from "../components/ContextBox";
import IncognitoMode from "../components/IncognitoMode";
import CombinedTaskInput from "../components/CombinedTaskInput";
import HistoryModal from "../components/HistoryModal";
import StartSessionModal from "../components/StartSessionModal";
import SettingsModal from "../components/SettingsModal";
import ToastNotification from "../components/ToastNotification";
import QuickCaptureModal from "../components/QuickCaptureModal";

const DEFAULT_SHORTCUTS = {
  startPause: 'Cmd+Space',
  newTask: 'Cmd+N',
  toggleIncognito: 'Cmd+Shift+I',
  completeTask: 'Cmd+Enter',
  openParkingLot: 'Cmd+Shift+P'
};

export default function Focana() {
  // Core state
  const [task, setTask] = useState('');
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState('freeflow');
  const [customMinutes, setCustomMinutes] = useState('');
  const [initialTime, setInitialTime] = useState(0);
  const [isTimerVisible, setIsTimerVisible] = useState(false);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);

  // Distraction Jar state
  const [distractionJarOpen, setDistractionJarOpen] = useState(false);
  const [thoughts, setThoughts] = useState([]);

  // History modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Session history
  const [sessions, setSessions] = useState([]);

  // Focus state
  const [isNoteFocused, setIsNoteFocused] = useState(false);

  // Session notes state
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [contextNotes, setContextNotes] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState(null);

  // Task preview state
  const [showTaskPreview, setShowTaskPreview] = useState(false);
  const [previewSession, setPreviewSession] = useState(null);

  // Incognito mode state
  const [isIncognito, setIsIncognito] = useState(false);

  // Electron state
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  // Settings and shortcuts state
  const [showSettings, setShowSettings] = useState(false);
  const [shortcuts, setShortcuts] = useState(DEFAULT_SHORTCUTS);
  const [toast, setToast] = useState(null);
  const [showQuickCapture, setShowQuickCapture] = useState(false);

  // Pulse settings and state
  const [pulseSettings, setPulseSettings] = useState({
    timeAwarenessEnabled: true,
    timeAwarenessInterval: 30, // minutes
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

  // Draggable window state
  const dragRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Draggable window logic for web
  const onMouseMove = useCallback((e) => {
    if (isDraggingRef.current) {
      const newX = e.clientX - dragOffsetRef.current.x;
      const newY = e.clientY - dragOffsetRef.current.y;
      setPosition({ x: newX, y: newY });
    }
  }, []);

  const onMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }, [onMouseMove]);

  const onMouseDown = useCallback((e) => {
    if (isElectron) return;

    // Prevent dragging on interactive elements
    const noDragElements = ['BUTTON', 'INPUT', 'TEXTAREA', 'A', 'SELECT'];
    if (noDragElements.includes(e.target.tagName) || e.target.closest('.electron-no-drag')) {
        return;
    }

    isDraggingRef.current = true;
    dragOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [isElectron, position.x, position.y, onMouseMove, onMouseUp]);
  
  // Clean up listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);


  // Helper functions wrapped in useCallback to be stable dependencies
  const showToast = useCallback((type, message, duration = 2000) => {
    setToast({ type, message, duration });
  }, []);

  const loadSessions = useCallback(async () => {
    const data = await FocusSession.list('-created_date', 50);
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
    setCustomMinutes('');
    setIsIncognito(false);
    setSessionStartTime(null);
    setCelebratedMilestones(new Set());
  }, []);

  const saveSessionWithNotes = useCallback(async (notes) => {
    if (!task.trim() || !sessionToSave.current) return;

    const { duration, completed } = sessionToSave.current;

    if (duration > 0.1) {
      const sessionData = {
        task: task.trim(),
        duration_minutes: duration,
        mode,
        completed,
        notes: notes || undefined
      };

      try {
        await FocusSession.create(sessionData);
        await loadSessions();
      } catch (error) {
        console.error('Error saving session:', error);
      }
    }

    sessionToSave.current = null;
  }, [task, mode, loadSessions]);

  // Pulse animation function
  const triggerPulse = useCallback((type = 'gentle', repeats = 2) => {
    setIsPulsing(type);
    let count = 0;
    const pulseInterval = setInterval(() => {
      count++;
      if (count >= repeats) {
        clearInterval(pulseInterval);
        setTimeout(() => setIsPulsing(false), 1000);
      }
    }, 1200); // 1.2s between pulses
  }, []);

  // Shortcut action handlers - wrapped in useCallback for stability
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
      // Focus task input if no task
      if (isIncognito) {
        setIsIncognito(false);
      }
      setTimeout(() => {
        if (taskInputRef.current) {
          taskInputRef.current.focus();
        }
      }, 100);
      showToast('info', 'Enter a task to start timer');
    }
  }, [task, isRunning, sessionStartTime, isIncognito, showToast]);

  const handleShortcutNewTask = useCallback(() => {
    if (isIncognito) {
      setIsIncognito(false);
    }
    setTimeout(() => {
      if (taskInputRef.current) {
        taskInputRef.current.focus();
        taskInputRef.current.select();
      }
    }, 100);
  }, [isIncognito]);

  const handleShortcutToggleIncognito = useCallback(() => {
    const newIncognito = !isIncognito;
    setIsIncognito(newIncognito);
    showToast('info', newIncognito ? 'Incognito Mode On' : 'Incognito Mode Off');
  }, [isIncognito, showToast]);

  const handleShortcutCompleteTask = useCallback(() => {
    if (task.trim()) {
      // Trigger celebration pulse
      if (pulseSettings.celebrationEnabled) {
        triggerPulse('celebration', 1);
      }

      // Stop and save session
      setIsRunning(false);
      setSessionStartTime(null);
      setCelebratedMilestones(new Set());
      sessionToSave.current = {
        duration: mode === 'freeflow' ? time / 60 : (initialTime - time) / 60,
        completed: true,
      };

      const appSettings = JSON.parse(localStorage.getItem('focana-app-settings') || '{}');
      const keepText = appSettings.keepTextAfterCompletion ?? false;

      if (keepText) {
        setShowNotesModal(true);
      } else {
        saveSessionWithNotes('');
        handleClear();
        showToast('success', '✅ Task completed!');
      }
    }
  }, [task, pulseSettings.celebrationEnabled, triggerPulse, mode, time, initialTime, saveSessionWithNotes, handleClear, showToast]);

  // Shortcut action dispatcher
  const handleShortcutAction = useCallback((action) => {
    const appSettings = JSON.parse(localStorage.getItem('focana-app-settings') || '{}');
    const bringToFront = appSettings.bringToFront ?? true;

    if (bringToFront && window.electronAPI?.bringToFront) {
      window.electronAPI.bringToFront();
    }

    switch (action) {
      case 'startPause':
        handleShortcutStartPause();
        break;
      case 'newTask':
        handleShortcutNewTask();
        break;
      case 'toggleIncognito':
        handleShortcutToggleIncognito();
        break;
      case 'completeTask':
        handleShortcutCompleteTask();
        break;
      case 'openParkingLot':
        setShowQuickCapture(true);
        break;
      default:
        break;
    }
  }, [handleShortcutStartPause, handleShortcutNewTask, handleShortcutToggleIncognito, handleShortcutCompleteTask, setShowQuickCapture]);

  // Check if running in Electron
  useEffect(() => {
    setIsElectron(!!(window.electronAPI));
  }, []);

  // Load shortcuts from localStorage
  useEffect(() => {
    const savedShortcuts = localStorage.getItem('focana-shortcuts');
    if (savedShortcuts) {
      setShortcuts(JSON.parse(savedShortcuts));
    }
  }, []);

  // Register global shortcuts with Electron
  useEffect(() => {
    if (isElectron && window.electronAPI?.registerGlobalShortcuts) {
      const appSettings = JSON.parse(localStorage.getItem('focana-app-settings') || '{}');
      const shortcutsEnabled = appSettings.shortcutsEnabled ?? true;

      if (shortcutsEnabled) {
        window.electronAPI.registerGlobalShortcuts(shortcuts);

        // Listen for shortcut events
        window.electronAPI.onShortcut?.((shortcutAction) => {
          handleShortcutAction(shortcutAction);
        });
      }
    }
  }, [shortcuts, isElectron, handleShortcutAction]);

  // Load data from localStorage on mount
  useEffect(() => {
    loadSessions();
    const savedThoughts = localStorage.getItem('focana-thoughts');
    if (savedThoughts) setThoughts(JSON.parse(savedThoughts));

    const savedState = localStorage.getItem('focana-state');
    if (savedState) {
      const state = JSON.parse(savedState);
      setTask(state.task || '');
      setTime(state.time || 0);
      setMode(state.mode || 'freeflow');
      setInitialTime(state.initialTime || 0);
      setContextNotes(state.contextNotes || '');
      setIsIncognito(state.isIncognito || false);
      setIsTimerVisible(state.isTimerVisible || false);
    }

    // Load pulse settings
    const savedPulseSettings = localStorage.getItem('focana-pulse-settings');
    if (savedPulseSettings) {
      setPulseSettings(JSON.parse(savedPulseSettings));
    }
  }, [loadSessions]);

  // Save data to localStorage on change
  useEffect(() => {
    localStorage.setItem('focana-thoughts', JSON.stringify(thoughts));
    const stateToSave = {
      task,
      time,
      mode,
      initialTime,
      contextNotes,
      isIncognito,
      isTimerVisible
    };
    if (!isRunning) {
        localStorage.setItem('focana-state', JSON.stringify(stateToSave));
    }
  }, [thoughts, task, time, mode, initialTime, contextNotes, isIncognito, isTimerVisible, isRunning]);

  // Save pulse settings
  useEffect(() => {
    localStorage.setItem('focana-pulse-settings', JSON.stringify(pulseSettings));
  }, [pulseSettings]);

  // Save shortcuts
  useEffect(() => {
    localStorage.setItem('focana-shortcuts', JSON.stringify(shortcuts));
  }, [shortcuts]);

  // Time Awareness Pulse - every X minutes
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

      timeAwarenessRef.current = setInterval(checkTimeAwareness, 60000); // Check every minute

      return () => {
        if (timeAwarenessRef.current) {
          clearInterval(timeAwarenessRef.current);
        }
      };
    }
  }, [pulseSettings.timeAwarenessEnabled, pulseSettings.timeAwarenessInterval, lastTimeAwarenessCheck, triggerPulse]);

  // Celebration Pulse - at session milestones
  useEffect(() => {
    if (isRunning && pulseSettings.celebrationEnabled && sessionStartTime) {
      const checkMilestones = () => {
        const sessionDuration = mode === 'freeflow' ? time : (initialTime - time);
        const minutes = Math.floor(sessionDuration / 60);

        const milestones = [5, 15, 30, 45, 60, 90, 120];

        milestones.forEach(milestone => {
          if (minutes >= milestone && !celebratedMilestones.has(milestone)) {
            triggerPulse('celebration', 2);
            setCelebratedMilestones(prev => new Set([...prev, milestone]));
          }
        });
      };

      celebrationCheckRef.current = setInterval(checkMilestones, 10000); // Check every 10 seconds

      return () => {
        if (celebrationCheckRef.current) {
          clearInterval(celebrationCheckRef.current);
        }
      };
    }
  }, [isRunning, pulseSettings.celebrationEnabled, time, initialTime, mode, sessionStartTime, celebratedMilestones, triggerPulse]);

  // Timer logic
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTime(prevTime => {
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
  }, [isRunning, mode, initialTime, setShowNotesModal, setSessionStartTime, setCelebratedMilestones, setIsRunning]);

  // Electron IPC handlers
  const handleToggleAlwaysOnTop = () => {
    if (isElectron && window.electronAPI?.toggleAlwaysOnTop) {
      window.electronAPI.toggleAlwaysOnTop();
      setIsAlwaysOnTop(!isAlwaysOnTop);
    }
  };

  const handleCloseWindow = () => {
    if (isElectron && window.electronAPI?.closeWindow) {
      window.electronAPI.closeWindow();
    } else {
      // Fallback for web version
      window.close();
    }
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
    if (task.trim()) {
      setIsStartModalOpen(true);
    }
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
      await FocusSession.update(sessionId, { notes: newNotes });
      await loadSessions();

      if (previewSession && previewSession.id === sessionId) {
        setPreviewSession({...previewSession, notes: newNotes});
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
        await FocusSession.update(currentSessionId, { notes: newNotes });
        await loadSessions();
      } catch (error) {
        console.error('Error updating session notes:', error);
      }
    }
  };

  const addThought = (thoughtText) => setThoughts(prev => [...prev, { text: thoughtText, completed: false }]);
  const removeThought = (index) => setThoughts(prev => prev.filter((_, i) => i !== index));
  const toggleThought = (index) => {
    const newThoughts = [...thoughts];
    newThoughts[index].completed = !newThoughts[index].completed;
    setThoughts(newThoughts);
  };
  const clearCompletedThoughts = () => setThoughts(prev => prev.filter(t => !t.completed));

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getPulseClassName = () => {
    if (!isPulsing) return '';
    if (isPulsing === 'gentle') return 'animate-pulse-gentle';
    if (isPulsing === 'celebration') return 'animate-pulse-celebration';
    return '';
  };

  if (isIncognito) {
    return (
      <TooltipProvider>
        <div 
          className="min-h-screen p-4 font-sans overflow-hidden"
          style={{
            backgroundImage: 'url(https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68acdc8f59f7c70dec6ed153/f54685948_kristaps-ungurs-x8Oro9-tG64-unsplash.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          <style>
            {`
              @keyframes pulse-gentle {
                0%, 100% {
                  opacity: 1;
                  transform: scale(1);
                  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                }
                50% {
                  opacity: 0.4;
                  transform: scale(1.05);
                  box-shadow: 0 10px 15px -3px rgba(251, 146, 60, 0.3), 0 4px 6px -2px rgba(251, 146, 60, 0.05);
                }
              }

              @keyframes pulse-celebration {
                0%, 100% {
                  opacity: 1;
                  transform: scale(1);
                  filter: brightness(1);
                  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                }
                50% {
                  opacity: 1;
                  transform: scale(1.1);
                  filter: brightness(1.4);
                  box-shadow: 0 20px 25px -5px rgba(251, 146, 60, 0.4), 0 10px 10px -5px rgba(251, 146, 60, 0.1);
                }
              }

              @keyframes pulse-incognito {
                0%, 100% {
                  opacity: 0.7;
                  transform: scale(1);
                  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
                }
                50% {
                  opacity: 1;
                  transform: scale(1.03);
                  box-shadow: 0 4px 6px -1px rgba(251, 146, 60, 0.2), 0 2px 4px -1px rgba(251, 146, 60, 0.06);
                }
              }

              .animate-pulse-gentle {
                animation: pulse-gentle 1.2s ease-in-out;
              }

              .animate-pulse-celebration {
                animation: pulse-celebration 1s ease-in-out;
              }

              .animate-pulse-incognito {
                animation: pulse-incognito 3s ease-in-out infinite;
              }
            `}
          </style>
           <div
              ref={dragRef}
              onMouseDown={onMouseDown}
              className={`${isElectron ? 'electron-draggable' : ''}`}
              style={!isElectron ? {
                position: 'absolute',
                top: `${position.y}px`,
                left: `${position.x}px`,
                touchAction: 'none',
                cursor: 'grab'
              } : {}}
           >
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
                isElectron={isElectron}
                pulseEnabled={pulseSettings.incognitoEnabled}
              />
            </div>

          <DistractionJar isOpen={distractionJarOpen} onClose={() => setDistractionJarOpen(false)} thoughts={thoughts} onAddThought={addThought} onRemoveThought={removeThought} onToggleThought={toggleThought} onClearCompleted={clearCompletedThoughts} />

          <SessionNotesModal
            isOpen={showNotesModal}
            onClose={handleSkipSessionNotes}
            onSave={handleSaveSessionNotes}
            sessionDuration={sessionToSave.current?.duration || 0}
            taskName={task}
          />

          <TaskPreviewModal
            isOpen={showTaskPreview}
            onClose={() => setShowTaskPreview(false)}
            session={previewSession}
            onUseTask={handleUseTask}
            onUpdateNotes={handleUpdateTaskNotes}
          />
           <HistoryModal
              isOpen={showHistoryModal}
              onClose={() => setShowHistoryModal(false)}
              sessions={sessions}
              onUseTask={handleUseTask}
            />

          <QuickCaptureModal
            isOpen={showQuickCapture}
            onClose={() => setShowQuickCapture(false)}
            onSave={() => showToast('success', 'Saved to Notepad')}
          />

          <ToastNotification
            toast={toast}
            onDismiss={() => setToast(null)}
          />
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div 
        className="min-h-screen p-4 font-sans overflow-hidden"
        style={{
          backgroundImage: 'url(https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68acdc8f59f7c70dec6ed153/f54685948_kristaps-ungurs-x8Oro9-tG64-unsplash.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <style>
          {`
            @keyframes pulse-gentle {
              0%, 100% {
                opacity: 1;
                transform: scale(1);
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
              }
              50% {
                opacity: 0.4;
                transform: scale(1.05);
                box-shadow: 0 10px 15px -3px rgba(251, 146, 60, 0.3), 0 4px 6px -2px rgba(251, 146, 60, 0.05);
              }
            }

            @keyframes pulse-celebration {
              0%, 100% {
                opacity: 1;
                transform: scale(1);
                filter: brightness(1);
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
              }
              50% {
                opacity: 1;
                transform: scale(1.1);
                filter: brightness(1.4);
                box-shadow: 0 20px 25px -5px rgba(251, 146, 60, 0.4), 0 10px 10px -5px rgba(251, 146, 60, 0.1);
            }
            }

            .animate-pulse-gentle {
              animation: pulse-gentle 1.2s ease-in-out;
            }

            .animate-pulse-celebration {
              animation: pulse-celebration 1s ease-in-out;
            }
          `}
        </style>
        <div
          ref={dragRef}
          onMouseDown={onMouseDown}
          className={`w-full max-w-sm bg-[#FFFEF8]/90 backdrop-blur-sm rounded-2xl shadow-2xl shadow-amber-900/10 border border-[#8B6F47]/20 p-4 space-y-4 ${getPulseClassName()} ${isElectron ? 'electron-draggable' : ''}`}
          style={!isElectron ? {
            position: 'absolute',
            top: `${position.y}px`,
            left: `${position.x}px`,
            touchAction: 'none',
            cursor: 'grab'
          } : {}}
        >

          <div className={`flex items-center justify-between ${isElectron ? 'electron-no-drag' : ''}`}>
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-[#D97706]" />
              <h1 className="text-md font-bold text-[#5C4033]">Focana</h1>
            </div>
            <div className="flex items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => setShowSettings(true)} size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#8B6F47] hover:bg-[#FFF9E6]">
                    <Settings className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Settings & Shortcuts</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => setShowHistoryModal(true)} size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#8B6F47] hover:bg-[#FFF9E6]">
                    <History className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>View Session History</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => setDistractionJarOpen(true)} size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#8B6F47] hover:bg-[#FFF9E6] relative">
                     <ClipboardList className="w-5 h-5" />
                    {thoughts.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-[#F59E0B] text-white text-xs rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 font-medium">
                        {thoughts.length}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Open Notepad</p></TooltipContent>
              </Tooltip>
              {isElectron && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleToggleAlwaysOnTop}
                      size="icon"
                      variant="ghost"
                      className={`h-8 w-8 hover:bg-[#FFF9E6] ${isAlwaysOnTop ? 'text-[#D97706]' : 'text-[#8B6F47]'}`}
                    >
                      <Pin className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>{isAlwaysOnTop ? 'Disable' : 'Enable'} Always on Top</p></TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => setIsIncognito(true)} size="icon" variant="ghost" className="h-8 w-8 text-[#8B6F47] hover:bg-[#FFF9E6]">
                    <Minimize2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Compact Mode</p></TooltipContent>
              </Tooltip>
               <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleCloseWindow} size="icon" variant="ghost" className="h-8 w-8 text-[#8B6F47] hover:bg-[#FFF9E6]">
                    <X className="w-4 h-4" />
                  </Button>
                  </TooltipTrigger>
                <TooltipContent><p>Close Application</p></TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className={`flex flex-col items-center space-y-4 electron-no-drag`}>
            <CombinedTaskInput
              ref={taskInputRef}
              task={task}
              setTask={setTask}
              isActive={isNoteFocused || isRunning}
              onFocus={() => setIsNoteFocused(true)}
              onTaskSubmit={handleTaskSubmit}
            />

            {contextNotes && (
              <ContextBox
                notes={contextNotes}
                onUpdateNotes={handleUpdateContextNotes}
                onDismiss={() => setContextNotes('')}
                isSessionActive={isRunning}
              />
            )}

            {isTimerVisible && (
              <div className="flex items-center justify-center gap-4 w-full">
                <div className="flex-1 flex flex-col items-center">
                  <div className={`text-5xl font-bold transition-colors duration-300 ${isRunning ? 'text-[#D97706]' : 'text-[#8B6F47]'}`}>
                    {formatTime(time)}
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    {!isRunning ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button onClick={handlePlay} disabled={!task.trim()} size="icon" className="w-12 h-12 bg-[#F59E0B] hover:bg-[#D97706] text-white rounded-full"><Play className="w-6 h-6" /></Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Resume Timer</p></TooltipContent>
                        </Tooltip>
                    ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button onClick={handlePause} size="icon" className="w-12 h-12 bg-[#D97706] hover:bg-[#5C4033] text-white rounded-full"><Pause className="w-6 h-6" /></Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Pause Timer</p></TooltipContent>
                        </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button onClick={handleStop} disabled={!task.trim()} size="icon" variant="outline" className="w-12 h-12 border-[#8B6F47]/30 text-[#8B6F47] hover:bg-[#FFF9E6] rounded-full"><Square className="w-6 h-6" /></Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Stop & Save Session</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button onClick={handleClear} size="icon" variant="ghost" className="w-12 h-12 text-[#8B6F47] hover:bg-[#FFF9E6] rounded-full"><RotateCcw className="w-6 h-6" /></Button>
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

        <DistractionJar isOpen={distractionJarOpen} onClose={() => setDistractionJarOpen(false)} thoughts={thoughts} onAddThought={addThought} onRemoveThought={removeThought} onToggleThought={toggleThought} onClearCompleted={clearCompletedThoughts} />

        <SessionNotesModal
          isOpen={showNotesModal}
          onClose={handleSkipSessionNotes}
          onSave={handleSaveSessionNotes}
          sessionDuration={sessionToSave.current?.duration || 0}
          taskName={task}
        />

        <TaskPreviewModal
          isOpen={showTaskPreview}
          onClose={() => setShowTaskPreview(false)}
          session={previewSession}
          onUseTask={handleUseTask}
          onUpdateNotes={handleUpdateTaskNotes}
        />

        <HistoryModal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          sessions={sessions}
          onUseTask={handleUseTask}
        />

        <StartSessionModal
          isOpen={isStartModalOpen}
          onClose={() => setIsStartModalOpen(false)}
          task={task}
          onStart={handleStartSession}
        />

        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          shortcuts={shortcuts}
          onShortcutsChange={setShortcuts}
          pulseSettings={pulseSettings}
          onPulseSettingsChange={setPulseSettings}
        />

        <QuickCaptureModal
          isOpen={showQuickCapture}
          onClose={() => setShowQuickCapture(false)}
          onSave={() => showToast('success', 'Saved to Notepad')}
        />

        <ToastNotification
          toast={toast}
          onDismiss={() => setToast(null)}
        />
      </div>
    </TooltipProvider>
  );
}
