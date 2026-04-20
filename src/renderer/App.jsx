import React, { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import { Button } from './components/ui/Button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './components/ui/Dialog';
import { Tooltip, TooltipTrigger, TooltipContent } from './components/ui/Tooltip';
import {
  X, Play, Pause, Square, RotateCcw, Minimize2,
  Settings, ClipboardList, History, Sun, Moon, Check, Undo2, BellOff, Pin,
} from 'lucide-react';
import posthog from 'posthog-js';
import { SessionStore } from './adapters/store';
import { formatTime } from './utils/time';
import { track } from './utils/analytics';
import appLockupDark from '../assets/logo-lockup.svg';
import appLockupLight from '../assets/logo-lockup-light.svg';

import ParkingLot from './components/ParkingLot';
import SessionNotesModal from './components/SessionNotesModal';
import TimeUpModal from './components/TimeUpModal';
import TaskPreviewModal from './components/TaskPreviewModal';
import ContextBox from './components/ContextBox';
import CompactMode from './components/CompactMode';
import TaskInput from './components/TaskInput';
import FocusHeroCard from './components/FocusHeroCard';
import HistoryModal from './components/HistoryModal';
import SettingsModal from './components/SettingsModal';
import Toast from './components/Toast';
import QuickCaptureModal from './components/QuickCaptureModal';
import ConfettiBurst from './components/ConfettiBurst';
import CheckInPromptPopup from './components/CheckInPromptPopup';
import PostSessionParkingLotModal from './components/PostSessionParkingLotModal';
import ReentryPrompt from './components/ReentryPrompt';
import PostSessionPrompt from './components/PostSessionPrompt';

const DEFAULT_SHORTCUTS = {
  startPause: 'CommandOrControl+Shift+P',
  newTask: 'CommandOrControl+N',
  toggleCompact: 'CommandOrControl+Shift+I',
  completeTask: 'CommandOrControl+Enter',
  openParkingLot: 'CommandOrControl+Shift+N',
};
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
const shortcutsNeedRepair = (rawShortcuts, mergedShortcuts) => (
  Object.keys(DEFAULT_SHORTCUTS).some((key) => mergedShortcuts[key] !== rawShortcuts?.[key])
);

const THEME_STORAGE_KEY = 'focana-theme';
const WINDOW_SIZES = {
  baseWidth: 460,
  runningWidth: 432,
  idleHeight: 124,
  reentryPromptHeight: 348,
  startupCheckingHeight: 220,
  startupNameHeight: 380,
  startupActivationHeight: 460,
  startChooserHeight: 176,
  timerHeight: 108,
  timerCheckInPromptHeight: 280,
  timerCheckInDetourChoiceHeight: 260,
  timerCheckInDetourResolvedHeight: 276,
  timerCheckInResolvedHeight: 228,
  contextHeight: 428,
  timeUpHeight: 520,
  modal: {
    settings: [420, 580],
    history: [420, 500],
    taskPreview: [540, 640],
    parkingLot: [420, 500],
    postSessionParkingLot: [520, 560],
    postSessionPrompt: [560, 560],
    timeUp: [540, 460],
    notes: [440, 620],
    quickCapture: [420, 340],
  },
};
const TASK_CHARACTER_LIMIT = 96;
const clampTaskText = (value) => {
  if (typeof value !== 'string') return '';
  return value.slice(0, TASK_CHARACTER_LIMIT);
};
const isEditableShortcutTarget = (target) => {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = typeof target.tagName === 'string' ? target.tagName.toLowerCase() : '';
  return tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
};
const STARTUP_GATE_VERTICAL_PADDING = 32;
const CHECKIN_MESSAGES = [
  'Nice, keep going',
  'Good Job! 🍊',
  '🙂',
  'Great. You got this.',
  "You're doing good 👍🏾",
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
const TIMED_CHECKIN_PERCENTS = [0.4, 0.8];
const TIMED_COMPACT_PULSE_PERCENTS = [0.1, 0.2, 0.3, 0.5, 0.6, 0.7, 0.9];
const FREEFLOW_PULSE_INTERVAL_SECONDS = 5 * 60 + 3; // +3s offset to avoid check-in collision
const CHECKIN_PROMPT_COOLDOWN_MS = 30 * 1000;
const COMPACT_SUCCESS_CUE_MS = 800;
const SESSION_FEEDBACK_AUTO_ADVANCE_MS = 3000;
const SESSION_FEEDBACK_CONTINUE_DELAY_MS = 200;
const REENTRY_DELAY_MS = 5 * 60 * 1000;
const REENTRY_LOOP_MS = 30 * 1000;
const REENTRY_STRONG_MS = 6000;
const REENTRY_SNOOZE_MS = {
  '10m': 10 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '60m': 60 * 60 * 1000,
  '120m': 2 * 60 * 60 * 1000,
};
const POST_SESSION_BREAK_PRESETS = [5, 15, 25];
const PINNED_CONTROLS_DEFAULT = {
  alwaysOnTop: false,
  dnd: false,
  theme: false,
  parkingLot: true,
  history: true,
  restart: false,
  floatingMinimize: true,
};
const ENABLED_MAIN_CONTROLS_DEFAULT = {
  alwaysOnTop: true,
  dnd: true,
  theme: true,
  parkingLot: true,
  history: true,
  restart: true,
  floatingMinimize: true,
};

function normalizeToolbarControlMap(rawControls, defaults) {
  const source = rawControls && typeof rawControls === 'object' ? rawControls : {};
  const normalized = { ...defaults, ...source };
  if (typeof source.floatingMinimize !== 'boolean' && typeof source.close === 'boolean') {
    normalized.floatingMinimize = source.close;
  }
  delete normalized.close;
  return normalized;
}

function normalizePreferredName(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 80) : '';
}

function getFocusedCheckInMessages(preferredName) {
  const safeName = normalizePreferredName(preferredName);
  if (!safeName) return CHECKIN_MESSAGES;
  return [
    `Nice, ${safeName}. Keep going.`,
    `Good Job ${safeName} 🍊`,
    `${safeName}, you got this`,
    `You're doing good, ${safeName}`,
  ];
}

function getCompletedCheckInMessages(preferredName) {
  const safeName = normalizePreferredName(preferredName);
  if (!safeName) return CHECKIN_COMPLETED_MESSAGES;
  return [
    `Done, ${safeName}. What a win`,
    `Checked off, nice work, ${safeName}`,
    `That's a wrap, ${safeName}`,
  ];
}

function getLicenseGateCopy(status) {
  switch (status) {
    case 'config_error':
      return 'This packaged build is missing Lemon licensing config. Add the Focana Lemon store, product, and variant IDs before shipping it.';
    case 'invalid':
      return 'This key is no longer valid for Focana. Use the key from your Lemon receipt email, or contact support if you need help.';
    case 'error':
      return 'We could not validate your key right now. Try again when you are online, or contact support if this keeps happening.';
    default:
      return 'Paste the license key from your Lemon receipt email or Lemon My Orders to unlock Focana.';
  }
}

function createLocalFeedbackId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const buildTimedThresholds = (percents, totalSeconds) => {
  const safeTotal = Math.max(1, Number(totalSeconds) || 0);
  const normalizedPercents = percents
    .map((p) => Number(p))
    .filter((p) => Number.isFinite(p) && p > 0 && p < 1)
    .sort((a, b) => a - b);

  return Array.from(new Set(
    normalizedPercents
      .map((p) => Math.round(safeTotal * p))
      .filter((threshold) => threshold > 0 && threshold < safeTotal),
  ));
};

const getNextFreeflowPulseTarget = (elapsedSec) => (
  (Math.floor(Math.max(0, Number(elapsedSec) || 0) / FREEFLOW_PULSE_INTERVAL_SECONDS) + 1) * FREEFLOW_PULSE_INTERVAL_SECONDS
);

const findLatestResumableSession = (sessions = []) => (
  Array.isArray(sessions)
    ? sessions.find((session) => !session?.completed && Boolean(session?.kept)) || null
    : null
);

function getSessionRecap(session) {
  if (!session || typeof session !== 'object') return '';
  if (typeof session.recap === 'string') return session.recap;
  if (typeof session.notes === 'string') return session.notes;
  if (typeof session.contextNote === 'string') return session.contextNote;
  return '';
}

function getSessionNextSteps(session) {
  if (!session || typeof session !== 'object') return '';
  return typeof session.nextSteps === 'string' ? session.nextSteps : '';
}

function normalizeSplitNotes(rawNotes, fallback = {}) {
  const fallbackRecap = typeof fallback.recap === 'string' ? fallback.recap : '';
  const fallbackNextSteps = typeof fallback.nextSteps === 'string' ? fallback.nextSteps : '';

  if (rawNotes && typeof rawNotes === 'object' && !Array.isArray(rawNotes)) {
    return {
      recap: typeof rawNotes.recap === 'string' ? rawNotes.recap.trim() : fallbackRecap.trim(),
      nextSteps: typeof rawNotes.nextSteps === 'string' ? rawNotes.nextSteps.trim() : fallbackNextSteps.trim(),
    };
  }

  if (typeof rawNotes === 'string') {
    return {
      recap: rawNotes.trim(),
      nextSteps: fallbackNextSteps.trim(),
    };
  }

  return {
    recap: fallbackRecap.trim(),
    nextSteps: fallbackNextSteps.trim(),
  };
}

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
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true);
  const [sessionStateHydrated, setSessionStateHydrated] = useState(false);
  const [showTimerValidationModal, setShowTimerValidationModal] = useState(false);
  const [timerValidationMessage, setTimerValidationMessage] = useState('');
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
  const [showTimeUpModal, setShowTimeUpModal] = useState(false);
  const [sessionNotesMode, setSessionNotesMode] = useState('complete');
  const [contextNotes, setContextNotes] = useState('');
  const [nextStepsNotes, setNextStepsNotes] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState(null);

  // Task preview
  const [showTaskPreview, setShowTaskPreview] = useState(false);
  const [previewSession, setPreviewSession] = useState(null);
  const [previewUseTaskEnabled, setPreviewUseTaskEnabled] = useState(true);
  const [previewRestoreEnabled, setPreviewRestoreEnabled] = useState(false);
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
  const [pinnedControls, setPinnedControls] = useState(PINNED_CONTROLS_DEFAULT);
  const [enabledMainControls, setEnabledMainControls] = useState(ENABLED_MAIN_CONTROLS_DEFAULT);
  const [suppressToolbarTooltips, setSuppressToolbarTooltips] = useState(false);
  const [compactTransitioning, setCompactTransitioning] = useState(false);
  const [toast, setToast] = useState(null);
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [postSessionParkingLotSessionId, setPostSessionParkingLotSessionId] = useState(null);
  const [postSessionParkingLotHiddenIds, setPostSessionParkingLotHiddenIds] = useState([]);
  const [showPostSessionPrompt, setShowPostSessionPrompt] = useState(false);
  const [postSessionBreakMinutes, setPostSessionBreakMinutes] = useState(null);
  const [postSessionBreakHasSelection, setPostSessionBreakHasSelection] = useState(false);
  const [postSessionBreakShowTimer, setPostSessionBreakShowTimer] = useState(false);
  const [postSessionResumeCandidate, setPostSessionResumeCandidate] = useState(null);
  const [postSessionStartAssist, setPostSessionStartAssist] = useState(false);
  const [parkingLotTaskSwitchConfirm, setParkingLotTaskSwitchConfirm] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiBurstId, setConfettiBurstId] = useState(0);
  const [sessionFeedbackPrompt, setSessionFeedbackPrompt] = useState(null);
  const [startupGateState, setStartupGateState] = useState('checking'); // checking | activation | name | ready
  const [startupRevealComplete, setStartupRevealComplete] = useState(false);
  const [runtimeInfo, setRuntimeInfo] = useState(null);
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [licenseSubmitting, setLicenseSubmitting] = useState(false);
  const [preferredName, setPreferredName] = useState('');
  const [preferredNameInput, setPreferredNameInput] = useState('');
  const [preferredNameSubmitting, setPreferredNameSubmitting] = useState(false);
  const [preferredNameError, setPreferredNameError] = useState('');
  const [dndEnabled, setDndEnabled] = useState(false);
  const [checkInSettings, setCheckInSettings] = useState({
    enabled: true,
    intervalFreeflow: 15,
    timedPercents: TIMED_CHECKIN_PERCENTS,
  });
  const [updateState, setUpdateState] = useState({
    supported: false,
    currentVersion: null,
    channel: 'latest',
    provider: 'github',
    status: 'unsupported',
    availableVersion: null,
    releaseName: null,
    releaseNotes: null,
    releaseDate: null,
    downloadPercent: null,
    lastCheckedAt: null,
    lastCheckSource: null,
    error: null,
  });
  const [checkInState, setCheckInState] = useState('idle'); // idle | prompting | detour-choice | detour-resolved | resolved
  const [checkInMessage, setCheckInMessage] = useState('');
  const [checkInCelebrating, setCheckInCelebrating] = useState(false);
  const [checkInCelebrationType, setCheckInCelebrationType] = useState('none'); // none | focused | completed
  const [reentryAttentionVisible, setReentryAttentionVisible] = useState(false);
  const [reentryStrongActive, setReentryStrongActive] = useState(false);
  const [reentrySurfaceStage, setReentrySurfaceStage] = useState('task-entry');
  const [reentrySurfaceTaskText, setReentrySurfaceTaskText] = useState('');
  const [reentrySurfaceMinutes, setReentrySurfaceMinutes] = useState('25');
  const hasSavedContext = Boolean(contextNotes.trim() || nextStepsNotes.trim());

  // Pulse
  const [pulseSettings, setPulseSettings] = useState({
    compactEnabled: true,
  });
  const [isPulsing, setIsPulsing] = useState(false);
  const [compactPulseSignal, setCompactPulseSignal] = useState(0);
  const [compactSuccessCueSignal, setCompactSuccessCueSignal] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const lastNonEmptyTaskRef = useRef('');
  const prevDndEnabledRef = useRef(false);

  useEffect(() => {
    const trimmedTask = task.trim();
    if (trimmedTask) {
      lastNonEmptyTaskRef.current = task;
    } else if (!isRunning && !isTimerVisible) {
      lastNonEmptyTaskRef.current = '';
    }
  }, [task, isRunning, isTimerVisible]);

  const timerRef = useRef(null);
  const sessionToSave = useRef(null);
  const taskInputRef = useRef(null);
  const sessionMinutesInputRef = useRef(null);
  const mainCardRef = useRef(null);
  const startupGateCardRef = useRef(null);
  const thoughtsLoadedRef = useRef(false);
  const confettiTimerRef = useRef(null);
  const pulseIntervalRef = useRef(null);
  const pulseTimeoutRef = useRef(null);
  const compactSuccessReturnTimerRef = useRef(null);
  const themeSettingsHydratedRef = useRef(false);
  const timeRef = useRef(0);
  const elapsedBeforeRunRef = useRef(0);
  const parkingLotReturnToCompactRef = useRef(false);
  const parkingLotReturnToFloatingRef = useRef(false);
  const historyReturnToCompactRef = useRef(false);
  const settingsReturnToCompactRef = useRef(false);
  const postSessionNotesActionRef = useRef(null); // 'resume-later' | 'move-on' | null
  const checkInReturnToCompactRef = useRef(false);
  const checkInReturnToFloatingRef = useRef(false);
  const checkInPromptSurfaceRef = useRef('full');
  const pendingCompactCheckInPromptRef = useRef(false);
  const stopFlowResumeStateRef = useRef({
    canResume: false,
    returnToCompact: false,
    returnToFloating: false,
  });
  const checkInResolveTimeoutRef = useRef(null);
  const checkInFreeflowNextRef = useRef(null);
  const checkInTimedThresholdsRef = useRef([]);
  const checkInTimedIndexRef = useRef(0);
  const checkInTimedPendingIndexRef = useRef(null);
  const timedCheckInLastElapsedRef = useRef(0);
  const timedCheckInLastSegmentElapsedRef = useRef(0);
  const freeflowPulseNextRef = useRef(null);
  const compactPulseThresholdsRef = useRef([]);
  const compactPulseIndexRef = useRef(0);
  const timedPulseLastElapsedRef = useRef(0);
  const timedPulseLastSegmentElapsedRef = useRef(0);
  const timedCueSegmentStartElapsedRef = useRef(0);
  const timedCueSegmentDurationRef = useRef(0);
  const checkInForcedNextRef = useRef(null);
  const checkInShortIntervalRef = useRef(false);
  const checkInPromptCooldownUntilRef = useRef(0);
  const checkInStateRef = useRef('idle');
  const compactEnteredAtRef = useRef(null);
  const historyResumeCarryoverSecondsRef = useRef(0);
  const postSessionParkingLotReturnToCompactRef = useRef(false);
  const postSessionParkingLotReturnToFloatingRef = useRef(false);
  const timeUpReturnToCompactRef = useRef(false);
  const timeUpReturnToFloatingRef = useRef(false);
  const timeUpTriggerKeyRef = useRef('');
  const sessionFeedbackFlowRef = useRef({ id: 0, captured: false });
  const sessionFeedbackPendingActionRef = useRef(null);
  const lastInteractionTimeRef = useRef(Date.now());
  const isRunningRef = useRef(false);
  const sessionCreatePromiseRef = useRef(null);
  const sessionCreateEpochRef = useRef(0);
  const getElapsedSecondsRef = useRef(() => 0);
  const resetCheckInScheduleRef = useRef(() => {});
  const resetCompactPulseScheduleRef = useRef(() => {});
  const triggerCheckInPromptRef = useRef(async () => false);
  const ensureCurrentSessionIdRef = useRef(async () => null);
  const handleClearRef = useRef(() => {});
  const suppressToolbarTooltipTimerRef = useRef(null);
  const pendingCompactExitHeightRef = useRef(null);
  const didJustExitCompactRef = useRef(false);
  const startupWindowShownRef = useRef(false);
  const startupWindowShowPendingRef = useRef(false);
  const compactRevealTimerRef = useRef(null);
  const pendingCompactRestoreRef = useRef(false);
  const compactPrevTimerVisibleRef = useRef(null);
  const wasCompactRef = useRef(false);
  const hasTrackedAppOpenedRef = useRef(false);
  const suppressHistoryPopRef = useRef(false);
  const pendingParkingLotTaskSwitchRef = useRef(null);
  const reentryAttentionVisibleRef = useRef(false);
  const reentryEligibleSinceRef = useRef(null);
  const reentryNextCueAtRef = useRef(null);
  const reentryRemainingMsRef = useRef(null);
  const reentrySnoozeUntilRef = useRef(0);
  const reentrySnoozeUntilReopenRef = useRef(false);
  const postSessionBreakUntilRef = useRef(0);
  const postSessionBreakPromptPendingRef = useRef(false);
  const reentryStrongTimeoutRef = useRef(null);
  const reentryStrongActiveRef = useRef(false);
  const reentryPromptKeyRef = useRef(0);
  const reentryFloatingPromptOpenRef = useRef(false);
  const reentryFloatingPromptSentRef = useRef('');
  const reentryResumeCandidateRef = useRef(null);
  const reentrySurfaceSignatureRef = useRef('');
  const reentryStartNewAfterResolveRef = useRef(false);
  const prepareTaskForStartChooserRef = useRef(() => false);
  const windowModeDesiredRef = useRef('full');
  const windowModeActualRef = useRef('full');
  const windowModeSyncingRef = useRef(false);
  const backgroundLicenseValidationRef = useRef(null);
  const taskInputResizeTimerRef = useRef(null);
  const handleTaskChange = useCallback((nextValue) => {
    const normalizedValue = clampTaskText(nextValue);
    setTask(normalizedValue);
    setPostSessionStartAssist(false);

    if (
      postSessionResumeCandidate?.taskText
      && normalizedValue.trim()
      && normalizedValue.trim() !== postSessionResumeCandidate.taskText.trim()
    ) {
      setPostSessionResumeCandidate(null);
    }
  }, [postSessionResumeCandidate]);
  const fullWindowTargetWidthRef = useRef(WINDOW_SIZES.baseWidth);
  fullWindowTargetWidthRef.current = isRunning ? WINDOW_SIZES.runningWidth : WINDOW_SIZES.baseWidth;

  const pushModal = useCallback((modalName) => {
    modalStackRef.current.push(modalName);
  }, []);

  const popAndOpenPrevModal = useCallback(() => {
    const prev = modalStackRef.current.pop();
    if (prev) {
      const openers = {
        settings: () => setShowSettings(true),
        history: () => setShowHistoryModal(true),
        parkingLot: () => setDistractionJarOpen(true),
        taskPreview: () => setShowTaskPreview(true),
      };
      openers[prev]?.();
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    const onResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!isStartModalOpen) return undefined;

    const focusTimer = window.setTimeout(() => {
      sessionMinutesInputRef.current?.focus();
      sessionMinutesInputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [isStartModalOpen]);

  const focusSessionMinutesInput = useCallback(() => {
    window.setTimeout(() => {
      sessionMinutesInputRef.current?.focus();
      sessionMinutesInputRef.current?.select();
    }, 0);
  }, []);

  const openTimerValidationModal = useCallback((message) => {
    setTimerValidationMessage(message);
    setShowTimerValidationModal(true);
  }, []);

  const closeTimerValidationModal = useCallback(() => {
    setShowTimerValidationModal(false);
    focusSessionMinutesInput();
  }, [focusSessionMinutesInput]);


  // Analytics: app opened
  useEffect(() => {
    if (startupGateState !== 'ready') return undefined;
    if (!startupRevealComplete) return undefined;
    if (hasTrackedAppOpenedRef.current) return undefined;
    hasTrackedAppOpenedRef.current = true;

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
  }, [startupGateState, startupRevealComplete]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (isThemeManual) {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } else {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    }
  }, [theme, isThemeManual]);

  useEffect(() => {
    if (!themeSettingsHydratedRef.current) return;
    window.electronAPI.storeSet('settings.theme', theme);
    window.electronAPI.storeSet('settings.themeManual', isThemeManual);
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
  reentryAttentionVisibleRef.current = reentryAttentionVisible;
  reentryStrongActiveRef.current = reentryStrongActive;

  useEffect(() => {
    return () => {
      if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
      if (pulseIntervalRef.current) clearInterval(pulseIntervalRef.current);
      if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
      if (checkInResolveTimeoutRef.current) clearTimeout(checkInResolveTimeoutRef.current);
      if (compactSuccessReturnTimerRef.current) clearTimeout(compactSuccessReturnTimerRef.current);
      if (suppressToolbarTooltipTimerRef.current) clearTimeout(suppressToolbarTooltipTimerRef.current);
      if (compactRevealTimerRef.current) clearTimeout(compactRevealTimerRef.current);
      if (reentryStrongTimeoutRef.current) clearTimeout(reentryStrongTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (showNotesModal) {
      setSessionNotesFlowKey((prev) => prev + 1);
    }
  }, [showNotesModal]);

  // Helpers
  const showToast = useCallback((type, message, duration = 2000, options = {}) => {
    setToast({ type, message, duration, ...options });
  }, []);

  const showCompletedSessionMessage = useCallback(() => {
    const completedMessages = getCompletedCheckInMessages(preferredName);
    const completedMessage = completedMessages[Math.floor(Math.random() * completedMessages.length)];
    showToast('success', completedMessage, 2000, {
      showIcon: false,
      showCloseButton: false,
      placement: 'window-center',
      source: 'checkin-success',
      zIndex: 180,
    });
    return completedMessage;
  }, [preferredName, showToast]);

  const handleCheckForUpdates = useCallback(async () => {
    try {
      const nextState = await window.electronAPI.checkForAppUpdates?.();
      if (nextState) {
        setUpdateState(nextState);
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      showToast('warning', 'Could not check for updates');
    }
  }, [showToast]);

  const handleInstallUpdate = useCallback(async () => {
    try {
      const startedInstall = await window.electronAPI.installAppUpdate?.();
      if (!startedInstall) {
        showToast('info', 'No downloaded update is ready yet.');
      }
    } catch (error) {
      console.error('Error installing update:', error);
      showToast('warning', 'Could not install update');
    }
  }, [showToast]);

  useEffect(() => {
    let disposed = false;

    void (async () => {
      try {
        const nextState = await window.electronAPI.getUpdateState?.();
        if (!disposed && nextState) {
          setUpdateState(nextState);
        }
      } catch (error) {
        console.warn('Failed to read updater state:', error);
      }
    })();

    const cleanup = window.electronAPI.onUpdateStateChange?.((nextState) => {
      if (!disposed && nextState) {
        setUpdateState(nextState);
      }
    });

    return () => {
      disposed = true;
      if (cleanup) cleanup();
    };
  }, []);

  const showCenteredFullWindowCheckInToast = !isCompact
    && toast?.source === 'checkin-success'
    && toast?.placement === 'window-center';
  const showUpdateBanner = updateState.status === 'downloaded' && Boolean(updateState.availableVersion);

  const buildThoughtRecord = useCallback((text, sessionId = null) => ({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    text,
    completed: false,
    createdAt: new Date().toISOString(),
    sessionId,
  }), []);

  const syncDoNotDisturb = useCallback((enabled) => {
    const nextEnabled = Boolean(enabled);
    setDndEnabled(nextEnabled);
  }, []);

  const setDoNotDisturb = useCallback((enabled, source = 'unknown') => {
    const nextEnabled = Boolean(enabled);
    setDndEnabled(nextEnabled);
    window.electronAPI.setDnd?.(nextEnabled);
    track('dnd_toggled', { enabled: nextEnabled, source });
  }, []);

  const identifyPosthogInstall = useCallback((distinctId, extraProps = {}) => {
    const normalizedId = typeof distinctId === 'string' ? distinctId.trim() : '';
    if (!normalizedId) return;
    try {
      if (typeof posthog?.identify === 'function') {
        posthog.identify(normalizedId);
      }
      if (typeof posthog?.people?.set === 'function') {
        posthog.people.set(extraProps);
      }
    } catch (error) {
      console.warn('PostHog install identify failed:', error);
    }
  }, []);

  const syncDisplayedTime = useCallback((elapsedSeconds, nextMode = mode, nextInitialTime = initialTime) => {
    const safeElapsed = Math.max(0, Math.floor(Number(elapsedSeconds) || 0));
    const nextTime = nextMode === 'freeflow'
      ? safeElapsed
      : Math.max(0, Math.max(0, Number(nextInitialTime) || 0) - safeElapsed);

    setTime((prev) => (prev === nextTime ? prev : nextTime));
    return nextTime;
  }, [mode, initialTime]);

  const getElapsedSeconds = useCallback((atMs = Date.now()) => {
    const safeBase = Math.max(0, Math.floor(Number(elapsedBeforeRunRef.current) || 0));
    if (!isRunning || !sessionStartTime) {
      return safeBase;
    }

    const liveDelta = Math.max(0, Math.floor((atMs - sessionStartTime) / 1000));
    return safeBase + liveDelta;
  }, [isRunning, sessionStartTime]);

  const latestResumableSession = useMemo(
    () => findLatestResumableSession(sessions),
    [sessions],
  );

  const reentryResumeCandidate = useMemo(() => {
    if (postSessionResumeCandidate?.taskText && !isRunning && !isTimerVisible) {
      return {
        ...postSessionResumeCandidate,
        recap: typeof postSessionResumeCandidate.recap === 'string' ? postSessionResumeCandidate.recap : '',
        nextSteps: typeof postSessionResumeCandidate.nextSteps === 'string' ? postSessionResumeCandidate.nextSteps : '',
        notes: typeof postSessionResumeCandidate.recap === 'string' ? postSessionResumeCandidate.recap : '',
      };
    }

    const trimmedTask = task.trim();
    if (isTimerVisible && !isRunning && trimmedTask) {
      const carryoverSeconds = Math.max(0, Math.floor(Number(getElapsedSeconds()) || 0));
      return {
        source: 'paused-current',
        taskText: trimmedTask,
        recap: contextNotes || '',
        nextSteps: nextStepsNotes || '',
        notes: contextNotes || '',
        sessionId: currentSessionId,
        mode,
        carryoverSeconds,
      };
    }

    if (!latestResumableSession || isRunning || isTimerVisible || !trimmedTask) {
      return null;
    }

    const latestTask = typeof latestResumableSession.task === 'string'
      ? latestResumableSession.task.trim()
      : '';

    if (!latestTask || latestTask !== trimmedTask) {
      return null;
    }

    return {
      source: 'resume-later-loaded',
      taskText: latestResumableSession.task,
      recap: getSessionRecap(latestResumableSession) || contextNotes || '',
      nextSteps: getSessionNextSteps(latestResumableSession) || nextStepsNotes || '',
      notes: getSessionRecap(latestResumableSession) || contextNotes || '',
      sessionId: latestResumableSession.id || null,
      mode: latestResumableSession.mode === 'timed' ? 'timed' : 'freeflow',
      carryoverSeconds: Math.max(0, Math.round((Number(latestResumableSession.durationMinutes) || 0) * 60)),
    };
  }, [contextNotes, currentSessionId, getElapsedSeconds, isRunning, isTimerVisible, latestResumableSession, mode, nextStepsNotes, postSessionResumeCandidate, task]);

  const getDefaultReentryMinutes = useCallback(() => {
    const parsed = Number.parseInt(String(sessionMinutes || '').trim(), 10);
    return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 240) : 25;
  }, [sessionMinutes]);

  const reentryPromptKind = reentryResumeCandidate ? 'resume-choice' : 'start';
  const showSurfaceReentryPrompt = reentryAttentionVisible
    && startupGateState === 'ready'
    && !isStartModalOpen
    && !isRunning
    && !isTimerVisible;

  useEffect(() => {
    if (!showSurfaceReentryPrompt) {
      reentrySurfaceSignatureRef.current = '';
      return;
    }

    const signature = `${reentryPromptKind}:${reentryResumeCandidate?.sessionId || reentryResumeCandidate?.taskText || 'draft'}`;
    if (reentrySurfaceSignatureRef.current === signature) return;
    reentrySurfaceSignatureRef.current = signature;

    setReentrySurfaceStage(reentryPromptKind === 'resume-choice' ? 'resume-choice' : 'task-entry');
    setReentrySurfaceTaskText(
      clampTaskText(reentryPromptKind === 'resume-choice'
        ? (reentryResumeCandidate?.taskText || task)
        : task),
    );
    setReentrySurfaceMinutes(String(getDefaultReentryMinutes()));
  }, [
    getDefaultReentryMinutes,
    reentryPromptKind,
    reentryResumeCandidate,
    showSurfaceReentryPrompt,
    task,
  ]);

  const pauseActiveTimer = useCallback(() => {
    const elapsedSeconds = getElapsedSeconds();
    elapsedBeforeRunRef.current = elapsedSeconds;
    syncDisplayedTime(elapsedSeconds);
    setSessionStartTime(null);
    setIsRunning(false);
    return elapsedSeconds;
  }, [getElapsedSeconds, syncDisplayedTime]);

  const resumeActiveTimer = useCallback((source = 'unknown') => {
    const resumedAt = Date.now();
    setSessionStartTime(resumedAt);
    setIsRunning(true);
    if (!currentSessionId) {
      void ensureCurrentSessionIdRef.current(source);
    }
    resetCheckInScheduleRef.current(mode, initialTime, elapsedBeforeRunRef.current);
    resetCompactPulseScheduleRef.current(mode, initialTime, elapsedBeforeRunRef.current);
  }, [currentSessionId, initialTime, mode]);

  const resolveStartupReadyState = useCallback(async () => {
    const storedPreferredName = normalizePreferredName(
      await window.electronAPI.storeGet('preferredName')
    );
    setPreferredName(storedPreferredName);
    setPreferredNameInput((prev) => prev || storedPreferredName);
    setPreferredNameError('');
    setStartupGateState(storedPreferredName ? 'ready' : 'name');
    return storedPreferredName;
  }, []);

  useEffect(() => {
    let isCancelled = false;
    let nextRuntime = null;

    (async () => {
      try {
        nextRuntime = await window.electronAPI.getRuntimeInfo?.();
        if (isCancelled) return;

        setRuntimeInfo(nextRuntime || null);

        let nextLicenseStatus = await window.electronAPI.getLicenseStatus?.();
        if (isCancelled) return;

        if (nextRuntime?.licenseEnforced) {
          if (nextLicenseStatus?.shouldValidateInForeground) {
            nextLicenseStatus = await window.electronAPI.validateLicense?.({ force: true });
            if (isCancelled) return;
          }

          setLicenseStatus(nextLicenseStatus || null);

          if (nextLicenseStatus?.allowed) {
            identifyPosthogInstall(
              nextLicenseStatus.instanceId || nextLicenseStatus.installId,
              {
                channel: nextRuntime.channel,
                license_status: nextLicenseStatus.status,
              },
            );
            const storedPreferredName = normalizePreferredName(
              await window.electronAPI.storeGet('preferredName')
            );
            if (isCancelled) return;
            setPreferredName(storedPreferredName);
            setPreferredNameInput(storedPreferredName);
            setStartupGateState(storedPreferredName ? 'ready' : 'name');
          } else {
            setStartupGateState('activation');
          }
          return;
        }

        setLicenseStatus(nextLicenseStatus || null);
        identifyPosthogInstall(
          nextLicenseStatus?.instanceId || nextLicenseStatus?.installId,
          {
            channel: nextRuntime?.channel || 'dev',
            license_status: nextLicenseStatus?.status || 'not_required',
          },
        );
        const storedPreferredName = normalizePreferredName(
          await window.electronAPI.storeGet('preferredName')
        );
        if (!isCancelled) {
          setPreferredName(storedPreferredName);
          setPreferredNameInput(storedPreferredName);
          setStartupGateState(storedPreferredName ? 'ready' : 'name');
        }
      } catch (error) {
        console.error('Failed to initialize startup gate:', error);
        if (!isCancelled) {
          setLicenseStatus((prev) => ({
            ...(prev || {}),
            status: 'error',
            lastError: 'Focana could not initialize its startup gate.',
          }));
          setStartupGateState(nextRuntime?.licenseEnforced ? 'activation' : 'ready');
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [identifyPosthogInstall]);

  const refreshLicenseStatus = useCallback(async () => {
    const nextStatus = await window.electronAPI.getLicenseStatus?.();
    if (!nextStatus) return null;

    setLicenseStatus(nextStatus);
    if (nextStatus.allowed) {
      identifyPosthogInstall(
        nextStatus.instanceId || nextStatus.installId,
        {
          channel: runtimeInfo?.channel || 'latest',
          license_status: nextStatus.status,
        },
      );
      await resolveStartupReadyState();
    } else if (runtimeInfo?.licenseEnforced) {
      setStartupGateState('activation');
    }
    return nextStatus;
  }, [identifyPosthogInstall, resolveStartupReadyState, runtimeInfo?.channel, runtimeInfo?.licenseEnforced]);

  const handleLicenseActivation = useCallback(async () => {
    if (licenseSubmitting) return;

    const normalizedKey = licenseKeyInput.trim();
    if (!normalizedKey) return;

    setLicenseSubmitting(true);
    try {
      const nextStatus = await window.electronAPI.activateLicense?.(normalizedKey);
      if (!nextStatus) return;

      setLicenseStatus(nextStatus);
      if (nextStatus.allowed) {
        identifyPosthogInstall(
          nextStatus.instanceId || nextStatus.installId,
          {
            channel: runtimeInfo?.channel || 'latest',
            license_status: nextStatus.status,
          },
        );
        setLicenseKeyInput('');
        await resolveStartupReadyState();
        showToast('success', 'License activated for this Mac');
      } else {
        showToast('warning', nextStatus.lastError || getLicenseGateCopy(nextStatus.status));
      }
    } catch (error) {
      console.error('Failed to activate license:', error);
      showToast('warning', 'Could not reach Lemon to activate this key.');
      setLicenseStatus((prev) => ({
        ...(prev || {}),
        status: 'error',
        lastError: 'Could not reach Lemon to activate this key.',
      }));
    } finally {
      setLicenseSubmitting(false);
    }
  }, [identifyPosthogInstall, licenseKeyInput, licenseSubmitting, resolveStartupReadyState, runtimeInfo?.channel, showToast]);

  const handleValidateLicenseNow = useCallback(async () => {
    try {
      const nextStatus = await window.electronAPI.validateLicense?.({ force: true });
      if (!nextStatus) return null;

      setLicenseStatus(nextStatus);
      if (nextStatus.allowed) {
        identifyPosthogInstall(
          nextStatus.instanceId || nextStatus.installId,
          {
            channel: runtimeInfo?.channel || 'latest',
            license_status: nextStatus.status,
          },
        );
        showToast(nextStatus.status === 'offline_grace' ? 'warning' : 'success', nextStatus.status === 'offline_grace'
          ? 'License check failed, but this Mac is still within offline grace.'
          : 'License verified for this Mac.');
        if (startupGateState === 'name') {
          setPreferredNameInput((prev) => prev || preferredName);
        }
      } else if (runtimeInfo?.licenseEnforced) {
        setStartupGateState('activation');
        showToast('warning', nextStatus.lastError || 'This Mac needs a valid Focana license.');
      }

      return nextStatus;
    } catch (error) {
      console.error('Failed to validate license:', error);
      showToast('warning', 'Could not validate this license right now.');
      return null;
    }
  }, [identifyPosthogInstall, preferredName, runtimeInfo?.channel, runtimeInfo?.licenseEnforced, showToast, startupGateState]);

  const handleDeactivateLicense = useCallback(async () => {
    try {
      const nextStatus = await window.electronAPI.deactivateLicense?.();
      if (!nextStatus) return null;

      setLicenseStatus(nextStatus);
      if (runtimeInfo?.licenseEnforced) {
        setShowSettings(false);
        setStartupGateState('activation');
        setLicenseKeyInput('');
      }
      showToast('info', 'License removed from this Mac.');
      return nextStatus;
    } catch (error) {
      console.error('Failed to deactivate license:', error);
      showToast('warning', 'Could not deactivate this Mac right now.');
      return null;
    }
  }, [runtimeInfo?.licenseEnforced, showToast]);

  const handlePreferredNameSubmit = useCallback(async () => {
    if (preferredNameSubmitting) return;

    const normalizedPreferredName = normalizePreferredName(preferredNameInput);
    if (!normalizedPreferredName) {
      setPreferredNameError('Enter the name you want Focana to use.');
      return;
    }

    setPreferredNameSubmitting(true);
    setPreferredNameError('');

    try {
      const result = await window.electronAPI.savePreferredName?.(normalizedPreferredName);
      const savedPreferredName = normalizePreferredName(result?.preferredName || normalizedPreferredName);
      setPreferredName(savedPreferredName);
      setPreferredNameInput(savedPreferredName);
      setStartupGateState('ready');
      showToast('success', `Nice to meet you, ${savedPreferredName}.`);
    } catch (error) {
      console.error('Failed to save preferred name:', error);
      setPreferredNameError('Could not save your name right now. Please try again.');
    } finally {
      setPreferredNameSubmitting(false);
    }
  }, [preferredNameInput, preferredNameSubmitting, showToast]);

  useEffect(() => {
    if (startupGateState !== 'ready') return undefined;
    if (!runtimeInfo?.licenseEnforced) return undefined;
    if (!licenseStatus?.keyPresent || !licenseStatus?.instanceId) return undefined;
    if (!licenseStatus?.validationDue) return undefined;
    if (backgroundLicenseValidationRef.current === licenseStatus.instanceId) return undefined;

    backgroundLicenseValidationRef.current = licenseStatus.instanceId;
    let cancelled = false;

    window.setTimeout(() => {
      void (async () => {
        try {
          const nextStatus = await window.electronAPI.validateLicense?.();
          if (cancelled || !nextStatus) return;

          setLicenseStatus(nextStatus);
          if (!nextStatus.allowed) {
            setStartupGateState('activation');
          }
        } catch (error) {
          console.warn('Background license validation failed:', error);
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
    };
  }, [licenseStatus?.instanceId, licenseStatus?.keyPresent, licenseStatus?.validationDue, runtimeInfo?.licenseEnforced, startupGateState]);


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

  const patchSessionInLocalState = useCallback((sessionId, patch) => {
    if (!sessionId || !patch || typeof patch !== 'object') return;
    setSessions((prev) => prev.map((session) => (
      session?.id === sessionId ? { ...session, ...patch } : session
    )));
    setPreviewSession((prev) => (
      prev?.id === sessionId ? { ...prev, ...patch } : prev
    ));
  }, []);

  const invalidatePendingSessionCreation = useCallback(() => {
    sessionCreateEpochRef.current += 1;
    sessionCreatePromiseRef.current = null;
  }, []);

  const ensureCurrentSessionId = useCallback(async (source = 'unknown') => {
    if (currentSessionId) return currentSessionId;
    const trimmedTask = task.trim();
    if (!trimmedTask) return null;

    if (sessionCreatePromiseRef.current) {
      return sessionCreatePromiseRef.current;
    }

    const epochAtStart = sessionCreateEpochRef.current;
    sessionCreatePromiseRef.current = (async () => {
      try {
        const created = await SessionStore.create({
          task: trimmedTask,
          duration_minutes: 0,
          mode,
          completed: false,
          notes: contextNotes || '',
          recap: contextNotes || '',
          nextSteps: nextStepsNotes || '',
        });
        const nextSessionId = created?.id || null;
        if (sessionCreateEpochRef.current !== epochAtStart) {
          return null;
        }
        if (nextSessionId) {
          setCurrentSessionId(nextSessionId);
          await loadSessions();
        }
        return nextSessionId;
      } catch (error) {
        console.error(`Error creating session (${source}):`, error);
        return null;
      } finally {
        if (sessionCreateEpochRef.current === epochAtStart) {
          sessionCreatePromiseRef.current = null;
        }
      }
    })();

    return sessionCreatePromiseRef.current;
  }, [currentSessionId, task, mode, contextNotes, loadSessions, nextStepsNotes]);

  useEffect(() => {
    ensureCurrentSessionIdRef.current = ensureCurrentSessionId;
  }, [ensureCurrentSessionId]);

  const getActiveThoughtSessionId = useCallback(async () => {
    if (currentSessionId) return currentSessionId;
    if (!task.trim()) return null;
    if (!isTimerVisible && !isRunning) return null;
    return ensureCurrentSessionId('parking lot capture');
  }, [currentSessionId, task, isTimerVisible, isRunning, ensureCurrentSessionId]);

  const saveSessionWithNotes = useCallback(async (notes) => {
    if (!task.trim() || !sessionToSave.current) return;

    const splitNotes = normalizeSplitNotes(notes, {
      recap: contextNotes,
      nextSteps: nextStepsNotes,
    });

    const { duration, completed, kept } = sessionToSave.current;
    const activeSessionId = currentSessionId || sessionToSave.current?.sessionId || null;
    let savedSessionId = activeSessionId;

    try {
      if (duration > 0.1) {
        if (activeSessionId) {
          await SessionStore.update(activeSessionId, {
            task: task.trim(),
            durationMinutes: duration,
            mode,
            completed,
            kept: kept || false,
            notes: splitNotes.recap,
            recap: splitNotes.recap,
            nextSteps: splitNotes.nextSteps,
          });
        } else {
          const created = await SessionStore.create({
            task: task.trim(),
            duration_minutes: duration,
            mode,
            completed,
            kept: kept || false,
            notes: splitNotes.recap,
            recap: splitNotes.recap,
            nextSteps: splitNotes.nextSteps,
          });
          savedSessionId = created?.id || null;
        }
      } else if (activeSessionId) {
        if (kept) {
          // If the user explicitly chose to keep/resume the session later,
          // preserve the shell session record even when it was very short.
          await SessionStore.update(activeSessionId, {
            task: task.trim(),
            durationMinutes: 0,
            mode,
            completed,
            kept: true,
            notes: splitNotes.recap,
            recap: splitNotes.recap,
            nextSteps: splitNotes.nextSteps,
          });
        } else {
          // Preserve existing behavior for discarded/completed very short sessions.
          await SessionStore.delete(activeSessionId);
          savedSessionId = null;
        }
      }

      await loadSessions();
    } catch (error) {
      console.error('Error saving session:', error);
    }

    sessionToSave.current = null;
    setCurrentSessionId(null);
    return savedSessionId;
  }, [contextNotes, currentSessionId, loadSessions, mode, nextStepsNotes, task]);

  const checkpointActiveSession = useCallback(async (source = 'unknown') => {
    const trimmedTask = task.trim();
    if (!trimmedTask) return null;

    const sessionId = currentSessionId || await ensureCurrentSessionId(`checkpoint:${source}`);
    if (!sessionId) return null;

    const durationMinutes = Number((getElapsedSeconds() / 60).toFixed(2));
    const patch = {
      task: trimmedTask,
      durationMinutes,
      mode,
      completed: false,
      notes: contextNotes || '',
      recap: contextNotes || '',
      nextSteps: nextStepsNotes || '',
    };

    try {
      const updated = await SessionStore.update(sessionId, patch);
      if (!updated) return null;
      patchSessionInLocalState(sessionId, patch);
      return updated;
    } catch (error) {
      console.error(`Failed to checkpoint active session (${source}):`, error);
      return null;
    }
  }, [currentSessionId, task, mode, contextNotes, getElapsedSeconds, ensureCurrentSessionId, nextStepsNotes, patchSessionInLocalState]);

  const beginSessionFeedbackFlow = useCallback(() => {
    sessionFeedbackPendingActionRef.current = null;
    sessionFeedbackFlowRef.current = {
      id: sessionFeedbackFlowRef.current.id + 1,
      captured: false,
    };
    setSessionFeedbackPrompt(null);
  }, []);

  const resetSessionFeedbackFlow = useCallback(() => {
    sessionFeedbackPendingActionRef.current = null;
    sessionFeedbackFlowRef.current = {
      ...sessionFeedbackFlowRef.current,
      captured: false,
    };
    setSessionFeedbackPrompt(null);
  }, []);

  const continueSessionFeedbackFlow = useCallback(() => {
    const nextAction = sessionFeedbackPendingActionRef.current;
    sessionFeedbackPendingActionRef.current = null;
    setSessionFeedbackPrompt(null);
    if (typeof nextAction === 'function') {
      nextAction();
    }
  }, []);

  const captureSessionFeedback = useCallback(async (feedback) => {
    const prompt = sessionFeedbackPrompt;
    if (!prompt) return;
    if (prompt.flowId !== sessionFeedbackFlowRef.current.id || sessionFeedbackFlowRef.current.captured) return;

    sessionFeedbackFlowRef.current = {
      ...sessionFeedbackFlowRef.current,
      captured: true,
    };

    const sessionId = prompt.sessionId || await ensureCurrentSessionId('session feedback');
    const queueItem = {
      id: createLocalFeedbackId(),
      sessionId: sessionId || null,
      feedback,
      surface: prompt.surface,
      completionType: prompt.completionType,
      sessionMode: prompt.sessionMode,
      sessionDurationMinutes: prompt.sessionDurationMinutes,
      clientCreatedAt: new Date().toISOString(),
      appVersion: runtimeInfo?.version || 'unknown',
      osVersion: runtimeInfo?.osVersion || '',
      channel: runtimeInfo?.channel || 'latest',
      installId: licenseStatus?.installId || '',
      licenseInstanceId: licenseStatus?.instanceId || null,
      syncStatus: 'pending',
      attemptCount: 0,
      lastAttemptAt: null,
      syncedAt: null,
      lastError: null,
    };

    try {
      const enqueuePromise = window.electronAPI.enqueueFeedback?.(queueItem);
      if (enqueuePromise) {
        void Promise.resolve(enqueuePromise)
          .then((enqueueResult) => {
            if (enqueueResult?.ok === false) {
              console.warn('Failed to queue session feedback:', enqueueResult.error || 'Unknown feedback queue error.');
            }
          })
          .catch((error) => {
            console.error('Failed to queue session feedback:', error);
          });
      }
      if (sessionId) {
        await SessionStore.update(sessionId, { sessionFeedback: feedback });
      }
      track('session_feedback', {
        feedback,
        sessionId: sessionId || 'unknown',
        sessionDuration: prompt.sessionDurationMinutes,
        sessionMode: prompt.sessionMode,
        completionType: prompt.completionType,
        surface: prompt.surface,
      });
    } catch (error) {
      console.error('Failed to capture session feedback:', error);
    }
  }, [ensureCurrentSessionId, licenseStatus?.installId, licenseStatus?.instanceId, runtimeInfo?.channel, runtimeInfo?.osVersion, runtimeInfo?.version, sessionFeedbackPrompt]);

  const maybePromptSessionFeedback = useCallback(({ modal, surface, completionType, onContinue }) => {
    if (sessionFeedbackFlowRef.current.captured) {
      onContinue?.();
      return;
    }

    sessionFeedbackPendingActionRef.current = onContinue;
    setSessionFeedbackPrompt({
      modal,
      surface,
      completionType,
      flowId: sessionFeedbackFlowRef.current.id,
      sessionId: currentSessionId || sessionToSave.current?.sessionId || null,
      sessionDurationMinutes: Number((sessionToSave.current?.duration || 0).toFixed(2)),
      sessionMode: mode,
    });
  }, [currentSessionId, mode]);

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

  const closeFloatingReentryPrompt = useCallback(() => {
    reentryFloatingPromptOpenRef.current = false;
    const closedState = JSON.stringify({ open: false });
    if (reentryFloatingPromptSentRef.current === closedState) return;
    reentryFloatingPromptSentRef.current = closedState;
    window.electronAPI.setFloatingReentryState?.({ open: false });
  }, []);

  const setFloatingBreakState = useCallback(({ open = false, endsAt = 0, showTimer = false } = {}) => {
    window.electronAPI.setFloatingBreakState?.({
      open: open === true,
      endsAt: Math.max(0, Math.floor(Number(endsAt) || 0)),
      showTimer: showTimer === true,
    });
  }, []);

  const showFloatingReentryPrompt = useCallback(() => {
    const resumeCandidate = reentryResumeCandidateRef.current;
    const promptKind = resumeCandidate ? 'resume-choice' : 'start';
    const defaultMinutes = (() => {
      const parsed = Number.parseInt(String(sessionMinutes || '').trim(), 10);
      return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 240) : 25;
    })();

    if (!reentryFloatingPromptOpenRef.current) {
      reentryPromptKeyRef.current += 1;
    }
    reentryFloatingPromptOpenRef.current = true;

    const nextPromptState = {
      open: true,
      promptKey: reentryPromptKeyRef.current,
      promptKind,
      resumeTaskName: resumeCandidate?.taskText || '',
      defaultTaskText: resumeCandidate?.taskText || task,
      defaultMinutes,
      strongActive: reentryStrongActiveRef.current === true,
    };
    const serialized = JSON.stringify(nextPromptState);
    if (reentryFloatingPromptSentRef.current === serialized) return;
    reentryFloatingPromptSentRef.current = serialized;
    window.electronAPI.setFloatingReentryState?.(nextPromptState);
  }, [sessionMinutes, task]);

  const resetReentryAttention = useCallback(({ preserveSnooze = false } = {}) => {
    if (reentryStrongTimeoutRef.current) {
      clearTimeout(reentryStrongTimeoutRef.current);
      reentryStrongTimeoutRef.current = null;
    }
    setReentryStrongActive(false);
    setReentryAttentionVisible(false);
    closeFloatingReentryPrompt();

    if (!preserveSnooze) {
      reentryEligibleSinceRef.current = null;
      reentryNextCueAtRef.current = null;
      reentryRemainingMsRef.current = null;
      reentrySnoozeUntilRef.current = 0;
      reentrySnoozeUntilReopenRef.current = false;
    }
  }, [closeFloatingReentryPrompt]);

  const fireReentryCue = useCallback(() => {
    if (reentryStrongTimeoutRef.current) {
      clearTimeout(reentryStrongTimeoutRef.current);
    }
    setReentryAttentionVisible(true);
    setReentryStrongActive(true);
    triggerPulse('gentle', 2);
    reentryStrongTimeoutRef.current = window.setTimeout(() => {
      setReentryStrongActive(false);
      reentryStrongTimeoutRef.current = null;
    }, REENTRY_STRONG_MS);
  }, [triggerPulse]);

  const snoozeReentryAttention = useCallback((kind = '10m') => {
    const now = Date.now();
    if (kind === 'reopen') {
      reentrySnoozeUntilRef.current = 0;
      reentrySnoozeUntilReopenRef.current = true;
      reentryEligibleSinceRef.current = null;
      reentryNextCueAtRef.current = null;
      reentryRemainingMsRef.current = null;
    } else {
      const durationMs = REENTRY_SNOOZE_MS[kind] || REENTRY_SNOOZE_MS['10m'];
      reentrySnoozeUntilRef.current = now + durationMs;
      reentrySnoozeUntilReopenRef.current = false;
      reentryEligibleSinceRef.current = null;
      reentryNextCueAtRef.current = now + durationMs;
      reentryRemainingMsRef.current = null;
    }

    if (reentryStrongTimeoutRef.current) {
      clearTimeout(reentryStrongTimeoutRef.current);
      reentryStrongTimeoutRef.current = null;
    }
    setReentryStrongActive(false);
    setReentryAttentionVisible(false);
    closeFloatingReentryPrompt();
  }, [closeFloatingReentryPrompt]);

  const pauseReentryAttention = useCallback((now = Date.now()) => {
    if (reentryStrongTimeoutRef.current) {
      clearTimeout(reentryStrongTimeoutRef.current);
      reentryStrongTimeoutRef.current = null;
    }
    if (reentryAttentionVisibleRef.current) {
      reentryRemainingMsRef.current = 0;
    } else if (Number.isFinite(reentryNextCueAtRef.current)) {
      reentryRemainingMsRef.current = Math.max(0, reentryNextCueAtRef.current - now);
    }
    setReentryStrongActive(false);
    setReentryAttentionVisible(false);
    closeFloatingReentryPrompt();
    reentryEligibleSinceRef.current = null;
    reentryNextCueAtRef.current = null;
  }, [closeFloatingReentryPrompt]);

  const handleExitCompact = useCallback(() => {
    if (isCompact) {
      window.electronAPI.capturePillRestoreBounds?.();
      pendingCompactRestoreRef.current = false;
    }

    setCompactTransitioning(true);
    setIsCompact(false);

    const shouldForceIdleLayout = (
      !isRunning
      && !task.trim()
      && !hasSavedContext
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
    if (hasSavedContext) {
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
  }, [checkInState, hasSavedContext, isCompact, isRunning, isStartModalOpen, isTimerVisible, task]);

  const captureCompactReturnBounds = useCallback(() => {
    window.electronAPI.capturePillRestoreBounds?.();
    pendingCompactRestoreRef.current = false;
  }, []);

  const exitCompactForReturnDetour = useCallback((afterExit, delayMs = 120) => {
    if (!isCompact) return false;
    captureCompactReturnBounds();
    handleExitCompact();
    if (typeof afterExit === 'function') {
      setTimeout(() => {
        afterExit();
      }, delayMs);
    }
    return true;
  }, [captureCompactReturnBounds, handleExitCompact, isCompact]);

  const openHistoryModal = useCallback(() => {
    if (isCompact) {
      historyReturnToCompactRef.current = true;
      exitCompactForReturnDetour(() => {
        setShowHistoryModal(true);
      }, 120);
      return;
    }
    historyReturnToCompactRef.current = false;
    setShowHistoryModal(true);
  }, [exitCompactForReturnDetour, isCompact]);

  const openSettingsModal = useCallback(() => {
    if (isCompact) {
      settingsReturnToCompactRef.current = true;
      exitCompactForReturnDetour(() => {
        setShowSettings(true);
      }, 120);
      return;
    }
    settingsReturnToCompactRef.current = false;
    setShowSettings(true);
  }, [exitCompactForReturnDetour, isCompact]);

  const handleOpenParkingLot = useCallback(() => {
    track('parking_lot_opened', { source: 'manual' });
    if (isCompact) {
      parkingLotReturnToCompactRef.current = true;
      parkingLotReturnToFloatingRef.current = false;
      exitCompactForReturnDetour(() => setDistractionJarOpen(true), 140);
      return;
    }
    parkingLotReturnToCompactRef.current = false;
    parkingLotReturnToFloatingRef.current = false;
    setDistractionJarOpen(true);
  }, [exitCompactForReturnDetour, isCompact]);

  // Shortcut handlers
  const handleShortcutStartPause = useCallback(() => {
    if (task.trim()) {
      if (isRunning) {
        pauseActiveTimer();
        showToast('success', 'Session paused');
      } else {
        resumeActiveTimer('shortcut start');
        showToast('success', 'Session started');
      }
    } else {
      if (isCompact) handleExitCompact();
      setTimeout(() => { taskInputRef.current?.focus(); }, 100);
      showToast('info', 'Enter a task to start timer');
    }
  }, [task, isRunning, isCompact, handleExitCompact, pauseActiveTimer, resumeActiveTimer, showToast]);

  const handleShortcutNewTask = useCallback(() => {
    if (isCompact) handleExitCompact();
    setTimeout(() => {
      taskInputRef.current?.focus();
      taskInputRef.current?.select();
    }, 100);
  }, [isCompact, handleExitCompact]);

  const requestCompactEntry = useCallback(({ restorePreviousBounds = false, delayMs = 0 } = {}) => {
    pendingCompactRestoreRef.current = restorePreviousBounds === true;
    if (delayMs > 0) {
      setTimeout(() => {
        setIsCompact(true);
      }, delayMs);
      return;
    }
    setIsCompact(true);
  }, []);

  const handleShortcutToggleCompact = useCallback(() => {
    const newCompact = !isCompact;
    if (newCompact) {
      requestCompactEntry();
    } else {
      handleExitCompact();
    }
    showToast('info', newCompact ? 'Compact Mode On' : 'Compact Mode Off');
  }, [handleExitCompact, isCompact, requestCompactEntry, showToast]);

  const handleShortcutCompleteTask = useCallback(async () => {
    if (task.trim()) {
      const elapsedSeconds = isRunning ? pauseActiveTimer() : getElapsedSeconds();
      const durationMin = elapsedSeconds / 60;
      sessionToSave.current = {
        duration: durationMin,
        completed: true,
        sessionId: currentSessionId,
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
        if (isCompact) {
          handleExitCompact();
        }
        setSessionNotesMode('complete');
        setShowNotesModal(true);
      } else {
        showCompletedSessionMessage();
        triggerConfetti();
        await saveSessionWithNotes({ recap: contextNotes, nextSteps: nextStepsNotes });
        openPostSessionTransition({
          taskText: task,
          recap: contextNotes,
          nextSteps: nextStepsNotes,
          sessionId: null,
          carryoverSeconds: 0,
        });
      }
    }
  }, [task, isRunning, getElapsedSeconds, pauseActiveTimer, mode, saveSessionWithNotes, isCompact, handleExitCompact, showCompletedSessionMessage, triggerConfetti, contextNotes, nextStepsNotes]);

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
        case 'openParkingLot':
          if (isCompact) {
            handleExitCompact();
            setTimeout(() => setShowQuickCapture(true), 120);
          } else {
            setShowQuickCapture(true);
          }
          break;
      }
    })();
  }, [handleShortcutStartPause, handleShortcutNewTask, handleShortcutToggleCompact, handleShortcutCompleteTask, isCompact, handleExitCompact]);

  // Load data from electron-store on mount
  useEffect(() => {
    (async () => {
      try {
        await loadSessions();

        const savedThoughts = await window.electronAPI.storeGet('thoughts');
        if (savedThoughts) setThoughts(savedThoughts);
        thoughtsLoadedRef.current = true;

        const settings = await window.electronAPI.storeGet('settings') || {};
        const persistedTheme = settings.theme === 'dark' ? 'dark' : 'light';
        const hasStoredThemePreference = typeof settings.themeManual === 'boolean';
        if (hasStoredThemePreference) {
          if (settings.themeManual) {
            setTheme(persistedTheme);
            setIsThemeManual(true);
          } else {
            setTheme(getSystemTheme());
            setIsThemeManual(false);
          }
        } else {
          const localTheme = getStoredTheme();
          const nextTheme = localTheme || getSystemTheme();
          const nextIsThemeManual = Boolean(localTheme);
          setTheme(nextTheme);
          setIsThemeManual(nextIsThemeManual);
        }
        themeSettingsHydratedRef.current = true;
        const normalizedShortcuts = mergeShortcutsWithDefaults(settings.shortcuts);
        setShortcuts(normalizedShortcuts);
        if (shortcutsNeedRepair(settings.shortcuts, normalizedShortcuts)) {
          await window.electronAPI.storeSet('settings.shortcuts', normalizedShortcuts);
        }
        const normalizedPulseSettings = {
          ...(settings.pulseSettings || {}),
          compactEnabled: true,
        };
        setPulseSettings(normalizedPulseSettings);
        if (!settings.pulseSettings || settings.pulseSettings.compactEnabled !== true) {
          await window.electronAPI.storeSet('settings', {
            ...settings,
            pulseSettings: normalizedPulseSettings,
          });
        }

        setCheckInSettings({
          enabled: settings.checkInEnabled ?? true,
          intervalFreeflow: Number.isFinite(settings.checkInIntervalFreeflow) ? settings.checkInIntervalFreeflow : 15,
          timedPercents: TIMED_CHECKIN_PERCENTS,
        });
        if (
          !Array.isArray(settings.checkInIntervalTimed)
          || settings.checkInIntervalTimed.length !== TIMED_CHECKIN_PERCENTS.length
          || settings.checkInIntervalTimed.some((value, index) => value !== TIMED_CHECKIN_PERCENTS[index])
        ) {
          await window.electronAPI.storeSet('settings.checkInIntervalTimed', TIMED_CHECKIN_PERCENTS);
        }
        setPinnedControls(normalizeToolbarControlMap(settings.pinnedControls, PINNED_CONTROLS_DEFAULT));
        setEnabledMainControls(normalizeToolbarControlMap(settings.mainScreenControlsEnabled, ENABLED_MAIN_CONTROLS_DEFAULT));
        setShortcutsEnabled(settings.shortcutsEnabled ?? true);
        setIsAlwaysOnTop(await window.electronAPI.getAlwaysOnTop());
        syncDoNotDisturb(settings.doNotDisturbEnabled ?? false);

        // Restore the persisted task/timer snapshot instead of wiping a live
        // session on renderer mount or reload.
        const [savedCurrentTask, savedTimerState] = await Promise.all([
          window.electronAPI.storeGet('currentTask'),
          window.electronAPI.storeGet('timerState'),
        ]);

        const restoredTaskText = typeof savedCurrentTask?.text === 'string' ? savedCurrentTask.text : '';
        const restoredContextNote = typeof savedCurrentTask?.recap === 'string'
          ? savedCurrentTask.recap
          : (typeof savedCurrentTask?.contextNote === 'string' ? savedCurrentTask.contextNote : '');
        const restoredNextSteps = typeof savedCurrentTask?.nextSteps === 'string' ? savedCurrentTask.nextSteps : '';
        const restoredMode = savedTimerState?.mode === 'timed' ? 'timed' : 'freeflow';
        const restoredInitialTime = Math.max(0, Math.floor(Number(savedTimerState?.initialTime) || 0));
        const storedElapsedSeconds = Math.max(0, Math.floor(Number(savedTimerState?.elapsedSeconds) || 0));
        const restoredSegmentStartElapsed = Math.max(0, Math.floor(Number(savedTimerState?.timedSegmentStartElapsed) || 0));
        const restoredSegmentDuration = Math.max(0, Math.floor(Number(savedTimerState?.timedSegmentDuration) || 0));
        const restoredCheckInIndex = Math.max(0, Math.floor(Number(savedTimerState?.checkInTimedIndex) || 0));
        const pendingCheckInIndex = savedTimerState?.checkInTimedPendingIndex;
        const restoredPendingCheckInIndex = Number.isFinite(Number(pendingCheckInIndex))
          ? Math.max(0, Math.floor(Number(pendingCheckInIndex)))
          : null;
        const restoredCompactPulseIndex = Math.max(0, Math.floor(Number(savedTimerState?.compactPulseTimedIndex) || 0));
        const restoredCurrentSessionId = typeof savedTimerState?.currentSessionId === 'string' && savedTimerState.currentSessionId.trim()
          ? savedTimerState.currentSessionId.trim()
          : null;
        const restoredStartedAtMs = typeof savedTimerState?.sessionStartedAt === 'string'
          ? new Date(savedTimerState.sessionStartedAt).getTime()
          : NaN;
        const restoredRunning = Boolean(savedTimerState?.isRunning) && Number.isFinite(restoredStartedAtMs);
        const liveElapsedSeconds = restoredRunning
          ? storedElapsedSeconds + Math.max(0, Math.floor((Date.now() - restoredStartedAtMs) / 1000))
          : storedElapsedSeconds;
        const restoredElapsedSeconds = restoredMode === 'timed' && restoredInitialTime > 0
          ? Math.min(liveElapsedSeconds, restoredInitialTime)
          : liveElapsedSeconds;
        const restoredDisplayTime = restoredMode === 'timed'
          ? Math.max(0, restoredInitialTime - restoredElapsedSeconds)
          : restoredElapsedSeconds;
        const restoredTimerVisible = typeof savedTimerState?.timerVisible === 'boolean'
          ? savedTimerState.timerVisible
          : (Boolean(restoredTaskText.trim()) && (
            restoredRunning
            || restoredInitialTime > 0
            || restoredElapsedSeconds > 0
          ));
        const restoredSegmentElapsed = restoredMode === 'timed'
          ? Math.max(0, restoredElapsedSeconds - restoredSegmentStartElapsed)
          : 0;

        elapsedBeforeRunRef.current = restoredRunning ? storedElapsedSeconds : restoredElapsedSeconds;
        freeflowPulseNextRef.current = null;
        checkInTimedIndexRef.current = restoredCheckInIndex;
        checkInTimedPendingIndexRef.current = restoredPendingCheckInIndex;
        timedCheckInLastElapsedRef.current = restoredElapsedSeconds;
        timedCheckInLastSegmentElapsedRef.current = restoredSegmentElapsed;
        compactPulseThresholdsRef.current = [];
        compactPulseIndexRef.current = restoredCompactPulseIndex;
        timedPulseLastElapsedRef.current = restoredElapsedSeconds;
        timedPulseLastSegmentElapsedRef.current = restoredSegmentElapsed;
        timedCueSegmentStartElapsedRef.current = restoredSegmentStartElapsed;
        timedCueSegmentDurationRef.current = restoredSegmentDuration;
        setTask(clampTaskText(restoredTaskText));
        setContextNotes(restoredContextNote);
        setNextStepsNotes(restoredNextSteps);
        setTime(restoredDisplayTime);
        setMode(restoredMode);
        setInitialTime(restoredInitialTime);
        setIsTimerVisible(restoredTimerVisible);
        setIsRunning(restoredRunning);
        setCurrentSessionId(restoredCurrentSessionId);
        setSessionStartTime(restoredRunning ? restoredStartedAtMs : null);
      } finally {
        setSessionStateHydrated(true);
        setShortcutsHydrated(true);
      }
    })();
  }, [loadSessions, syncDoNotDisturb]);

  // DND — listen for tray toggle and sync state + persist
  useEffect(() => {
    const cleanup = window.electronAPI.onDndToggle?.((enabled) => {
      syncDoNotDisturb(enabled);
      track('dnd_toggled', { enabled: Boolean(enabled), source: 'tray' });
    });
    return () => { if (cleanup) cleanup(); };
  }, [syncDoNotDisturb]);

  useEffect(() => {
    const cleanup = window.electronAPI.onTrayOpenHistory?.(() => {
      setShowSettings(false);
      setShowTaskPreview(false);
      openHistoryModal();
    });
    return () => { if (cleanup) cleanup(); };
  }, [openHistoryModal]);

  useEffect(() => {
    const cleanup = window.electronAPI.onTrayOpenParkingLot?.(() => {
      setShowSettings(false);
      setShowTaskPreview(false);
      handleOpenParkingLot();
    });
    return () => { if (cleanup) cleanup(); };
  }, [handleOpenParkingLot]);

  useEffect(() => {
    const cleanup = window.electronAPI.onTrayOpenSettings?.(() => {
      setShowHistoryModal(false);
      setShowTaskPreview(false);
      setDistractionJarOpen(false);
      openSettingsModal();
    });
    return () => { if (cleanup) cleanup(); };
  }, [openSettingsModal]);

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
    if (!sessionStateHydrated) return;
    if (!isRunning) {
      window.electronAPI.storeSet('currentTask', {
        text: task,
        contextNote: contextNotes,
        recap: contextNotes,
        nextSteps: nextStepsNotes,
        startedAt: null,
      });
      window.electronAPI.storeSet('timerState', {
        mode,
        seconds: time,
        timerVisible: isTimerVisible,
        isRunning: false,
        initialTime,
        elapsedSeconds: elapsedBeforeRunRef.current,
        sessionStartedAt: null,
        timedSegmentStartElapsed: timedCueSegmentStartElapsedRef.current,
        timedSegmentDuration: timedCueSegmentDurationRef.current,
        checkInTimedIndex: checkInTimedIndexRef.current,
        checkInTimedPendingIndex: checkInTimedPendingIndexRef.current,
        compactPulseTimedIndex: compactPulseIndexRef.current,
        currentSessionId,
      });
    }
  }, [task, time, mode, initialTime, contextNotes, isRunning, isTimerVisible, currentSessionId, nextStepsNotes, sessionStateHydrated]);

  useEffect(() => {
    if (!sessionStateHydrated) return;
    if (!isRunning) return;

    window.electronAPI.storeSet('currentTask', {
      text: task,
      contextNote: contextNotes,
      recap: contextNotes,
      nextSteps: nextStepsNotes,
      startedAt: sessionStartTime ? new Date(sessionStartTime).toISOString() : null,
    });
    window.electronAPI.storeSet('timerState', {
      mode,
      seconds: time,
      timerVisible: isTimerVisible,
      isRunning: true,
      initialTime,
      elapsedSeconds: elapsedBeforeRunRef.current,
      sessionStartedAt: sessionStartTime ? new Date(sessionStartTime).toISOString() : null,
      timedSegmentStartElapsed: timedCueSegmentStartElapsedRef.current,
      timedSegmentDuration: timedCueSegmentDurationRef.current,
      checkInTimedIndex: checkInTimedIndexRef.current,
      checkInTimedPendingIndex: checkInTimedPendingIndexRef.current,
      compactPulseTimedIndex: compactPulseIndexRef.current,
      currentSessionId,
    });
  }, [task, contextNotes, mode, initialTime, isRunning, isTimerVisible, nextStepsNotes, sessionStartTime, time, currentSessionId, sessionStateHydrated]);

  const persistIdleTimerSnapshot = useCallback(({
    taskText = task,
    recapText = contextNotes,
    nextStepsText = nextStepsNotes,
    nextMode = mode,
    sessionId = null,
  } = {}) => {
    window.electronAPI.storeSet('currentTask', {
      text: taskText,
      contextNote: recapText,
      recap: recapText,
      nextSteps: nextStepsText,
      startedAt: null,
    });
    window.electronAPI.storeSet('timerState', {
      mode: nextMode === 'timed' ? 'timed' : 'freeflow',
      seconds: 0,
      timerVisible: false,
      isRunning: false,
      initialTime: 0,
      elapsedSeconds: 0,
      sessionStartedAt: null,
      timedSegmentStartElapsed: 0,
      timedSegmentDuration: 0,
      checkInTimedIndex: 0,
      checkInTimedPendingIndex: null,
      compactPulseTimedIndex: 0,
      currentSessionId: sessionId,
    });
  }, [contextNotes, mode, nextStepsNotes, task]);

  useEffect(() => {
    if (!sessionStateHydrated) return undefined;
    if (!isRunning) return undefined;

    const checkpointTimer = setInterval(() => {
      void checkpointActiveSession('interval');
    }, 60 * 1000);

    return () => clearInterval(checkpointTimer);
  }, [isRunning, checkpointActiveSession, sessionStateHydrated]);

  const getStandardCheckInIntervalSeconds = useCallback((nextMode = mode, nextInitialTimeSec = initialTime) => {
    if (nextMode === 'freeflow') {
      const intervalMinutes = Math.max(1, Number(checkInSettings.intervalFreeflow) || 15);
      return intervalMinutes * 60;
    }

    const thresholds = buildTimedThresholds(TIMED_CHECKIN_PERCENTS, nextInitialTimeSec);

    if (thresholds.length >= 2) {
      return Math.max(60, thresholds[1] - thresholds[0]);
    }

    return Math.max(60, thresholds[0] || Math.round(Math.max(1, Number(nextInitialTimeSec) || 0) * 0.4));
  }, [mode, initialTime, checkInSettings.intervalFreeflow]);

  const getShortCheckInIntervalSeconds = useCallback((nextMode = mode, nextInitialTimeSec = initialTime) => {
    const standardInterval = getStandardCheckInIntervalSeconds(nextMode, nextInitialTimeSec);
    return Math.max(60, Math.round(standardInterval * 0.4));
  }, [mode, initialTime, getStandardCheckInIntervalSeconds]);

  const getTimedCueSegmentElapsed = useCallback((elapsedSec) => {
    const normalizedElapsed = Math.max(0, Math.floor(Number(elapsedSec) || 0));
    return Math.max(0, normalizedElapsed - timedCueSegmentStartElapsedRef.current);
  }, []);

  const getTimedCueSegmentDuration = useCallback((fallbackTotalSec = initialTime) => {
    const segmentDuration = Math.max(0, Math.floor(Number(timedCueSegmentDurationRef.current) || 0));
    if (segmentDuration > 0) return segmentDuration;
    return Math.max(1, Math.floor(Number(fallbackTotalSec) || 0));
  }, [initialTime]);

  const setTimedCueSegment = useCallback((startElapsedSec = 0, durationSec = 0) => {
    timedCueSegmentStartElapsedRef.current = Math.max(0, Math.floor(Number(startElapsedSec) || 0));
    timedCueSegmentDurationRef.current = Math.max(0, Math.floor(Number(durationSec) || 0));
    timedCheckInLastSegmentElapsedRef.current = 0;
    timedPulseLastSegmentElapsedRef.current = 0;
  }, []);

  const clearTimedCueSegment = useCallback(() => {
    setTimedCueSegment(0, 0);
  }, [setTimedCueSegment]);

  const clearCheckInUi = useCallback(() => {
    if (checkInResolveTimeoutRef.current) clearTimeout(checkInResolveTimeoutRef.current);
    checkInResolveTimeoutRef.current = null;
    if (compactSuccessReturnTimerRef.current) clearTimeout(compactSuccessReturnTimerRef.current);
    compactSuccessReturnTimerRef.current = null;
    checkInPromptSurfaceRef.current = 'full';
    pendingCompactCheckInPromptRef.current = false;
    checkInStateRef.current = 'idle';
    setCheckInState('idle');
    setCheckInMessage('');
    setCheckInCelebrating(false);
    setCheckInCelebrationType('none');
  }, []);

  const clearCheckInRuntime = useCallback(() => {
    checkInFreeflowNextRef.current = null;
    checkInTimedThresholdsRef.current = [];
    checkInTimedIndexRef.current = 0;
    checkInTimedPendingIndexRef.current = null;
    timedCheckInLastElapsedRef.current = 0;
    timedCheckInLastSegmentElapsedRef.current = 0;
    checkInForcedNextRef.current = null;
    checkInShortIntervalRef.current = false;
    checkInPromptCooldownUntilRef.current = 0;
    checkInReturnToCompactRef.current = false;
    checkInReturnToFloatingRef.current = false;
    checkInPromptSurfaceRef.current = 'full';
    pendingCompactCheckInPromptRef.current = false;
    clearCheckInUi();
  }, [clearCheckInUi]);

  const clearCompactPulseRuntime = useCallback(() => {
    freeflowPulseNextRef.current = null;
    compactPulseThresholdsRef.current = [];
    compactPulseIndexRef.current = 0;
    timedPulseLastElapsedRef.current = 0;
    timedPulseLastSegmentElapsedRef.current = 0;
  }, []);

  const resetCheckInSchedule = useCallback((nextMode, nextInitialTimeSec = initialTime, elapsedSec = 0, options = {}) => {
    const previousFreeflowNext = checkInFreeflowNextRef.current;
    const previousTimedThresholds = checkInTimedThresholdsRef.current;
    const previousTimedIndex = checkInTimedIndexRef.current;
    const normalizedElapsed = Math.max(0, Math.floor(Number(elapsedSec) || 0));
    const restartTimedSegment = options?.restartTimedSegment === true;
    const restartFreeflowPhase = options?.restartFreeflowPhase === true;

    checkInFreeflowNextRef.current = null;
    checkInTimedThresholdsRef.current = [];
    checkInTimedIndexRef.current = 0;
    checkInTimedPendingIndexRef.current = null;
    timedCheckInLastElapsedRef.current = normalizedElapsed;
    timedCheckInLastSegmentElapsedRef.current = getTimedCueSegmentElapsed(normalizedElapsed);
    checkInForcedNextRef.current = null;
    checkInShortIntervalRef.current = false;

    if (!checkInSettings.enabled) return;

    if (nextMode === 'freeflow') {
      const intervalSeconds = getStandardCheckInIntervalSeconds(nextMode, nextInitialTimeSec);
      const nextTarget = normalizedElapsed + intervalSeconds;
      if (!restartFreeflowPhase && Number.isFinite(previousFreeflowNext) && previousFreeflowNext > normalizedElapsed) {
        checkInFreeflowNextRef.current = Math.min(previousFreeflowNext, nextTarget);
      } else {
        checkInFreeflowNextRef.current = nextTarget;
      }
      return;
    }

    const segmentElapsed = getTimedCueSegmentElapsed(normalizedElapsed);
    const nextThresholds = buildTimedThresholds(TIMED_CHECKIN_PERCENTS, getTimedCueSegmentDuration(nextInitialTimeSec));
    let nextTimedIndex = 0;

    const sameThresholds = !restartTimedSegment && (
      previousTimedThresholds.length === nextThresholds.length
      && previousTimedThresholds.every((value, idx) => value === nextThresholds[idx])
    );
    if (sameThresholds) {
      const clampedPrevIndex = Number.isFinite(previousTimedIndex)
        ? Math.max(0, Math.min(Math.floor(previousTimedIndex), nextThresholds.length))
        : 0;
      nextTimedIndex = clampedPrevIndex;
    } else {
      while (nextTimedIndex < nextThresholds.length && segmentElapsed >= nextThresholds[nextTimedIndex]) {
        nextTimedIndex += 1;
      }
    }

    checkInTimedThresholdsRef.current = nextThresholds;
    checkInTimedIndexRef.current = nextTimedIndex;
  }, [checkInSettings.enabled, initialTime, getStandardCheckInIntervalSeconds, getTimedCueSegmentDuration, getTimedCueSegmentElapsed]);

  const resetCompactPulseSchedule = useCallback((nextMode, nextInitialTimeSec = initialTime, elapsedSec = 0, options = {}) => {
    const previousFreeflowPulseNext = freeflowPulseNextRef.current;
    const previousThresholds = compactPulseThresholdsRef.current;
    const previousIndex = compactPulseIndexRef.current;
    const normalizedElapsed = Math.max(0, Math.floor(Number(elapsedSec) || 0));
    const restartTimedSegment = options?.restartTimedSegment === true;
    const restartFreeflowPhase = options?.restartFreeflowPhase === true;

    freeflowPulseNextRef.current = null;
    compactPulseThresholdsRef.current = [];
    compactPulseIndexRef.current = 0;
    timedPulseLastElapsedRef.current = normalizedElapsed;
    timedPulseLastSegmentElapsedRef.current = getTimedCueSegmentElapsed(normalizedElapsed);

    if (nextMode === 'freeflow') {
      const nextTarget = normalizedElapsed + FREEFLOW_PULSE_INTERVAL_SECONDS;
      if (!restartFreeflowPhase && Number.isFinite(previousFreeflowPulseNext) && previousFreeflowPulseNext > normalizedElapsed) {
        freeflowPulseNextRef.current = Math.min(previousFreeflowPulseNext, nextTarget);
      } else {
        freeflowPulseNextRef.current = nextTarget;
      }
      return;
    }

    if (nextMode !== 'timed') return;

    const segmentElapsed = getTimedCueSegmentElapsed(normalizedElapsed);
    const nextThresholds = buildTimedThresholds(TIMED_COMPACT_PULSE_PERCENTS, getTimedCueSegmentDuration(nextInitialTimeSec));
    let nextIndex = 0;

    const sameThresholds = !restartTimedSegment && (
      previousThresholds.length === nextThresholds.length
      && previousThresholds.every((value, idx) => value === nextThresholds[idx])
    );

    if (sameThresholds) {
      nextIndex = Number.isFinite(previousIndex)
        ? Math.max(0, Math.min(Math.floor(previousIndex), nextThresholds.length))
        : 0;
    } else {
      while (nextIndex < nextThresholds.length && segmentElapsed >= nextThresholds[nextIndex]) {
        nextIndex += 1;
      }
    }

    compactPulseThresholdsRef.current = nextThresholds;
    compactPulseIndexRef.current = nextIndex;
  }, [initialTime, getTimedCueSegmentDuration, getTimedCueSegmentElapsed]);

  const clearCompactSessionCues = useCallback(() => {
    clearCheckInRuntime();
    clearCompactPulseRuntime();
    clearTimedCueSegment();
  }, [clearCheckInRuntime, clearCompactPulseRuntime, clearTimedCueSegment]);

  const applyPausedTimerSnapshot = useCallback((payload = {}) => {
    const nextTimerState = payload?.timerState && typeof payload.timerState === 'object'
      ? payload.timerState
      : {};
    const nextCurrentTask = payload?.currentTask && typeof payload.currentTask === 'object'
      ? payload.currentTask
      : {};
    const nextMode = nextTimerState?.mode === 'timed' ? 'timed' : 'freeflow';
    const nextInitialTime = Math.max(0, Math.floor(Number(nextTimerState?.initialTime) || 0));
    const nextElapsedSeconds = Math.max(0, Math.floor(Number(nextTimerState?.elapsedSeconds) || 0));
    const nextDisplayTime = nextMode === 'timed'
      ? Math.max(0, nextInitialTime - nextElapsedSeconds)
      : nextElapsedSeconds;
    const nextTask = typeof nextCurrentTask?.text === 'string' ? nextCurrentTask.text : '';
    const nextContextNotes = typeof nextCurrentTask?.contextNote === 'string' ? nextCurrentTask.contextNote : '';
    const nextCurrentSessionId = typeof nextTimerState?.currentSessionId === 'string' && nextTimerState.currentSessionId.trim()
      ? nextTimerState.currentSessionId.trim()
      : null;

    clearCheckInUi();
    clearCompactSessionCues();
    elapsedBeforeRunRef.current = nextElapsedSeconds;
    checkInTimedIndexRef.current = Math.max(0, Math.floor(Number(nextTimerState?.checkInTimedIndex) || 0));
    checkInTimedPendingIndexRef.current = Number.isFinite(Number(nextTimerState?.checkInTimedPendingIndex))
      ? Math.max(0, Math.floor(Number(nextTimerState.checkInTimedPendingIndex)))
      : null;
    compactPulseIndexRef.current = Math.max(0, Math.floor(Number(nextTimerState?.compactPulseTimedIndex) || 0));
    timedCueSegmentStartElapsedRef.current = Math.max(0, Math.floor(Number(nextTimerState?.timedSegmentStartElapsed) || 0));
    timedCueSegmentDurationRef.current = Math.max(0, Math.floor(Number(nextTimerState?.timedSegmentDuration) || 0));
    setTask(clampTaskText(nextTask));
    setContextNotes(nextContextNotes);
    setMode(nextMode);
    setInitialTime(nextInitialTime);
    setTime(nextDisplayTime);
    setIsTimerVisible(Boolean(nextTimerState?.timerVisible));
    setIsRunning(false);
    setSessionStartTime(null);
    setCurrentSessionId(nextCurrentSessionId);
  }, [clearCheckInUi, clearCompactSessionCues]);

  const reconcilePausedTimerSnapshotFromStore = useCallback(async () => {
    if (!isRunning) return false;

    const [savedCurrentTask, savedTimerState] = await Promise.all([
      window.electronAPI.storeGet('currentTask'),
      window.electronAPI.storeGet('timerState'),
    ]);

    const savedSessionId = typeof savedTimerState?.currentSessionId === 'string' && savedTimerState.currentSessionId.trim()
      ? savedTimerState.currentSessionId.trim()
      : null;
    const localSessionId = typeof currentSessionId === 'string' && currentSessionId.trim()
      ? currentSessionId.trim()
      : null;
    const hasPausedRecoverableTimer = (
      Boolean(savedTimerState?.timerVisible)
      || Math.max(0, Math.floor(Number(savedTimerState?.elapsedSeconds) || 0)) > 0
      || Math.max(0, Math.floor(Number(savedTimerState?.initialTime) || 0)) > 0
    ) && !Boolean(savedTimerState?.isRunning);

    if (!hasPausedRecoverableTimer) return false;
    if (localSessionId && savedSessionId && localSessionId !== savedSessionId) return false;

    applyPausedTimerSnapshot({
      currentTask: savedCurrentTask,
      timerState: savedTimerState,
    });
    showToast('info', 'Session paused while your Mac slept');
    return true;
  }, [applyPausedTimerSnapshot, currentSessionId, isRunning, showToast]);

  const restoreDisplayMode = useCallback(({ returnToCompact = false, returnToFloating = false } = {}) => {
    if (returnToFloating) {
      pendingCompactRestoreRef.current = false;
      setTimeout(() => {
        void window.electronAPI.enterFloatingMinimize?.();
      }, 120);
      return;
    }

    if (returnToCompact) {
      requestCompactEntry({ restorePreviousBounds: true, delayMs: 80 });
      return;
    }

    pendingCompactRestoreRef.current = false;
  }, [requestCompactEntry]);

  const handleClear = useCallback(() => {
    elapsedBeforeRunRef.current = 0;
    historyResumeCarryoverSecondsRef.current = 0;
    sessionToSave.current = null;
    pendingParkingLotTaskSwitchRef.current = null;
    reentryStartNewAfterResolveRef.current = false;
    parkingLotReturnToCompactRef.current = false;
    parkingLotReturnToFloatingRef.current = false;
    historyReturnToCompactRef.current = false;
    settingsReturnToCompactRef.current = false;
    postSessionParkingLotReturnToCompactRef.current = false;
    postSessionParkingLotReturnToFloatingRef.current = false;
    timeUpReturnToCompactRef.current = false;
    timeUpReturnToFloatingRef.current = false;
    setIsRunning(false);
    setTime(0);
    setTask('');
    setInitialTime(0);
    setContextNotes('');
    setNextStepsNotes('');
    setCurrentSessionId(null);
    setIsTimerVisible(false);
    setIsCompact(false);
    setShowNotesModal(false);
    setShowPostSessionPrompt(false);
    setShowTimeUpModal(false);
    setSessionNotesMode('complete');
    setSessionStartTime(null);
    setPostSessionResumeCandidate(null);
    setPostSessionStartAssist(false);
    setPostSessionBreakMinutes(null);
    setPostSessionBreakHasSelection(false);
    setPostSessionBreakShowTimer(false);
    setParkingLotTaskSwitchConfirm(null);
    invalidatePendingSessionCreation();
    resetSessionFeedbackFlow();
    postSessionBreakUntilRef.current = 0;
    postSessionBreakPromptPendingRef.current = false;

    clearCompactSessionCues();
    resetReentryAttention();
    setFloatingBreakState({ open: false });
  }, [clearCompactSessionCues, invalidatePendingSessionCreation, resetReentryAttention, resetSessionFeedbackFlow, setFloatingBreakState]);

  useEffect(() => {
    handleClearRef.current = handleClear;
  }, [handleClear]);

  const hasPostSessionParkingLotItems = useCallback((sessionId) => {
    if (!sessionId) return false;
    return thoughts.some((thought) => (
      thought?.sessionId === sessionId
      && thought?.completed !== true
    ));
  }, [thoughts]);

  const openPostSessionParkingLot = useCallback((sessionId) => {
    if (!sessionId) return;
    setPostSessionParkingLotHiddenIds([]);
    setPostSessionParkingLotSessionId(sessionId);
  }, []);

  const finalizeCompletedSessionUi = useCallback((completedSessionId, {
    focusTaskInput = false,
  } = {}) => {
    const shouldShowParkingLot = hasPostSessionParkingLotItems(completedSessionId);
    handleClear();
    if (shouldShowParkingLot && completedSessionId) {
      postSessionParkingLotReturnToCompactRef.current = false;
      postSessionParkingLotReturnToFloatingRef.current = false;
      openPostSessionParkingLot(completedSessionId);
      return;
    }
    postSessionParkingLotReturnToCompactRef.current = false;
    postSessionParkingLotReturnToFloatingRef.current = false;
    if (focusTaskInput) {
      setTimeout(() => taskInputRef.current?.focus(), 140);
    }
  }, [handleClear, hasPostSessionParkingLotItems, openPostSessionParkingLot]);

  useEffect(() => {
    getElapsedSecondsRef.current = getElapsedSeconds;
  }, [getElapsedSeconds]);

  useEffect(() => {
    reentryResumeCandidateRef.current = reentryResumeCandidate;
  }, [reentryResumeCandidate]);

  useEffect(() => {
    resetCheckInScheduleRef.current = resetCheckInSchedule;
  }, [resetCheckInSchedule]);

  useEffect(() => {
    resetCompactPulseScheduleRef.current = resetCompactPulseSchedule;
  }, [resetCompactPulseSchedule]);

  const advanceCheckInScheduleAfterResult = useCallback((elapsedSec) => {
    if (!checkInSettings.enabled) return;
    const normalizedElapsed = Math.max(0, Math.floor(Number(elapsedSec) || 0));
    if (mode === 'freeflow') {
      const intervalSeconds = getStandardCheckInIntervalSeconds(mode, initialTime);
      checkInFreeflowNextRef.current = normalizedElapsed + intervalSeconds;
      return;
    }
    const segmentElapsed = getTimedCueSegmentElapsed(normalizedElapsed);
    while (
      checkInTimedIndexRef.current < checkInTimedThresholdsRef.current.length &&
      segmentElapsed >= checkInTimedThresholdsRef.current[checkInTimedIndexRef.current]
    ) {
      checkInTimedIndexRef.current += 1;
    }
    timedCheckInLastElapsedRef.current = normalizedElapsed;
    timedCheckInLastSegmentElapsedRef.current = segmentElapsed;
  }, [checkInSettings.enabled, mode, initialTime, getStandardCheckInIntervalSeconds, getTimedCueSegmentElapsed]);

  const openCompactCheckInPrompt = useCallback(() => {
    if (checkInStateRef.current !== 'idle' || !isRunningRef.current) return false;
    checkInPromptSurfaceRef.current = 'compact';
    pendingCompactCheckInPromptRef.current = false;
    checkInStateRef.current = 'prompting';
    setCheckInState('prompting');
    setCheckInMessage('');
    setCheckInCelebrating(false);
    setCheckInCelebrationType('none');
    return true;
  }, []);

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

  const logMissedCheckInIfPrompting = useCallback((elapsedSec) => {
    if (checkInStateRef.current !== 'prompting') return false;
    void logCheckIn('missed', elapsedSec);
    track('checkin_responded', { response: 'missed' });
    clearCheckInUi();
    return true;
  }, [clearCheckInUi, logCheckIn]);

  const completeSessionFromCheckIn = useCallback(async (elapsedSec) => {
    let completedSessionId = currentSessionId;
    try {
      const durationMinutes = Number((elapsedSec / 60).toFixed(2));
      if (currentSessionId) {
        await SessionStore.update(currentSessionId, {
          task: task.trim(),
          durationMinutes,
          mode,
          completed: true,
          notes: contextNotes || '',
          recap: contextNotes || '',
          nextSteps: nextStepsNotes || '',
        });
      } else if (task.trim()) {
        const created = await SessionStore.create({
          task: task.trim(),
          duration_minutes: durationMinutes,
          mode,
          completed: true,
          notes: contextNotes || '',
          recap: contextNotes || '',
          nextSteps: nextStepsNotes || '',
        });
        completedSessionId = created?.id || null;
      }
      await loadSessions();
    } catch (error) {
      console.error('Failed to finalize session after check-in completion:', error);
    }

    return completedSessionId;
  }, [currentSessionId, task, mode, contextNotes, loadSessions, nextStepsNotes]);

  const resolveCheckIn = useCallback(async (status) => {
    if (checkInStateRef.current !== 'prompting') return;
    if (status !== 'focused') return;
    // Synchronously claim the ref so a second click cannot slip through
    // while the async logCheckIn IPC is in flight.
    checkInStateRef.current = 'resolved';
    const shouldReturnToCompact = checkInReturnToCompactRef.current;
    const shouldReturnToFloating = checkInReturnToFloatingRef.current;
    const elapsedSec = getElapsedSeconds();
    await logCheckIn(status, elapsedSec);

    track('checkin_responded', { response: 'focused' });
    if (checkInShortIntervalRef.current) {
      checkInShortIntervalRef.current = false;
      checkInForcedNextRef.current = null;
      resetCheckInSchedule(mode, initialTime, elapsedSec);
    } else {
      advanceCheckInScheduleAfterResult(elapsedSec);
    }

    const focusedMessages = getFocusedCheckInMessages(preferredName);
    const randomMessage = focusedMessages[Math.floor(Math.random() * focusedMessages.length)];

    if (isCompact) {
      clearCheckInUi();
      checkInReturnToCompactRef.current = false;
      checkInReturnToFloatingRef.current = false;
      pendingCompactRestoreRef.current = false;

      if (shouldReturnToFloating) {
        showToast('success', randomMessage, 2000, {
          showIcon: false,
          showCloseButton: false,
          placement: 'pill-center',
          source: 'checkin-success',
        });
        setCompactSuccessCueSignal((prev) => prev + 1);
        compactSuccessReturnTimerRef.current = setTimeout(() => {
          compactSuccessReturnTimerRef.current = null;
          restoreDisplayMode({ returnToFloating: true });
        }, 2000);
        return;
      }

      showToast('success', randomMessage, 2000, {
        showIcon: false,
        showCloseButton: false,
        placement: 'pill-center',
        source: 'checkin-success',
      });
      setCompactSuccessCueSignal((prev) => prev + 1);
      return;
    }

    showToast('success', randomMessage, 2000, {
      showIcon: false,
      showCloseButton: false,
      placement: isCompact ? 'pill-center' : 'window-center',
      source: 'checkin-success',
      zIndex: isCompact ? undefined : 180,
    });

    setCheckInMessage(randomMessage);
    setCheckInCelebrating(true);
    setCheckInCelebrationType('focused');
    triggerConfetti(1200);

    setCheckInState('resolved');
    if (checkInResolveTimeoutRef.current) clearTimeout(checkInResolveTimeoutRef.current);
    checkInResolveTimeoutRef.current = setTimeout(() => {
      clearCheckInUi();
      restoreDisplayMode({ returnToCompact: shouldReturnToCompact, returnToFloating: shouldReturnToFloating });
    }, 2000);
  }, [
    advanceCheckInScheduleAfterResult,
    clearCheckInUi,
    getElapsedSeconds,
    logCheckIn,
    initialTime,
    isCompact,
    mode,
    preferredName,
    resetCheckInSchedule,
    restoreDisplayMode,
    showToast,
    triggerConfetti,
  ]);

  const openCheckInDetourChoice = useCallback(() => {
    if (checkInStateRef.current !== 'prompting') return;
    // Synchronously move the ref out of 'prompting' so the scheduling
    // effect cannot log a "missed" check-in during the async compact exit.
    checkInStateRef.current = 'detour-choice';
    checkInPromptSurfaceRef.current = 'full';
    const applyDetourChoiceState = () => {
      setCheckInState('detour-choice');
      setCheckInMessage('');
      setCheckInCelebrating(false);
      setCheckInCelebrationType('none');
    };

    if (isCompact) {
      if (!checkInReturnToCompactRef.current && !checkInReturnToFloatingRef.current) {
        checkInReturnToCompactRef.current = true;
      }
      exitCompactForReturnDetour(() => {
        applyDetourChoiceState();
      }, 120);
      return;
    }

    applyDetourChoiceState();
  }, [exitCompactForReturnDetour, isCompact]);

  useEffect(() => {
    if (checkInState !== 'prompting') return undefined;

    const handleKeyDown = (event) => {
      if (event.defaultPrevented) return;
      if (isEditableShortcutTarget(event.target)) return;

      const primaryHeld = /Mac/i.test(navigator.platform || '') ? event.metaKey : event.ctrlKey;
      const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
      const code = typeof event.code === 'string' ? event.code : '';
      const isYesShortcut = key === 'y' || code === 'KeyY';
      if (!primaryHeld || !event.shiftKey || event.altKey || !isYesShortcut) return;

      event.preventDefault();
      void resolveCheckIn('focused');
    };

    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [checkInState, resolveCheckIn]);

  useEffect(() => {
    window.electronAPI.setCheckInShortcutState?.({
      visible: checkInState === 'prompting',
    });

    return () => {
      window.electronAPI.setCheckInShortcutState?.({ visible: false });
    };
  }, [checkInState]);

  useEffect(() => {
    const cleanup = window.electronAPI.onScopedCheckInShortcut?.((action) => {
      if (action !== 'focused') return;
      void resolveCheckIn('focused');
    });
    return () => { if (cleanup) cleanup(); };
  }, [resolveCheckIn]);

  const handleCheckInFinished = useCallback(async () => {
    if (checkInStateRef.current !== 'detour-choice') return;
    checkInStateRef.current = 'resolved'; // guard against double-click race
    if (checkInResolveTimeoutRef.current) clearTimeout(checkInResolveTimeoutRef.current);
    const shouldReturnToCompact = checkInReturnToCompactRef.current;
    const shouldReturnToFloating = checkInReturnToFloatingRef.current;
    pendingCompactRestoreRef.current = false;
    checkInReturnToCompactRef.current = false;
    checkInReturnToFloatingRef.current = false;

    const elapsedSec = getElapsedSeconds();
    await logCheckIn('completed', elapsedSec);
    track('checkin_responded', { response: 'completed' });

    setIsRunning(false);
    const completedMessage = showCompletedSessionMessage();
    setCheckInState('resolved');
    setCheckInMessage(completedMessage);
    setCheckInCelebrating(true);
    setCheckInCelebrationType('completed');
    triggerConfetti(2200);

    checkInResolveTimeoutRef.current = setTimeout(async () => {
      await completeSessionFromCheckIn(elapsedSec);
      openPostSessionTransition({
        taskText: task,
        recap: contextNotes,
        nextSteps: nextStepsNotes,
        sessionId: null,
        carryoverSeconds: 0,
      });
    }, 2000);
  }, [completeSessionFromCheckIn, contextNotes, getElapsedSeconds, logCheckIn, nextStepsNotes, showCompletedSessionMessage, task, triggerConfetti]);

  const handleCheckInDetour = useCallback(async () => {
    if (checkInStateRef.current !== 'detour-choice') return;
    checkInStateRef.current = 'detour-resolved'; // guard against double-click race
    if (checkInResolveTimeoutRef.current) clearTimeout(checkInResolveTimeoutRef.current);

    const elapsedSec = getElapsedSeconds();
    await logCheckIn('detour', elapsedSec);
    track('checkin_responded', { response: 'detour' });

    const shortInterval = getShortCheckInIntervalSeconds(mode, initialTime);
    checkInShortIntervalRef.current = true;
    checkInForcedNextRef.current = elapsedSec + shortInterval;

    setCheckInState('detour-resolved');
    setCheckInMessage(CHECKIN_DETOUR_MESSAGES[Math.floor(Math.random() * CHECKIN_DETOUR_MESSAGES.length)]);
    setCheckInCelebrating(false);
    setCheckInCelebrationType('none');
  }, [getElapsedSeconds, getShortCheckInIntervalSeconds, initialTime, logCheckIn, mode]);

  const handleCheckInDetourDismiss = useCallback(() => {
    if (checkInResolveTimeoutRef.current) clearTimeout(checkInResolveTimeoutRef.current);
    const shouldReturnToCompact = checkInReturnToCompactRef.current;
    const shouldReturnToFloating = checkInReturnToFloatingRef.current;
    checkInReturnToCompactRef.current = false;
    checkInReturnToFloatingRef.current = false;
    triggerPulse('celebration', 1);
    setCheckInCelebrating(true);
    setCheckInCelebrationType('focused');
    checkInResolveTimeoutRef.current = setTimeout(() => {
      clearCheckInUi();
      restoreDisplayMode({ returnToCompact: shouldReturnToCompact, returnToFloating: shouldReturnToFloating });
    }, 700);
  }, [clearCheckInUi, restoreDisplayMode, triggerPulse]);

  const hasBlockingWindowOpen =
    showSettings ||
    showHistoryModal ||
    showTaskPreview ||
    distractionJarOpen ||
    Boolean(postSessionParkingLotSessionId) ||
    showPostSessionPrompt ||
    showTimeUpModal ||
    showNotesModal ||
    showQuickCapture ||
    showTimerValidationModal;

  const reentryHardResetRequired =
    !sessionStateHydrated ||
    startupGateState !== 'ready' ||
    !startupRevealComplete ||
    isRunning;

  const reentryPausedByBlocker =
    dndEnabled ||
    hasBlockingWindowOpen ||
    isStartModalOpen;

  useEffect(() => {
    const handleMaybeReopen = () => {
      if (!reentrySnoozeUntilReopenRef.current) return;
      if (document.visibilityState !== 'visible') return;
      reentrySnoozeUntilReopenRef.current = false;
      reentrySnoozeUntilRef.current = 0;
      reentryRemainingMsRef.current = REENTRY_DELAY_MS;
      reentryEligibleSinceRef.current = null;
      reentryNextCueAtRef.current = null;
    };

    document.addEventListener('visibilitychange', handleMaybeReopen);
    window.addEventListener('focus', handleMaybeReopen);
    return () => {
      document.removeEventListener('visibilitychange', handleMaybeReopen);
      window.removeEventListener('focus', handleMaybeReopen);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      const now = Date.now();

      if (reentryHardResetRequired) {
        resetReentryAttention();
        return;
      }

      if (reentrySnoozeUntilReopenRef.current) {
        closeFloatingReentryPrompt();
        return;
      }

      if (reentrySnoozeUntilRef.current > now) {
        closeFloatingReentryPrompt();
        return;
      }

      if (postSessionBreakUntilRef.current > now) {
        closeFloatingReentryPrompt();
        setReentryAttentionVisible(false);
        setReentryStrongActive(false);
        return;
      }

      if (reentryPausedByBlocker) {
        pauseReentryAttention(now);
        return;
      }

      if (postSessionBreakPromptPendingRef.current) {
        postSessionBreakPromptPendingRef.current = false;
        setFloatingBreakState({ open: false });
        reentryEligibleSinceRef.current = now;
        reentryNextCueAtRef.current = now + REENTRY_LOOP_MS;
        reentryRemainingMsRef.current = null;
        fireReentryCue();
      }

      if (!Number.isFinite(reentryNextCueAtRef.current)) {
        const pausedRemaining = Number.isFinite(reentryRemainingMsRef.current)
          ? Math.max(0, reentryRemainingMsRef.current)
          : REENTRY_DELAY_MS;
        reentryEligibleSinceRef.current = now;
        reentryNextCueAtRef.current = now + pausedRemaining;
        reentryRemainingMsRef.current = null;
      }

      if (now >= reentryNextCueAtRef.current) {
        fireReentryCue();
        reentryNextCueAtRef.current = now + REENTRY_LOOP_MS;
      }

      const isFloatingMinimized = await window.electronAPI.getFloatingMinimized?.();
      if (cancelled) return;

      if (reentryAttentionVisibleRef.current && isFloatingMinimized) {
        showFloatingReentryPrompt();
      } else {
        closeFloatingReentryPrompt();
      }
    };

    void tick();
    const intervalId = window.setInterval(() => {
      void tick();
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    closeFloatingReentryPrompt,
    fireReentryCue,
    pauseReentryAttention,
    showPostSessionPrompt,
    reentryHardResetRequired,
    reentryPausedByBlocker,
    resetReentryAttention,
    setFloatingBreakState,
    showFloatingReentryPrompt,
  ]);

  const triggerCheckInPrompt = useCallback(async ({ skipCooldown = false } = {}) => {
    if (!checkInSettings.enabled) return false;
    if (dndEnabled) return false;
    if (hasBlockingWindowOpen) return false;
    if (!isRunning) return false;
    if (!task.trim()) return false;
    if (!skipCooldown && Date.now() < checkInPromptCooldownUntilRef.current) return false;
    if (!currentSessionId) {
      void ensureCurrentSessionId('check-in prompt');
    }
    if (checkInStateRef.current !== 'idle') return false;

    track('checkin_triggered', { mode, elapsed_minutes: Math.round(getElapsedSeconds() / 6) / 10 });
    if (!skipCooldown) {
      checkInPromptCooldownUntilRef.current = Date.now() + CHECKIN_PROMPT_COOLDOWN_MS;
    }

    const openFullPrompt = () => {
      if (checkInStateRef.current !== 'idle' || !isRunningRef.current) return;
      checkInPromptSurfaceRef.current = 'full';
      pendingCompactCheckInPromptRef.current = false;
      checkInStateRef.current = 'prompting';
      setCheckInState('prompting');
      setCheckInMessage('');
      setCheckInCelebrating(false);
      setCheckInCelebrationType('none');
      ensureWindowSizeForCurrentScreen(WINDOW_SIZES.timerCheckInPromptHeight);
    };

    const restoredFromFloating = await window.electronAPI.getFloatingMinimized?.() || false;
    const compactPromptRequested = isCompact
      || windowModeDesiredRef.current === 'pill'
      || windowModeActualRef.current === 'pill';
    const shouldReturnToCompact = !restoredFromFloating && compactPromptRequested;
    const shouldUseCompactPrompt = compactPromptRequested || restoredFromFloating;

    checkInReturnToFloatingRef.current = Boolean(restoredFromFloating);
    checkInReturnToCompactRef.current = shouldReturnToCompact;

    if (shouldUseCompactPrompt && restoredFromFloating) {
      pendingCompactRestoreRef.current = false;
      checkInPromptSurfaceRef.current = 'compact';
      pendingCompactCheckInPromptRef.current = true;
      // When floating originated from an already-compact session, React state is
      // still "pill", so setIsCompact(true) would be a no-op. In that case the
      // main window has already been restored at pill bounds; we just need to
      // reveal it and open the compact prompt. Full-window floating sessions
      // still need the normal compact-entry handoff.
      void Promise.resolve(window.electronAPI.exitFloatingForCompact?.()).then(() => {
        if (compactPromptRequested) {
          window.electronAPI.bringToFront?.();
          openCompactCheckInPrompt();
          return;
        }
        requestCompactEntry({ restorePreviousBounds: false, delayMs: 80 });
      });
      return true;
    }

    if (shouldUseCompactPrompt) {
      openCompactCheckInPrompt();
      return true;
    }

    openFullPrompt();
    // Keep the prompt open until the user explicitly responds.
    return true;
  }, [checkInSettings.enabled, dndEnabled, hasBlockingWindowOpen, isRunning, isTimerVisible, task, currentSessionId, ensureCurrentSessionId, mode, getElapsedSeconds, isCompact, openCompactCheckInPrompt, requestCompactEntry]);

  useEffect(() => {
    triggerCheckInPromptRef.current = triggerCheckInPrompt;
  }, [triggerCheckInPrompt]);

  useEffect(() => {
    checkInStateRef.current = checkInState;
  }, [checkInState]);

  useEffect(() => {
    if (!isCompact) return;
    if (!pendingCompactCheckInPromptRef.current) return;
    openCompactCheckInPrompt();
  }, [isCompact, openCompactCheckInPrompt]);

  useEffect(() => {
    if (checkInState !== 'prompting') return undefined;
    if (checkInPromptSurfaceRef.current !== 'full') return undefined;

    let cancelled = false;

    const revealPromptInMainWindow = async () => {
      const restoredFromFloating = await window.electronAPI.getFloatingMinimized?.() || false;
      if (cancelled) return;

      if (restoredFromFloating) {
        if (!checkInReturnToFloatingRef.current && !checkInReturnToCompactRef.current) {
          checkInReturnToFloatingRef.current = true;
        }
        pendingCompactRestoreRef.current = false;
        window.electronAPI.bringToFront?.();
        setTimeout(() => {
          ensureWindowSizeForCurrentScreen(WINDOW_SIZES.timerCheckInPromptHeight);
        }, 160);
        return;
      }

      if (!isCompact) return;

      if (!checkInReturnToCompactRef.current && !checkInReturnToFloatingRef.current) {
        checkInReturnToCompactRef.current = true;
      }
      exitCompactForReturnDetour(() => {
        ensureWindowSizeForCurrentScreen(WINDOW_SIZES.timerCheckInPromptHeight);
      }, 140);
    };

    void revealPromptInMainWindow();

    return () => {
      cancelled = true;
    };
  }, [checkInState, exitCompactForReturnDetour, isCompact, startupGateState]);

  // When check-ins are disabled mid-session, clean up runtime state
  useEffect(() => {
    if (!checkInSettings.enabled) {
      clearCheckInRuntime();
    }
  }, [checkInSettings.enabled, clearCheckInRuntime]);

  useEffect(() => {
    if (!isRunning) return;

    const elapsed = getElapsedSeconds();

    if (mode === 'freeflow') {
      let crossedThreshold = false;
      if (!Number.isFinite(freeflowPulseNextRef.current)) {
        freeflowPulseNextRef.current = getNextFreeflowPulseTarget(elapsed);
      }
      while (Number.isFinite(freeflowPulseNextRef.current) && elapsed >= freeflowPulseNextRef.current) {
        freeflowPulseNextRef.current += FREEFLOW_PULSE_INTERVAL_SECONDS;
        crossedThreshold = true;
      }
      if (crossedThreshold && pulseSettings.compactEnabled && !dndEnabled && !hasBlockingWindowOpen && checkInStateRef.current === 'idle') {
        if (isCompact) {
          setCompactPulseSignal((prev) => prev + 1);
        } else {
          triggerPulse('gentle', 2);
        }
        window.electronAPI.triggerFloatingPulse?.();
      }
      return;
    }

    if (mode === 'timed') {
      const thresholds = compactPulseThresholdsRef.current;
      const segmentElapsed = getTimedCueSegmentElapsed(elapsed);
      const previousSegmentElapsed = timedPulseLastSegmentElapsedRef.current;
      let crossedThreshold = false;

      if (!thresholds.length) {
        timedPulseLastElapsedRef.current = elapsed;
        timedPulseLastSegmentElapsedRef.current = segmentElapsed;
        return;
      }

      while (
        compactPulseIndexRef.current < thresholds.length
        && segmentElapsed >= thresholds[compactPulseIndexRef.current]
      ) {
        const threshold = thresholds[compactPulseIndexRef.current];
        if (previousSegmentElapsed < threshold) {
          crossedThreshold = true;
        }
        compactPulseIndexRef.current += 1;
      }

      timedPulseLastElapsedRef.current = elapsed;
      timedPulseLastSegmentElapsedRef.current = segmentElapsed;

      if (crossedThreshold && pulseSettings.compactEnabled && !dndEnabled && !hasBlockingWindowOpen && checkInStateRef.current === 'idle') {
        if (isCompact) {
          setCompactPulseSignal((prev) => prev + 1);
        } else {
          triggerPulse('gentle', 2);
        }
        window.electronAPI.triggerFloatingPulse?.();
      }
      return;
    }

    timedPulseLastElapsedRef.current = elapsed;
    timedPulseLastSegmentElapsedRef.current = 0;
  // Note: checkInStateRef (not checkInState) is used for pulse suppression to
  // avoid stale-state races where a pulse and check-in fire in the same render.
  }, [time, isRunning, mode, getElapsedSeconds, getTimedCueSegmentElapsed, isCompact, pulseSettings.compactEnabled, dndEnabled, hasBlockingWindowOpen, triggerPulse]);

  useEffect(() => {
    if (!isRunning || !task.trim() || !checkInSettings.enabled) {
      return;
    }

    const elapsed = getElapsedSeconds();

    if (mode === 'freeflow') {
      // Forced short-interval check-in (after detour/miss)
      const forcedReached = Number.isFinite(checkInForcedNextRef.current) && elapsed >= checkInForcedNextRef.current;

      // Lazy-init freeflow schedule if not yet set
      if (!Number.isFinite(checkInFreeflowNextRef.current)) {
        const intervalSeconds = getStandardCheckInIntervalSeconds('freeflow', initialTime);
        checkInFreeflowNextRef.current = elapsed + intervalSeconds;
      }
      const standardReached = elapsed >= checkInFreeflowNextRef.current;

      // If a check-in is already showing and a genuinely NEW threshold has been
      // reached (i.e. the schedule has advanced past the one that originally
      // triggered the prompt), log the current prompt as missed and fall through
      // to fire a fresh one.
      if (checkInStateRef.current === 'prompting') {
        // The prompt that is currently showing was fired at (or before) the
        // current checkInFreeflowNextRef / checkInForcedNextRef.  A *new*
        // threshold means one of these refs has been advanced past the prompt's
        // origin point — which only happens when the standard schedule rolls
        // forward.  Because we advance the ref immediately after firing (see
        // below), re-entering this effect on the *same* threshold will see
        // standardReached === false.  Only a genuinely new threshold will be
        // true here.
        const newThresholdReached = standardReached || forcedReached;
        if (newThresholdReached) {
          logMissedCheckInIfPrompting(elapsed);
          // Fall through to fire the new prompt below
        } else {
          return;
        }
      } else if (checkInStateRef.current !== 'idle') {
        return;
      }

      if (forcedReached) {
        void Promise.resolve(triggerCheckInPromptRef.current()).then((fired) => {
          if (fired) {
            checkInForcedNextRef.current = null;
          }
        });
        return;
      }

      if (standardReached) {
        const intervalSeconds = getStandardCheckInIntervalSeconds('freeflow', initialTime);
        void Promise.resolve(triggerCheckInPromptRef.current()).then((fired) => {
          if (!fired) return;
          // Only advance the schedule when the prompt actually opens.
          // If DND or another blocker suppresses it, keep the threshold hot so
          // the prompt can appear as soon as the blocker is cleared.
          checkInFreeflowNextRef.current = elapsed + intervalSeconds;
        });
      }
      return;
    }

    // Timed mode — fire only on the actual 40% / 80% crossings.
    const thresholds = checkInTimedThresholdsRef.current;
    const segmentElapsed = getTimedCueSegmentElapsed(elapsed);
    const previousSegmentElapsed = timedCheckInLastSegmentElapsedRef.current;
    let blockedAtThreshold = false;

    while (
      checkInTimedIndexRef.current < thresholds.length
      && segmentElapsed >= thresholds[checkInTimedIndexRef.current]
    ) {
      const threshold = thresholds[checkInTimedIndexRef.current];
      const crossedThisTick = previousSegmentElapsed < threshold;

      if (crossedThisTick) {
        if (checkInStateRef.current === 'prompting') {
          logMissedCheckInIfPrompting(elapsed);
          // checkInStateRef is now 'idle', fall through to fire new prompt
        } else if (checkInStateRef.current !== 'idle') {
          blockedAtThreshold = true; break;
        }
        const fired = triggerCheckInPromptRef.current({ skipCooldown: true });
        if (!fired) { blockedAtThreshold = true; break; }
      }

      checkInTimedIndexRef.current += 1;
    }

    // Forced short-interval check-in for timed mode (after detour/miss)
    if (
      !blockedAtThreshold
      && Number.isFinite(checkInForcedNextRef.current)
      && elapsed >= checkInForcedNextRef.current
    ) {
      checkInForcedNextRef.current = null;
      if (checkInStateRef.current === 'prompting') {
        logMissedCheckInIfPrompting(elapsed);
      }
      if (checkInStateRef.current === 'idle') {
        triggerCheckInPromptRef.current({ skipCooldown: true });
      }
    }

    timedCheckInLastElapsedRef.current = elapsed;
    if (!blockedAtThreshold) {
      timedCheckInLastSegmentElapsedRef.current = segmentElapsed;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time]);

  useEffect(() => {
    const wasDndEnabled = prevDndEnabledRef.current;
    prevDndEnabledRef.current = dndEnabled;

    if (!wasDndEnabled || dndEnabled) return;
    if (!isRunning || mode !== 'freeflow' || !checkInSettings.enabled) return;

    const elapsed = getElapsedSeconds();
    if (!Number.isFinite(checkInFreeflowNextRef.current) || elapsed < checkInFreeflowNextRef.current) return;

    const intervalSeconds = getStandardCheckInIntervalSeconds('freeflow', initialTime);
    void Promise.resolve(triggerCheckInPromptRef.current()).then((fired) => {
      if (!fired) return;
      checkInFreeflowNextRef.current = elapsed + intervalSeconds;
    });
  }, [checkInSettings.enabled, dndEnabled, getElapsedSeconds, getStandardCheckInIntervalSeconds, initialTime, isRunning, mode]);

  // Timer logic — counts up (freeflow) or down (timed)
  useEffect(() => {
    if (!isRunning) {
      syncDisplayedTime(elapsedBeforeRunRef.current);
      return () => clearInterval(timerRef.current);
    }

    const tick = () => {
      syncDisplayedTime(getElapsedSeconds());
    };

    tick();
    timerRef.current = setInterval(tick, 250);
    return () => clearInterval(timerRef.current);
  }, [isRunning, getElapsedSeconds, syncDisplayedTime]);

  // Handle timed session expiration — separated from setTime to avoid
  // calling state setters inside another state setter callback.
  // Guard off 00:00 itself so timed sessions cannot get stranded in
  // compact or floating shells without showing the full Time Up flow.
  useEffect(() => {
    if (mode !== 'timed' || initialTime <= 0) {
      timeUpTriggerKeyRef.current = '';
      return undefined;
    }
    if (time !== 0) {
      timeUpTriggerKeyRef.current = '';
      return undefined;
    }
    if (showTimeUpModal || showNotesModal) return undefined;

    const triggerKey = [
      currentSessionId || 'no-session',
      initialTime,
      timedCueSegmentStartElapsedRef.current,
      timedCueSegmentDurationRef.current,
    ].join(':');

    if (timeUpTriggerKeyRef.current === triggerKey) return undefined;
    timeUpTriggerKeyRef.current = triggerKey;

    let cancelled = false;
    const wasCompact = isCompact;

    const showTimeUpFlow = async () => {
      const restoredFromFloating = await window.electronAPI.restoreFromFloatingForTimeUp?.() || false;
      if (cancelled) return;

      if (wasCompact) {
        captureCompactReturnBounds();
      }

      elapsedBeforeRunRef.current = Math.max(0, initialTime);
      timeUpReturnToFloatingRef.current = Boolean(restoredFromFloating);
      timeUpReturnToCompactRef.current = restoredFromFloating ? false : wasCompact;
      logMissedCheckInIfPrompting(initialTime);
      setIsRunning(false);
      setIsCompact(false);
      setShowNotesModal(false);
      setSessionNotesMode('complete');
      setIsTimerVisible(true);
      setSessionStartTime(null);
      clearCompactSessionCues();
      beginSessionFeedbackFlow();
      sessionToSave.current = {
        duration: initialTime / 60,
        completed: true,
        sessionId: currentSessionId,
      };
      setShowTimeUpModal(true);
    };

    void showTimeUpFlow();

    return () => {
      cancelled = true;
    };
  }, [mode, time, initialTime, beginSessionFeedbackFlow, captureCompactReturnBounds, clearCompactSessionCues, currentSessionId, isCompact, logMissedCheckInIfPrompting, showNotesModal, showTimeUpModal]);

  useEffect(() => {
    if (!showTimeUpModal) return undefined;
    // Ensure enough full-window space so timeout actions are immediately visible.
    const resizeTimer = setTimeout(() => {
      ensureWindowSizeForCurrentScreen(WINDOW_SIZES.timeUpHeight);
    }, 80);
    return () => clearTimeout(resizeTimer);
  }, [showTimeUpModal, startupGateState]);

  // Actions
  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
    setIsThemeManual(true);
  };

  const handleToggleAlwaysOnTop = useCallback(async () => {
    try {
      const next = await window.electronAPI.toggleAlwaysOnTop();
      setIsAlwaysOnTop(Boolean(next));
      track('always_on_top_toggled', { enabled: Boolean(next), source: 'toolbar' });
    } catch (error) {
      console.error('Failed to toggle always-on-top:', error);
    }
  }, []);

  const handleMinimizeToFloating = () => {
    window.electronAPI.toggleFloatingMinimize?.();
  };

  const handleQuitApp = () => {
    window.electronAPI.quitApp?.();
  };

  const handleCloseParkingLot = useCallback(() => {
    setDistractionJarOpen(false);
    const shouldReturnToCompact = parkingLotReturnToCompactRef.current;
    const shouldReturnToFloating = parkingLotReturnToFloatingRef.current;
    const reopenedPrevModal = popAndOpenPrevModal();
    parkingLotReturnToCompactRef.current = false;
    parkingLotReturnToFloatingRef.current = false;
    if (!reopenedPrevModal && (shouldReturnToCompact || shouldReturnToFloating)) {
      restoreDisplayMode({ returnToCompact: shouldReturnToCompact, returnToFloating: shouldReturnToFloating });
      return;
    }
  }, [popAndOpenPrevModal, restoreDisplayMode]);

  const startPendingParkingLotTaskSwitch = useCallback(() => {
    const pendingSwitch = pendingParkingLotTaskSwitchRef.current;
    if (!pendingSwitch?.taskText) return false;
    pendingParkingLotTaskSwitchRef.current = null;
    return prepareTaskForStartChooserRef.current({
      taskText: pendingSwitch.taskText,
      notes: '',
      sessionId: null,
      carryoverSeconds: 0,
    });
  }, []);

  const handleCancelParkingLotTaskSwitch = useCallback(() => {
    setParkingLotTaskSwitchConfirm(null);
    handleCloseParkingLot();
    showToast('success', 'Saved in Parking Lot');
  }, [handleCloseParkingLot, showToast]);

  const handleCheckInParkIt = useCallback(() => {
    track('detour_parked');
    const shouldReturnToCompact = checkInReturnToCompactRef.current;
    const shouldReturnToFloating = checkInReturnToFloatingRef.current;
    checkInReturnToCompactRef.current = false;
    checkInReturnToFloatingRef.current = false;
    clearCheckInUi();
    // We're already in full view (exited compact for detour UI).
    // Pass the return intent to the parking lot flow.
    parkingLotReturnToCompactRef.current = shouldReturnToCompact;
    parkingLotReturnToFloatingRef.current = shouldReturnToFloating;
    setDistractionJarOpen(true);
  }, [clearCheckInUi]);

  const getStartupGateFallbackHeight = useCallback(() => {
    if (startupGateState === 'activation') return WINDOW_SIZES.startupActivationHeight;
    if (startupGateState === 'name') return WINDOW_SIZES.startupNameHeight;
    return WINDOW_SIZES.startupCheckingHeight;
  }, [startupGateState]);

  const measureStartupGateHeight = useCallback(() => {
    const card = startupGateCardRef.current;
    const measuredCardHeight = card
      ? Math.ceil(card.scrollHeight || card.getBoundingClientRect().height || 0)
      : 0;
    return Math.max(
      getStartupGateFallbackHeight(),
      measuredCardHeight + STARTUP_GATE_VERTICAL_PADDING,
    );
  }, [getStartupGateFallbackHeight]);

  const ensureWindowSizeForCurrentScreen = useCallback((height) => {
    const requestedHeight = Math.max(0, Math.round(Number(height) || 0));
    const targetHeight = startupGateState === 'ready'
      ? requestedHeight
      : Math.max(requestedHeight, measureStartupGateHeight());
    const targetWidth = fullWindowTargetWidthRef.current;

    window.electronAPI.ensureMainWindowSize?.(targetWidth, targetHeight);
  }, [measureStartupGateHeight, startupGateState]);

  const resizeToMainCardContent = useCallback((minHeight) => {
    const card = mainCardRef.current;
    const measuredHeight = card
      ? Math.ceil(card.scrollHeight || card.getBoundingClientRect().height || 0)
      : 0;
    const targetHeight = Math.max(minHeight, measuredHeight);
    ensureWindowSizeForCurrentScreen(targetHeight);
  }, [ensureWindowSizeForCurrentScreen]);

  const resizeToStartupGateContent = useCallback(() => {
    if (!startupRevealComplete) return;
    if (isCompact) return;
    if (startupGateState === 'ready') return;
    ensureWindowSizeForCurrentScreen(measureStartupGateHeight());
  }, [ensureWindowSizeForCurrentScreen, isCompact, measureStartupGateHeight, startupGateState, startupRevealComplete]);

  const getActiveScreenDefaultHeight = useCallback(() => {
    if (hasSavedContext) return WINDOW_SIZES.contextHeight;
    if (checkInState === 'prompting') return WINDOW_SIZES.timerCheckInPromptHeight;
    if (checkInState === 'detour-choice') return WINDOW_SIZES.timerCheckInDetourChoiceHeight;
    if (checkInState === 'detour-resolved') return WINDOW_SIZES.timerCheckInDetourResolvedHeight;
    if (checkInState === 'resolved' && showCenteredFullWindowCheckInToast) return WINDOW_SIZES.timerHeight;
    if (checkInState === 'resolved') return WINDOW_SIZES.timerCheckInResolvedHeight;
    return WINDOW_SIZES.timerHeight;
  }, [checkInState, hasSavedContext, showCenteredFullWindowCheckInToast]);

  const getIdleScreenDefaultHeight = useCallback(() => {
    if (startupGateState !== 'ready') return getStartupGateFallbackHeight();
    if (showSurfaceReentryPrompt) return WINDOW_SIZES.reentryPromptHeight;
    return isStartModalOpen ? WINDOW_SIZES.startChooserHeight : WINDOW_SIZES.idleHeight;
  }, [getStartupGateFallbackHeight, isStartModalOpen, showSurfaceReentryPrompt, startupGateState]);

  const getStartupTargetHeight = useCallback(() => {
    if (startupGateState !== 'ready') return measureStartupGateHeight();
    if (isStartModalOpen) return WINDOW_SIZES.startChooserHeight;

    const hasActiveStartupSurface = hasSavedContext
      || isRunning
      || isTimerVisible
      || checkInState !== 'idle'
      || showCenteredFullWindowCheckInToast;

    return hasActiveStartupSurface
      ? getActiveScreenDefaultHeight()
      : WINDOW_SIZES.idleHeight;
  }, [
    startupGateState,
    isStartModalOpen,
    hasSavedContext,
    isRunning,
    isTimerVisible,
    checkInState,
    showCenteredFullWindowCheckInToast,
    getActiveScreenDefaultHeight,
    measureStartupGateHeight,
  ]);

  const resyncFullWindowSize = useCallback(() => {
    if (!startupRevealComplete) return;
    if (isCompact) return;
    if (startupGateState !== 'ready') {
      resizeToStartupGateContent();
      return;
    }
    const minHeight = (isRunning || isTimerVisible)
      ? getActiveScreenDefaultHeight()
      : getIdleScreenDefaultHeight();
    resizeToMainCardContent(minHeight);
  }, [
    startupRevealComplete,
    isCompact,
    startupGateState,
    isRunning,
    isTimerVisible,
    resizeToStartupGateContent,
    resizeToMainCardContent,
    getActiveScreenDefaultHeight,
    getIdleScreenDefaultHeight,
  ]);

  const restoreTimeUpWindowShell = useCallback(({ returnToCompact = false, returnToFloating = false } = {}) => {
    if (returnToCompact || returnToFloating) {
      restoreDisplayMode({ returnToCompact, returnToFloating });
      return;
    }

    pendingCompactRestoreRef.current = false;
    setTimeout(() => {
      resyncFullWindowSize();
    }, 60);
    setTimeout(() => {
      resyncFullWindowSize();
    }, 200);
  }, [resyncFullWindowSize, restoreDisplayMode]);

  useEffect(() => {
    if (startupGateState === 'checking') return undefined;
    if (!shortcutsHydrated) return undefined;
    if (startupWindowShownRef.current || startupWindowShowPendingRef.current) return undefined;

    const targetHeight = getStartupTargetHeight();
    let cancelled = false;
    let settleTimer = 0;

    startupWindowShowPendingRef.current = true;
    // Use setTimeout instead of requestAnimationFrame — rAF never fires
    // for a hidden BrowserWindow (show: false), creating a deadlock where
    // the window waits for this call to show, but rAF waits for visibility.
    settleTimer = window.setTimeout(() => {
      if (cancelled) return;
      Promise.resolve(
        window.electronAPI.showMainWindowAfterStartup?.(WINDOW_SIZES.baseWidth, targetHeight)
      ).then((didShow) => {
        if (cancelled) return;
        if (didShow !== false) {
          startupWindowShownRef.current = true;
        }
      }).finally(() => {
        if (!cancelled) {
          startupWindowShowPendingRef.current = false;
          setStartupRevealComplete(true);
        }
      });
    }, 32);

    return () => {
      cancelled = true;
      startupWindowShowPendingRef.current = false;
      window.clearTimeout(settleTimer);
    };
  }, [startupGateState, shortcutsHydrated, getStartupTargetHeight]);

  const handleTaskInputHeightChange = useCallback(() => {
    if (isCompact) return;
    if (taskInputResizeTimerRef.current) {
      clearTimeout(taskInputResizeTimerRef.current);
    }
    taskInputResizeTimerRef.current = setTimeout(() => {
      resyncFullWindowSize();
      taskInputResizeTimerRef.current = null;
    }, 30);
  }, [isCompact, resyncFullWindowSize]);

  useEffect(() => () => {
    if (taskInputResizeTimerRef.current) {
      clearTimeout(taskInputResizeTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (isCompact || compactTransitioning || !didJustExitCompactRef.current) return undefined;

    const settleSoon = setTimeout(() => {
      resyncFullWindowSize();
    }, 50);
    const settleLater = setTimeout(() => {
      resyncFullWindowSize();
      didJustExitCompactRef.current = false;
    }, 180);

    return () => {
      clearTimeout(settleSoon);
      clearTimeout(settleLater);
    };
  }, [isCompact, compactTransitioning, task, resyncFullWindowSize]);

  useEffect(() => {
    if (!startupRevealComplete) return undefined;
    if (isCompact) return undefined;
    if (isPulsing === 'gentle') return undefined;
    const t = setTimeout(() => {
      resyncFullWindowSize();
    }, 40);
    return () => clearTimeout(t);
  }, [startupRevealComplete, isCompact, isPulsing, resyncFullWindowSize]);

  useLayoutEffect(() => {
    if (!startupRevealComplete) return undefined;
    if (isCompact) return undefined;
    if (startupGateState === 'ready') return undefined;

    let syncTimer = 0;
    let settleTimer = 0;
    let observer = null;

    const syncGateSize = () => {
      resizeToStartupGateContent();
    };

    syncTimer = window.setTimeout(syncGateSize, 0);
    settleTimer = window.setTimeout(syncGateSize, 120);

    if (typeof ResizeObserver !== 'undefined' && startupGateCardRef.current) {
      observer = new ResizeObserver(() => {
        syncGateSize();
      });
      observer.observe(startupGateCardRef.current);
    }

    return () => {
      window.clearTimeout(syncTimer);
      window.clearTimeout(settleTimer);
      if (observer) observer.disconnect();
    };
  }, [isCompact, resizeToStartupGateContent, startupGateState, startupRevealComplete]);

  // Hard guard: when truly idle, force the compact full-screen height target.
  // This prevents stale larger bounds after compact->full race conditions.
  useEffect(() => {
    if (!startupRevealComplete) return;
    if (startupGateState !== 'ready') return;
    if (isCompact) return;
    if (isRunning) return;
    if (isTimerVisible) return;
    if (showSurfaceReentryPrompt) {
      ensureWindowSizeForCurrentScreen(WINDOW_SIZES.reentryPromptHeight);
      const promptTimer = setTimeout(() => {
        ensureWindowSizeForCurrentScreen(WINDOW_SIZES.reentryPromptHeight);
      }, 100);
      return () => clearTimeout(promptTimer);
    }
    if (isStartModalOpen) return;
    if (hasSavedContext) return;
    if (task.trim()) return;
    ensureWindowSizeForCurrentScreen(WINDOW_SIZES.idleHeight);
    const t = setTimeout(() => {
      ensureWindowSizeForCurrentScreen(WINDOW_SIZES.idleHeight);
    }, 100);
    return () => clearTimeout(t);
  }, [ensureWindowSizeForCurrentScreen, hasSavedContext, showSurfaceReentryPrompt, startupRevealComplete, startupGateState, isCompact, isRunning, isTimerVisible, isStartModalOpen, task]);

  const handlePlay = useCallback(() => {
    const trimmedTask = task.trim();
    if (!trimmedTask) return;

    if (!isTimerVisible) {
      setIsTimerVisible(true);
    }
    resumeActiveTimer('compact play');
  }, [task, isTimerVisible, resumeActiveTimer]);

  const handlePause = useCallback(() => {
    if (!isRunning) return;
    pauseActiveTimer();
  }, [isRunning, pauseActiveTimer]);

  const handleStop = useCallback((options = {}) => {
    const explicitReturnToFloating = options?.returnToFloating;
    const explicitReturnToCompact = options?.returnToCompact;
    const returnToFloating = explicitReturnToFloating === true;
    const returnToCompact = returnToFloating
      ? false
      : explicitReturnToCompact === true
        ? true
        : explicitReturnToCompact === false
          ? false
          : isCompact;
    stopFlowResumeStateRef.current = {
      canResume: true,
      returnToCompact,
      returnToFloating,
    };
    const elapsedSeconds = isRunning ? pauseActiveTimer() : getElapsedSeconds();
    clearCompactSessionCues();
    if (isCompact) {
      handleExitCompact();
    }
    beginSessionFeedbackFlow();
    sessionToSave.current = {
      duration: elapsedSeconds / 60,
      completed: false,
      sessionId: currentSessionId,
    };
    setSessionNotesMode('stop-decision');
    setShowNotesModal(true);
  }, [clearCompactSessionCues, currentSessionId, getElapsedSeconds, handleExitCompact, isCompact, isRunning, pauseActiveTimer]);

  const handleConfirmParkingLotTaskSwitch = useCallback(() => {
    if (!parkingLotTaskSwitchConfirm?.taskText) return;

    pendingParkingLotTaskSwitchRef.current = {
      thoughtId: parkingLotTaskSwitchConfirm.thoughtId,
      taskText: parkingLotTaskSwitchConfirm.taskText,
    };

    const returnToCompact = parkingLotTaskSwitchConfirm.returnToCompact === true;
    const returnToFloating = parkingLotTaskSwitchConfirm.returnToFloating === true;

    setParkingLotTaskSwitchConfirm(null);
    setDistractionJarOpen(false);
    parkingLotReturnToCompactRef.current = false;
    parkingLotReturnToFloatingRef.current = false;
    handleStop({ returnToCompact, returnToFloating });
  }, [handleStop, parkingLotTaskSwitchConfirm]);

  const handleResumeStopFlow = useCallback(() => {
    const {
      canResume,
      returnToCompact = false,
      returnToFloating = false,
    } = stopFlowResumeStateRef.current || {};

    if (!canResume) return;

    stopFlowResumeStateRef.current = {
      canResume: false,
      returnToCompact: false,
      returnToFloating: false,
    };
    postSessionNotesActionRef.current = null;
    sessionToSave.current = null;
    pendingParkingLotTaskSwitchRef.current = null;
    setShowNotesModal(false);
    setSessionNotesMode('complete');
    resetSessionFeedbackFlow();
    resumeActiveTimer('stop decision resume');
    window.setTimeout(() => {
      restoreDisplayMode({ returnToCompact, returnToFloating });
    }, 40);
  }, [resetSessionFeedbackFlow, restoreDisplayMode, resumeActiveTimer]);

  useEffect(() => {
    const cleanup = window.electronAPI.onFloatingTimerAction?.((action) => {
      if (action === 'startPause') {
        if (isRunning) {
          handlePause();
        } else {
          handlePlay();
        }
        return;
      }
      if (action === 'stop') {
        handleStop({ returnToFloating: true });
      }
    });
    return () => { if (cleanup) cleanup(); };
  }, [handlePause, handlePlay, handleStop, isRunning]);

  useEffect(() => {
    const cleanup = window.electronAPI.onSystemSuspendPaused?.((payload) => {
      applyPausedTimerSnapshot(payload);
      showToast('info', 'Session paused while your Mac slept');
    });
    return () => { if (cleanup) cleanup(); };
  }, [applyPausedTimerSnapshot, showToast]);

  useEffect(() => {
    const handleVisibilityResume = () => {
      if (document.visibilityState !== 'visible') return;
      void reconcilePausedTimerSnapshotFromStore();
    };
    const handleFocusResume = () => {
      void reconcilePausedTimerSnapshotFromStore();
    };

    document.addEventListener('visibilitychange', handleVisibilityResume);
    window.addEventListener('focus', handleFocusResume);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityResume);
      window.removeEventListener('focus', handleFocusResume);
    };
  }, [reconcilePausedTimerSnapshotFromStore]);

  const openResumeCandidateInStartChooser = useCallback((candidate = reentryResumeCandidateRef.current) => {
    if (!candidate?.taskText) return false;
    const prepared = prepareTaskForStartChooserRef.current({
      taskText: candidate.taskText,
      recap: typeof candidate.recap === 'string' ? candidate.recap : (typeof candidate.notes === 'string' ? candidate.notes : ''),
      nextSteps: typeof candidate.nextSteps === 'string' ? candidate.nextSteps : '',
      sessionId: candidate.sessionId || null,
      carryoverSeconds: Math.max(0, Math.floor(Number(candidate.carryoverSeconds) || 0)),
    });
    if (!prepared) return false;
    resetReentryAttention();
    return true;
  }, [resetReentryAttention]);

  const handleTaskSubmit = (submittedTask = task) => {
    const nextTask = clampTaskText(typeof submittedTask === 'string' ? submittedTask : task);
    const trimmedTask = nextTask.trim();
    if (!trimmedTask) return;
    if (nextTask !== task) {
      setTask(nextTask);
    }

    const hasPausedSessionToResume =
      isTimerVisible &&
      !isRunning &&
      (time > 0 || mode !== 'freeflow' || initialTime > 0 || elapsedBeforeRunRef.current > 0);

    if (hasPausedSessionToResume) {
      setIsStartModalOpen(false);
      handlePlay();
      return;
    }

    if (
      !isTimerVisible
      && !isRunning
      && reentryAttentionVisibleRef.current
      && reentryResumeCandidateRef.current
    ) {
      if (openResumeCandidateInStartChooser(reentryResumeCandidateRef.current)) {
        return;
      }
    }

    setIsStartModalOpen(true);
  };

  const handleStartSession = async (selectedMode, minutes, options = {}) => {
    let createdSessionId = null;
    const hasTaskOverride = Object.prototype.hasOwnProperty.call(options, 'taskText');
    const hasNotesOverride = Object.prototype.hasOwnProperty.call(options, 'notes');
    const hasSessionIdOverride = Object.prototype.hasOwnProperty.call(options, 'sessionId');
    const hasCarryoverOverride = Object.prototype.hasOwnProperty.call(options, 'carryoverSeconds');
    const rawTaskText = hasTaskOverride ? options.taskText : task;
    const nextTaskText = clampTaskText(typeof rawTaskText === 'string' ? rawTaskText : task).trim();
    if (!nextTaskText) return;

    postSessionBreakUntilRef.current = 0;
    postSessionBreakPromptPendingRef.current = false;
    setFloatingBreakState({ open: false });

    const nextNotes = hasNotesOverride
      ? (typeof options.notes === 'string' ? options.notes : '')
      : contextNotes;
    const nextNextSteps = typeof options.nextSteps === 'string'
      ? options.nextSteps
      : nextStepsNotes;
    const nextSessionId = hasSessionIdOverride
      ? (typeof options.sessionId === 'string' && options.sessionId.trim() ? options.sessionId.trim() : null)
      : currentSessionId;
    const resumeCarryoverSeconds = Math.max(
      0,
      Math.floor(Number(hasCarryoverOverride ? options.carryoverSeconds : historyResumeCarryoverSecondsRef.current) || 0),
    );

    if (hasTaskOverride && nextTaskText !== task) {
      setTask(nextTaskText);
    }
    if (hasNotesOverride && nextNotes !== contextNotes) {
      setContextNotes(nextNotes);
    }
    if (Object.prototype.hasOwnProperty.call(options, 'nextSteps') && nextNextSteps !== nextStepsNotes) {
      setNextStepsNotes(nextNextSteps);
    }
    if (hasSessionIdOverride && nextSessionId !== currentSessionId) {
      setCurrentSessionId(nextSessionId);
    }
    setPostSessionResumeCandidate(null);
    setPostSessionStartAssist(false);
    try {
      if (nextSessionId) {
        const updated = await SessionStore.update(nextSessionId, {
          task: nextTaskText,
          mode: selectedMode,
          completed: false,
          notes: nextNotes || '',
          recap: nextNotes || '',
          nextSteps: nextNextSteps || '',
        });
        createdSessionId = updated?.id || nextSessionId;
        await loadSessions();
      } else {
        const created = await SessionStore.create({
          task: nextTaskText,
          duration_minutes: 0,
          mode: selectedMode,
          completed: false,
          notes: nextNotes || '',
          recap: nextNotes || '',
          nextSteps: nextNextSteps || '',
        });
        createdSessionId = created?.id || null;
        if (createdSessionId) {
          setCurrentSessionId(createdSessionId);
          await loadSessions();
        }
      }
    } catch (error) {
      console.error('Error creating session at start:', error);
    }

    setMode(selectedMode);
    elapsedBeforeRunRef.current = resumeCarryoverSeconds;
    let initialSeconds = 0;
    if (selectedMode === 'freeflow') {
      setTime(resumeCarryoverSeconds);
      setInitialTime(0);
    } else {
      const safeMinutes = Number.isFinite(minutes) ? Math.min(Math.max(Math.floor(minutes), 1), 240) : 25;
      const seconds = safeMinutes * 60;
      initialSeconds = seconds;
      setTime(seconds);
      setInitialTime(resumeCarryoverSeconds + seconds);
    }
    setIsTimerVisible(true);
    setIsRunning(true);
    setSessionStartTime(Date.now());
    track('session_started', {
      mode: selectedMode,
      duration_minutes: selectedMode === 'timed'
        ? (Number.isFinite(minutes) ? Math.min(Math.max(Math.floor(minutes), 1), 240) : 25)
        : null,
    });

    clearCompactSessionCues();
    if (selectedMode === 'timed') {
      setTimedCueSegment(resumeCarryoverSeconds, initialSeconds);
    }
    resetCheckInSchedule(selectedMode, selectedMode === 'timed' ? resumeCarryoverSeconds + initialSeconds : initialSeconds, resumeCarryoverSeconds, { restartTimedSegment: selectedMode === 'timed' });
    resetCompactPulseSchedule(selectedMode, selectedMode === 'timed' ? resumeCarryoverSeconds + initialSeconds : initialSeconds, resumeCarryoverSeconds, { restartTimedSegment: selectedMode === 'timed' });
    historyResumeCarryoverSecondsRef.current = 0;
    setIsStartModalOpen(false);
    requestCompactEntry({ restorePreviousBounds: true, delayMs: 80 });
  };

  const openFreshTaskComposer = useCallback(({ bringToFront = false } = {}) => {
    reentryStartNewAfterResolveRef.current = false;
    postSessionNotesActionRef.current = null;
    sessionToSave.current = null;
    pendingParkingLotTaskSwitchRef.current = null;
    stopFlowResumeStateRef.current = {
      canResume: false,
      returnToCompact: false,
      returnToFloating: false,
    };
    postSessionBreakUntilRef.current = 0;
    postSessionBreakPromptPendingRef.current = false;
    reentryEligibleSinceRef.current = null;
    reentryNextCueAtRef.current = null;
    reentryRemainingMsRef.current = null;
    closeFloatingReentryPrompt();
    setFloatingBreakState({ open: false });
    handleClear();
    setPostSessionStartAssist(true);

    if (bringToFront) {
      window.electronAPI.bringToFront?.();
    }
    window.setTimeout(() => {
      taskInputRef.current?.focus();
    }, 100);
  }, [closeFloatingReentryPrompt, handleClear, setFloatingBreakState]);

  const beginStartSomethingNewFromResumeCandidate = useCallback(() => {
    openFreshTaskComposer({ bringToFront: true });
  }, [openFreshTaskComposer]);

  const handlePostSessionBreakMinutesChange = useCallback((minutes) => {
    const safeMinutes = POST_SESSION_BREAK_PRESETS.includes(minutes) ? minutes : null;
    setPostSessionBreakMinutes(safeMinutes);
    setPostSessionBreakHasSelection(safeMinutes !== null);
  }, []);

  const startSessionFromReentryPrompt = useCallback((payload = {}, { bringToFront = false } = {}) => {
    const promptKind = payload?.promptKind === 'resume-choice' ? 'resume-choice' : 'start';
    const resumeCandidate = reentryResumeCandidateRef.current;
    const selectedMode = payload?.mode === 'timed' ? 'timed' : 'freeflow';
    const safeMinutes = selectedMode === 'timed'
      ? Math.min(Math.max(Math.floor(Number(payload?.minutes) || 25), 1), 240)
      : 0;
    const nextTaskText = promptKind === 'resume-choice'
      ? (resumeCandidate?.taskText || '')
      : clampTaskText(typeof payload?.taskText === 'string' ? payload.taskText : '').trim();

    if (!nextTaskText) return;

    const nextNotes = promptKind === 'resume-choice'
      ? (typeof resumeCandidate?.recap === 'string' ? resumeCandidate.recap : (typeof resumeCandidate?.notes === 'string' ? resumeCandidate.notes : ''))
      : '';
    const nextNextSteps = promptKind === 'resume-choice'
      ? (typeof resumeCandidate?.nextSteps === 'string' ? resumeCandidate.nextSteps : '')
      : '';
    const nextSessionId = promptKind === 'resume-choice'
      ? (resumeCandidate?.sessionId || null)
      : null;
    const nextCarryoverSeconds = promptKind === 'resume-choice'
      ? Math.max(0, Math.floor(Number(resumeCandidate?.carryoverSeconds) || 0))
      : 0;

    reentryStartNewAfterResolveRef.current = false;
    reentryEligibleSinceRef.current = null;
    reentryNextCueAtRef.current = null;
    reentryRemainingMsRef.current = null;
    setReentryAttentionVisible(false);
    setReentryStrongActive(false);
    closeFloatingReentryPrompt();

    setTask(nextTaskText);
    setContextNotes(nextNotes);
    setNextStepsNotes(nextNextSteps);
    setCurrentSessionId(nextSessionId);
    setSessionMinutes(String(selectedMode === 'timed' ? safeMinutes : 25));
    setPostSessionResumeCandidate(null);
    setPostSessionStartAssist(false);
    if (bringToFront) {
      window.electronAPI.bringToFront?.();
    }
    window.setTimeout(() => {
      void handleStartSession(selectedMode, safeMinutes, {
        taskText: nextTaskText,
        notes: nextNotes,
        nextSteps: nextNextSteps,
        sessionId: nextSessionId,
        carryoverSeconds: nextCarryoverSeconds,
      });
    }, 80);
    return true;
  }, [closeFloatingReentryPrompt, handleStartSession]);

  const handleFloatingReentryStart = useCallback((payload = {}) => {
    startSessionFromReentryPrompt(payload, { bringToFront: true });
  }, [startSessionFromReentryPrompt]);

  const handleFloatingReentryAction = useCallback((eventPayload = {}) => {
    const action = typeof eventPayload?.action === 'string' ? eventPayload.action : '';
    const payload = eventPayload?.payload && typeof eventPayload.payload === 'object'
      ? eventPayload.payload
      : {};

    if (action === 'snooze') {
      snoozeReentryAttention(payload?.kind);
      return;
    }

    if (action === 'start-new-from-resume') {
      beginStartSomethingNewFromResumeCandidate();
      return;
    }

    if (action === 'start-session') {
      handleFloatingReentryStart(payload);
    }
  }, [beginStartSomethingNewFromResumeCandidate, handleFloatingReentryStart, snoozeReentryAttention]);

  const handleSurfaceReentryStart = useCallback((payload = {}) => {
    startSessionFromReentryPrompt(payload);
  }, [startSessionFromReentryPrompt]);

  useEffect(() => {
    const cleanup = window.electronAPI.onFloatingReentryAction?.((payload) => {
      handleFloatingReentryAction(payload);
    });
    return () => { if (cleanup) cleanup(); };
  }, [handleFloatingReentryAction]);

  const buildPostSessionResumeCandidate = useCallback(({
    taskText,
    recap = '',
    nextSteps = '',
    sessionId = null,
    carryoverSeconds = 0,
  }) => {
    const nextTaskText = clampTaskText(typeof taskText === 'string' ? taskText : '').trim();
    if (!nextTaskText) return null;

    return {
      source: 'post-session',
      taskText: nextTaskText,
      recap: typeof recap === 'string' ? recap : '',
      nextSteps: typeof nextSteps === 'string' ? nextSteps : '',
      notes: typeof recap === 'string' ? recap : '',
      sessionId: typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim() : null,
      mode,
      carryoverSeconds: Math.max(0, Math.floor(Number(carryoverSeconds) || 0)),
    };
  }, [mode]);

  const openPostSessionTransition = useCallback(({
    taskText,
    recap = '',
    nextSteps = '',
    sessionId = null,
    carryoverSeconds = 0,
  }) => {
    const candidate = buildPostSessionResumeCandidate({
      taskText,
      recap,
      nextSteps,
      sessionId,
      carryoverSeconds,
    });
    if (!candidate) return;

    setShowNotesModal(false);
    setSessionNotesMode('complete');
    setPostSessionResumeCandidate(candidate);
    setPostSessionBreakMinutes(null);
    setPostSessionBreakHasSelection(false);
    setPostSessionBreakShowTimer(false);
    setPostSessionStartAssist(false);
    setShowPostSessionPrompt(true);
    postSessionBreakUntilRef.current = 0;
    postSessionBreakPromptPendingRef.current = false;
    setFloatingBreakState({ open: false });

    if (reentryStrongTimeoutRef.current) {
      clearTimeout(reentryStrongTimeoutRef.current);
      reentryStrongTimeoutRef.current = null;
    }
    reentryEligibleSinceRef.current = null;
    reentryNextCueAtRef.current = null;
    reentryRemainingMsRef.current = null;
    setReentryAttentionVisible(false);
    setReentryStrongActive(false);
    closeFloatingReentryPrompt();

    elapsedBeforeRunRef.current = 0;
    setTask(candidate.taskText);
    setContextNotes(candidate.recap);
    setNextStepsNotes(candidate.nextSteps);
    setCurrentSessionId(null);
    setIsRunning(false);
    setTime(0);
    setInitialTime(0);
    setIsTimerVisible(false);
    setIsCompact(false);
    setSessionStartTime(null);
    clearCompactSessionCues();
    persistIdleTimerSnapshot({
      taskText: candidate.taskText,
      recapText: candidate.recap,
      nextStepsText: candidate.nextSteps,
      nextMode: 'freeflow',
      sessionId: null,
    });
  }, [buildPostSessionResumeCandidate, clearCompactSessionCues, closeFloatingReentryPrompt, persistIdleTimerSnapshot, setFloatingBreakState]);

  const handleTakePostSessionBreak = useCallback(() => {
    if (!postSessionResumeCandidate?.taskText) return;
    if (!postSessionBreakHasSelection || !POST_SESSION_BREAK_PRESETS.includes(postSessionBreakMinutes)) return;

    const breakMinutes = postSessionBreakMinutes;
    const breakEndsAt = Date.now() + (breakMinutes * 60 * 1000);

    setShowPostSessionPrompt(false);
    setPostSessionStartAssist(false);
    reentryEligibleSinceRef.current = null;
    reentryNextCueAtRef.current = null;
    reentryRemainingMsRef.current = null;
    postSessionBreakUntilRef.current = breakEndsAt;
    postSessionBreakPromptPendingRef.current = true;
    setReentryAttentionVisible(false);
    setReentryStrongActive(false);
    closeFloatingReentryPrompt();
    setFloatingBreakState({
      open: true,
      endsAt: breakEndsAt,
      showTimer: postSessionBreakShowTimer,
    });
    void window.electronAPI.enterFloatingMinimize?.();
  }, [closeFloatingReentryPrompt, postSessionBreakHasSelection, postSessionBreakMinutes, postSessionBreakShowTimer, postSessionResumeCandidate, setFloatingBreakState]);

  const handlePostSessionStartAnother = useCallback(() => {
    openFreshTaskComposer();
  }, [openFreshTaskComposer]);

  const handlePostSessionDoneForNow = useCallback(() => {
    setShowPostSessionPrompt(false);
    setPostSessionStartAssist(false);
    reentryEligibleSinceRef.current = null;
    reentryNextCueAtRef.current = null;
    reentryRemainingMsRef.current = null;
    setReentryAttentionVisible(false);
    setReentryStrongActive(false);
    closeFloatingReentryPrompt();
    setFloatingBreakState({ open: false });
    void window.electronAPI.enterFloatingMinimize?.();
  }, [closeFloatingReentryPrompt, setFloatingBreakState]);

  const handleSaveSessionNotes = async (notes) => {
    const postAction = postSessionNotesActionRef.current;
    postSessionNotesActionRef.current = null;
    const pendingSession = sessionToSave.current;
    const splitNotes = normalizeSplitNotes(notes, {
      recap: contextNotes,
      nextSteps: nextStepsNotes,
    });

    if (postAction === 'resume-later') {
      const carryoverSeconds = Math.max(0, Math.round(Number((sessionToSave.current?.duration || 0) * 60) || 0));
      const endedSessionId = await saveSessionWithNotes(splitNotes);
      setShowNotesModal(false);
      setSessionNotesMode('complete');
      sessionToSave.current = null;
      openPostSessionTransition({
        taskText: task,
        recap: splitNotes.recap,
        nextSteps: splitNotes.nextSteps,
        sessionId: endedSessionId,
        carryoverSeconds,
      });
      resetSessionFeedbackFlow();
      return;
    }

    const endedSessionId = await saveSessionWithNotes(splitNotes);
    setShowNotesModal(false);
    setSessionNotesMode('complete');
    sessionToSave.current = null;
    showCompletedSessionMessage();
    triggerConfetti();
    openPostSessionTransition({
      taskText: task,
      recap: splitNotes.recap,
      nextSteps: splitNotes.nextSteps,
      sessionId: pendingSession?.kept ? endedSessionId : null,
      carryoverSeconds: pendingSession?.kept ? Math.max(0, Math.round(Number((pendingSession.duration || 0) * 60) || 0)) : 0,
    });
    resetSessionFeedbackFlow();
  };

  const handleSkipSessionNotes = async () => {
    const postAction = postSessionNotesActionRef.current;
    postSessionNotesActionRef.current = null;
    const pendingSession = sessionToSave.current;

    if (postAction === 'resume-later') {
      const carryoverSeconds = Math.max(0, Math.round(Number((sessionToSave.current?.duration || 0) * 60) || 0));
      const endedSessionId = await saveSessionWithNotes({ recap: '', nextSteps: '' });
      setShowNotesModal(false);
      setSessionNotesMode('complete');
      sessionToSave.current = null;
      openPostSessionTransition({
        taskText: task,
        recap: '',
        nextSteps: '',
        sessionId: endedSessionId,
        carryoverSeconds,
      });
      resetSessionFeedbackFlow();
      return;
    }

    if (sessionNotesMode === 'stop-decision') {
      if (stopFlowResumeStateRef.current?.canResume) {
        handleResumeStopFlow();
        return;
      }
      handleStopFlowIncomplete('');
      return;
    }
    const endedSessionId = await saveSessionWithNotes({ recap: '', nextSteps: '' });
    setShowNotesModal(false);
    setSessionNotesMode('complete');
    sessionToSave.current = null;
    showCompletedSessionMessage();
    triggerConfetti();
    openPostSessionTransition({
      taskText: task,
      recap: '',
      nextSteps: '',
      sessionId: pendingSession?.kept ? endedSessionId : null,
      carryoverSeconds: pendingSession?.kept ? Math.max(0, Math.round(Number((pendingSession.duration || 0) * 60) || 0)) : 0,
    });
    resetSessionFeedbackFlow();
  };

  const finalizeIncompleteStop = useCallback(async (notes = '') => {
    if (!sessionToSave.current) {
      setShowNotesModal(false);
      setSessionNotesMode('complete');
      pendingParkingLotTaskSwitchRef.current = null;
      resetSessionFeedbackFlow();
      return;
    }

    const durationMin = sessionToSave.current?.duration || 0;
    const splitNotes = normalizeSplitNotes(notes, {
      recap: contextNotes,
      nextSteps: nextStepsNotes,
    });
    sessionToSave.current = {
      ...sessionToSave.current,
      completed: false,
      kept: true,
    };
    const endedSessionId = await saveSessionWithNotes(splitNotes);

    setShowNotesModal(false);
    setSessionNotesMode('complete');
    sessionToSave.current = null;
    stopFlowResumeStateRef.current = {
      canResume: false,
      returnToCompact: false,
      returnToFloating: false,
    };
    const shouldFocusFreshTask = reentryStartNewAfterResolveRef.current === true;
    reentryStartNewAfterResolveRef.current = false;

    // Not completed: keep task text, but reset timer/session state.
    track('session_abandoned', { mode, duration_minutes: Math.round(durationMin * 10) / 10 });
    elapsedBeforeRunRef.current = 0;
    setIsRunning(false);
    setTime(0);
    setInitialTime(0);
    setIsTimerVisible(false);
    setIsCompact(false);
    setSessionStartTime(null);
    if (shouldFocusFreshTask) {
      handleClear();
      setTimeout(() => taskInputRef.current?.focus(), 140);
      resetSessionFeedbackFlow();
      return;
    }
    if (startPendingParkingLotTaskSwitch()) {
      resetSessionFeedbackFlow();
      return;
    }
    openPostSessionTransition({
      taskText: task,
      recap: splitNotes.recap,
      nextSteps: splitNotes.nextSteps,
      sessionId: endedSessionId,
      carryoverSeconds: Math.max(0, Math.round(durationMin * 60)),
    });
    resetSessionFeedbackFlow();
  }, [handleClear, mode, nextStepsNotes, openPostSessionTransition, resetSessionFeedbackFlow, saveSessionWithNotes, startPendingParkingLotTaskSwitch, task, contextNotes]);

  const finalizeStopFlowComplete = useCallback(async (notes = '') => {
    if (!sessionToSave.current) {
      setShowNotesModal(false);
      setSessionNotesMode('complete');
      pendingParkingLotTaskSwitchRef.current = null;
      resetSessionFeedbackFlow();
      return;
    }

    const durationMin = sessionToSave.current?.duration || 0;
    const splitNotes = normalizeSplitNotes(notes, {
      recap: contextNotes,
      nextSteps: nextStepsNotes,
    });
    sessionToSave.current = {
      ...sessionToSave.current,
      completed: true,
    };
    const completedSessionId = await saveSessionWithNotes(splitNotes);

    setShowNotesModal(false);
    setSessionNotesMode('complete');
    sessionToSave.current = null;
    stopFlowResumeStateRef.current = {
      canResume: false,
      returnToCompact: false,
      returnToFloating: false,
    };
    const shouldFocusFreshTask = reentryStartNewAfterResolveRef.current === true;
    reentryStartNewAfterResolveRef.current = false;

    track('session_completed', { mode, duration_minutes: Math.round(durationMin * 10) / 10, source: 'stop_flow' });

    if (shouldFocusFreshTask) {
      handleClear();
      setTimeout(() => taskInputRef.current?.focus(), 140);
      resetSessionFeedbackFlow();
      return;
    }

    if (startPendingParkingLotTaskSwitch()) {
      resetSessionFeedbackFlow();
      return;
    }

    showCompletedSessionMessage();
    triggerConfetti();
    openPostSessionTransition({
      taskText: task,
      recap: splitNotes.recap,
      nextSteps: splitNotes.nextSteps,
      sessionId: null,
      carryoverSeconds: 0,
    });
    resetSessionFeedbackFlow();

    try {
      const allSessions = await SessionStore.list();
      const streak = computeStreak(allSessions);
      if (streak >= 2) track('session_streak', { streak_count: streak });
    } catch (_) { /* non-critical */ }
  }, [contextNotes, handleClear, mode, nextStepsNotes, openPostSessionTransition, resetSessionFeedbackFlow, saveSessionWithNotes, showCompletedSessionMessage, startPendingParkingLotTaskSwitch, task, triggerConfetti]);

  const finalizeTimeUpEndSession = useCallback(() => {
    track('post_session_choice', { choice: 'end_session' });
    setShowTimeUpModal(false);
    timeUpReturnToCompactRef.current = false;
    timeUpReturnToFloatingRef.current = false;
    setSessionStartTime(null);
    stopFlowResumeStateRef.current = {
      canResume: false,
      returnToCompact: false,
      returnToFloating: false,
    };

    clearCompactSessionCues();
    setSessionNotesMode('stop-decision');
    setShowNotesModal(true);
  }, [clearCompactSessionCues]);

  const handleStopFlowComplete = useCallback((notes = '') => {
    maybePromptSessionFeedback({
      modal: 'session-notes',
      surface: 'stop_yes_complete',
      completionType: 'completed',
      onContinue: () => {
        void finalizeStopFlowComplete(notes);
      },
    });
  }, [finalizeStopFlowComplete, maybePromptSessionFeedback]);

  const handleStopFlowIncomplete = useCallback((notes = '') => {
    maybePromptSessionFeedback({
      modal: 'session-notes',
      surface: 'stop_no_keep_task',
      completionType: 'kept',
      onContinue: () => {
        void finalizeIncompleteStop(notes);
      },
    });
  }, [finalizeIncompleteStop, maybePromptSessionFeedback]);

  const handleTimeUpEndSession = useCallback(() => {
    finalizeTimeUpEndSession();
  }, [finalizeTimeUpEndSession]);

  const handleTimeUpAddTime = (extraMinutes) => {
    track('post_session_choice', { choice: 'keep_going_add_time', extra_minutes: Math.min(Math.max(extraMinutes || 5, 1), 240) });
    const safeMinutes = Math.min(Math.max(extraMinutes || 5, 1), 240);
    const extraSeconds = safeMinutes * 60;
    const currentInitial = Math.max(0, Number(initialTime) || 0);
    const nextInitial = currentInitial + extraSeconds;
    const elapsedAtExtension = currentInitial;
    const shouldReturnToCompact = timeUpReturnToCompactRef.current;
    const shouldReturnToFloating = timeUpReturnToFloatingRef.current;
    timeUpReturnToCompactRef.current = false;
    timeUpReturnToFloatingRef.current = false;

    elapsedBeforeRunRef.current = currentInitial;
    setInitialTime((prev) => prev + extraSeconds);
    setTime(extraSeconds);
    setIsTimerVisible(true);
    setIsRunning(true);
    setSessionStartTime(Date.now());
    setShowTimeUpModal(false);
    setTimedCueSegment(elapsedAtExtension, extraSeconds);
    resetCheckInSchedule('timed', nextInitial, elapsedAtExtension, { restartTimedSegment: true });
    resetCompactPulseSchedule('timed', nextInitial, elapsedAtExtension, { restartTimedSegment: true });
    resetSessionFeedbackFlow();
    restoreTimeUpWindowShell({ returnToCompact: shouldReturnToCompact, returnToFloating: shouldReturnToFloating });
  };

  const handleTimeUpSwitchToFreeflow = useCallback(() => {
    track('post_session_choice', { choice: 'keep_going_freeflow' });

    const elapsedAtHandoff = Math.max(0, Number(initialTime) || 0);
    const shouldReturnToCompact = timeUpReturnToCompactRef.current;
    const shouldReturnToFloating = timeUpReturnToFloatingRef.current;
    timeUpReturnToCompactRef.current = false;
    timeUpReturnToFloatingRef.current = false;

    elapsedBeforeRunRef.current = elapsedAtHandoff;
    setMode('freeflow');
    setInitialTime(0);
    setTime(elapsedAtHandoff);
    setIsTimerVisible(true);
    setIsRunning(true);
    setSessionStartTime(Date.now());
    setShowTimeUpModal(false);
    clearCompactSessionCues();
    resetCheckInSchedule('freeflow', 0, elapsedAtHandoff, { restartFreeflowPhase: true });
    resetCompactPulseSchedule('freeflow', 0, elapsedAtHandoff, { restartFreeflowPhase: true });
    resetSessionFeedbackFlow();

    void checkpointActiveSession('time-up-freeflow-switch');
    restoreTimeUpWindowShell({ returnToCompact: shouldReturnToCompact, returnToFloating: shouldReturnToFloating });
  }, [checkpointActiveSession, clearCompactSessionCues, initialTime, resetCheckInSchedule, resetCompactPulseSchedule, resetSessionFeedbackFlow, restoreTimeUpWindowShell]);

  // Phase 3.5 — "Resume Later" from TimeUpModal
  const handleTimeUpResumeLater = () => {
    track('post_session_choice', { choice: 'resume_later' });
    setShowTimeUpModal(false);
    timeUpReturnToCompactRef.current = false;
    timeUpReturnToFloatingRef.current = false;
    setSessionStartTime(null);

    clearCompactSessionCues();
    // Override completed flag — task is not finished, mark as kept for Resume tab
    sessionToSave.current = {
      ...sessionToSave.current,
      completed: false,
      kept: true,
    };
    postSessionNotesActionRef.current = 'resume-later';
    setSessionNotesMode('resume-later');
    setShowNotesModal(true);
    resetSessionFeedbackFlow();
  };

  const prepareTaskForStartChooser = useCallback(({
    taskText,
    notes = '',
    recap,
    nextSteps = '',
    sessionId = null,
    carryoverSeconds = 0,
    suppressHistoryPop = false,
  }) => {
    const nextTask = clampTaskText(typeof taskText === 'string' ? taskText : '').trim();
    if (!nextTask) return false;
    const nextNotes = typeof recap === 'string'
      ? recap
      : (typeof notes === 'string' ? notes : '');
    const normalizedNextSteps = typeof nextSteps === 'string' ? nextSteps : '';
    const normalizedCarryoverSeconds = Math.max(0, Math.round(Number(carryoverSeconds) || 0));

    // Prevent stale modal-stack reopen when explicit task-start actions
    // are taking over the flow.
    modalStackRef.current = [];
    invalidatePendingSessionCreation();
    suppressHistoryPopRef.current = suppressHistoryPop;
    elapsedBeforeRunRef.current = 0;
    historyResumeCarryoverSecondsRef.current = normalizedCarryoverSeconds;
    parkingLotReturnToFloatingRef.current = false;
    postSessionParkingLotReturnToCompactRef.current = false;
    postSessionParkingLotReturnToFloatingRef.current = false;
    timeUpReturnToCompactRef.current = false;
    timeUpReturnToFloatingRef.current = false;
    resetSessionFeedbackFlow();
    clearCompactSessionCues();
    clearCheckInUi();
    setTask(nextTask);
    setTime(0);
    setInitialTime(0);
    setIsRunning(false);
    setIsCompact(false);
    setContextNotes(nextNotes);
    setNextStepsNotes(normalizedNextSteps);
    setCurrentSessionId(sessionId || null);
    setShowNotesModal(false);
    setShowPostSessionPrompt(false);
    setShowTimeUpModal(false);
    setSessionNotesMode('complete');
    setShowSettings(false);
    setDistractionJarOpen(false);
    setShowQuickCapture(false);
    setShowTaskPreview(false);
    setShowHistoryModal(false);
    setPostSessionResumeCandidate(null);
    setPostSessionStartAssist(false);
    historyReturnToCompactRef.current = false;
    settingsReturnToCompactRef.current = false;
    parkingLotReturnToCompactRef.current = false;
    setIsStartModalOpen(true);
    setIsTimerVisible(false);
    setSessionStartTime(null);

    window.electronAPI.storeSet('currentTask', {
      text: nextTask,
      contextNote: nextNotes,
      recap: nextNotes,
      nextSteps: normalizedNextSteps,
      startedAt: null,
    });
    window.electronAPI.storeSet('timerState', {
      mode: 'freeflow',
      seconds: 0,
      timerVisible: false,
      isRunning: false,
      initialTime: 0,
      elapsedSeconds: 0,
      sessionStartedAt: null,
      timedSegmentStartElapsed: 0,
      timedSegmentDuration: 0,
      checkInTimedIndex: 0,
      checkInTimedPendingIndex: null,
      compactPulseTimedIndex: 0,
      currentSessionId: sessionId || null,
    });
    return true;
  }, [clearCheckInUi, clearCompactSessionCues, invalidatePendingSessionCreation, resetSessionFeedbackFlow]);

  useEffect(() => {
    prepareTaskForStartChooserRef.current = prepareTaskForStartChooser;
  }, [prepareTaskForStartChooser]);

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
    const nextNotes = getSessionRecap(session);
    const nextNextSteps = getSessionNextSteps(session);
    const resumeCarryoverSeconds = Math.max(0, Math.round((Number(session.durationMinutes) || 0) * 60));

    if (!prepareTaskForStartChooser({
      taskText: nextTask,
      recap: nextNotes,
      nextSteps: nextNextSteps,
      sessionId: null,
      carryoverSeconds: resumeCarryoverSeconds,
      suppressHistoryPop: true,
    })) {
      setShowHistoryModal(false);
      return;
    }

    try {
      track('session_history_reused', { was_completed: session.completed ?? false });
      if (!session.completed) {
        track('resume_later_returned');
      }
    } catch (error) {
      console.error('Analytics tracking failed in handleUseTask:', error);
    }
  };

  const getValidatedSessionMinutes = useCallback(() => {
    const rawMinutes = sessionMinutes.trim();
    if (!/^\d+$/.test(rawMinutes)) {
      openTimerValidationModal('Whole numbers only');
      return null;
    }

    const parsed = Number.parseInt(rawMinutes, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      openTimerValidationModal('Enter 1 to 240 minutes');
      return null;
    }

    if (parsed > 240) {
      openTimerValidationModal('240 minuntes max');
      return null;
    }

    return parsed;
  }, [openTimerValidationModal, sessionMinutes]);

  const handlePreviewTask = (session, options = {}) => {
    setPreviewSession(session);
    setPreviewUseTaskEnabled(options.allowUseTask !== false);
    setPreviewRestoreEnabled(options.allowRestore === true);
    pushModal('history');
    setShowTaskPreview(true);
    setShowHistoryModal(false);
  };

  const handleCloseTaskPreview = () => {
    setShowTaskPreview(false);
    setPreviewUseTaskEnabled(true);
    setPreviewRestoreEnabled(false);
    popAndOpenPrevModal();
  };

  const handleRestoreSession = useCallback(async (session) => {
    const sessionId = typeof session === 'string' ? session : session?.id;
    if (!sessionId) return;

    try {
      const updated = await SessionStore.update(sessionId, {
        completed: false,
        kept: true,
      });
      if (!updated) return;

      await loadSessions();

      if (previewSession?.id === sessionId) {
        setPreviewSession(updated);
        setPreviewUseTaskEnabled(true);
        setPreviewRestoreEnabled(false);
      }

      showToast('success', 'Restored to Resume');
    } catch (error) {
      console.error('Error restoring session to Resume:', error);
      showToast('warning', 'Could not restore this session');
    }
  }, [loadSessions, previewSession?.id, showToast]);

  const handleCloseHistory = () => {
    setShowHistoryModal(false);
    if (suppressHistoryPopRef.current) {
      suppressHistoryPopRef.current = false;
      return;
    }
    const reopenedPrevModal = popAndOpenPrevModal();
    if (historyReturnToCompactRef.current && !reopenedPrevModal) {
      historyReturnToCompactRef.current = false;
      requestCompactEntry({ restorePreviousBounds: true, delayMs: 80 });
      return;
    }
    historyReturnToCompactRef.current = false;
  };

  const handleCloseSettings = useCallback(() => {
    setShowSettings(false);
    const reopenedPrevModal = popAndOpenPrevModal();
    if (settingsReturnToCompactRef.current && !reopenedPrevModal) {
      settingsReturnToCompactRef.current = false;
      requestCompactEntry({ restorePreviousBounds: true, delayMs: 80 });
      return;
    }
    settingsReturnToCompactRef.current = false;
  }, [popAndOpenPrevModal, requestCompactEntry]);

  const handleUpdateTaskNotes = async (sessionId, newNotes) => {
    const currentPreviewSession = previewSession?.id === sessionId ? previewSession : sessions.find((item) => item.id === sessionId) || null;
    const splitNotes = normalizeSplitNotes(newNotes, {
      recap: getSessionRecap(currentPreviewSession),
      nextSteps: getSessionNextSteps(currentPreviewSession),
    });

    try {
      await SessionStore.update(sessionId, {
        notes: splitNotes.recap,
        recap: splitNotes.recap,
        nextSteps: splitNotes.nextSteps,
      });
      await loadSessions();
      if (previewSession && previewSession.id === sessionId) {
        setPreviewSession({
          ...previewSession,
          notes: splitNotes.recap,
          recap: splitNotes.recap,
          nextSteps: splitNotes.nextSteps,
        });
      }
      if (currentSessionId === sessionId) {
        setContextNotes(splitNotes.recap);
        setNextStepsNotes(splitNotes.nextSteps);
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
        setNextStepsNotes('');
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
        setNextStepsNotes('');
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
    const normalizedNotes = typeof newNotes === 'string' ? newNotes : '';
    setContextNotes(normalizedNotes);
    if (currentSessionId && normalizedNotes !== contextNotes) {
      try {
        await SessionStore.update(currentSessionId, {
          notes: normalizedNotes,
          recap: normalizedNotes,
        });
        await loadSessions();
      } catch (error) {
        console.error('Error updating session notes:', error);
      }
    }
  };

  const handleUpdateNextStepsNotes = async (newNextSteps) => {
    const normalizedNextSteps = typeof newNextSteps === 'string' ? newNextSteps : '';
    setNextStepsNotes(normalizedNextSteps);
    if (currentSessionId && normalizedNextSteps !== nextStepsNotes) {
      try {
        await SessionStore.update(currentSessionId, {
          nextSteps: normalizedNextSteps,
        });
        await loadSessions();
      } catch (error) {
        console.error('Error updating next steps:', error);
      }
    }
  };

  const handleDismissSavedContext = async () => {
    setContextNotes('');
    setNextStepsNotes('');
    if (!currentSessionId) return;
    try {
      await SessionStore.update(currentSessionId, {
        notes: '',
        recap: '',
        nextSteps: '',
      });
      await loadSessions();
    } catch (error) {
      console.error('Error dismissing saved context:', error);
    }
  };

  const addThought = useCallback(async (text) => {
    const nextText = typeof text === 'string' ? text.trim() : '';
    if (!nextText) return;
    const sessionId = await getActiveThoughtSessionId();
    setThoughts((prev) => [buildThoughtRecord(nextText, sessionId), ...prev]);
  }, [buildThoughtRecord, getActiveThoughtSessionId]);
  const handleQuickCaptureSave = useCallback((text) => {
    const nextText = typeof text === 'string' ? text.trim() : '';
    if (!nextText) return;
    void (async () => {
      const sessionId = await getActiveThoughtSessionId();
      setThoughts((prev) => [buildThoughtRecord(nextText, sessionId), ...prev]);
      showToast('success', 'Saved to Parking Lot');
    })();
  }, [buildThoughtRecord, getActiveThoughtSessionId, showToast]);
  const removeThought = useCallback((thoughtId) => {
    if (!thoughtId) return;
    setThoughts((prev) => prev.filter((thought) => thought.id !== thoughtId));
  }, []);
  const removeThoughts = useCallback((thoughtIds) => {
    if (!Array.isArray(thoughtIds) || thoughtIds.length === 0) return;
    const ids = new Set(thoughtIds);
    setThoughts((prev) => prev.filter((thought) => !ids.has(thought.id)));
  }, []);
  const updateThought = useCallback((thoughtId, text) => {
    const nextText = typeof text === 'string' ? text.trim() : '';
    if (!nextText) return;
    setThoughts((prev) => prev.map((thought) => (thought.id === thoughtId ? { ...thought, text: nextText } : thought)));
  }, []);
  const toggleThought = useCallback((thoughtId) => {
    setThoughts((prev) => prev.map((thought) => (thought.id === thoughtId ? { ...thought, completed: !thought.completed } : thought)));
  }, []);
  const clearCompletedThoughts = () => {
    const completedCount = thoughts.filter((t) => t.completed).length;
    if (completedCount > 0) track('parking_lot_cleared', { cleared_count: completedCount });
    setThoughts((prev) => prev.filter((t) => !t.completed));
  };

  const postSessionParkingLotThoughts = thoughts
    .filter((thought) => (
      thought?.sessionId === postSessionParkingLotSessionId
      && thought?.completed !== true
      && !postSessionParkingLotHiddenIds.includes(thought.id)
    ))
    .sort((a, b) => {
      const aCreatedAt = Number.isFinite(new Date(a?.createdAt).getTime()) ? new Date(a.createdAt).getTime() : -Infinity;
      const bCreatedAt = Number.isFinite(new Date(b?.createdAt).getTime()) ? new Date(b.createdAt).getTime() : -Infinity;
      return bCreatedAt - aCreatedAt;
    });

  const closePostSessionParkingLot = useCallback(({ restorePreviousDisplayMode = true } = {}) => {
    const shouldReturnToCompact = postSessionParkingLotReturnToCompactRef.current;
    const shouldReturnToFloating = postSessionParkingLotReturnToFloatingRef.current;
    postSessionParkingLotReturnToCompactRef.current = false;
    postSessionParkingLotReturnToFloatingRef.current = false;
    setPostSessionParkingLotSessionId(null);
    setPostSessionParkingLotHiddenIds([]);
    const hasActiveTaskShell = Boolean(task.trim()) || isRunning || isTimerVisible;
    if (restorePreviousDisplayMode && hasActiveTaskShell) {
      restoreDisplayMode({ returnToCompact: shouldReturnToCompact, returnToFloating: shouldReturnToFloating });
    }
  }, [isRunning, isTimerVisible, restoreDisplayMode, task]);

  useEffect(() => {
    if (!postSessionParkingLotSessionId) return;
    if (postSessionParkingLotThoughts.length > 0) return;
    closePostSessionParkingLot();
  }, [postSessionParkingLotSessionId, postSessionParkingLotThoughts.length, closePostSessionParkingLot]);

  const removeThoughtById = useCallback((thoughtId) => {
    if (!thoughtId) return;
    setThoughts((prev) => prev.filter((thought) => thought.id !== thoughtId));
  }, []);

  const hidePostSessionThought = useCallback((thoughtId) => {
    if (!thoughtId) return;
    setPostSessionParkingLotHiddenIds((prev) => (prev.includes(thoughtId) ? prev : [...prev, thoughtId]));
  }, []);

  const copyPostSessionThought = useCallback(async (thoughtId) => {
    const thought = thoughts.find((entry) => entry.id === thoughtId);
    if (!thought?.text) return;
    await navigator.clipboard.writeText(thought.text);
    showToast('success', 'Copied to clipboard');
  }, [thoughts, showToast]);

  const copyAllPostSessionThoughts = useCallback(async () => {
    if (postSessionParkingLotThoughts.length === 0) return;
    await navigator.clipboard.writeText(postSessionParkingLotThoughts.map((thought) => thought.text).join('\n'));
    showToast('success', 'Copied all to clipboard');
  }, [postSessionParkingLotThoughts, showToast]);

  const clearAllPostSessionThoughts = useCallback(() => {
    if (postSessionParkingLotThoughts.length === 0) return;
    const thoughtIds = new Set(postSessionParkingLotThoughts.map((thought) => thought.id));
    setThoughts((prev) => prev.filter((thought) => !thoughtIds.has(thought.id)));
  }, [postSessionParkingLotThoughts]);

  const startThoughtAsNextTask = useCallback((thoughtId) => {
    const thought = thoughts.find((entry) => entry.id === thoughtId);
    if (!thought?.text) return;
    closePostSessionParkingLot({ restorePreviousDisplayMode: false });
    prepareTaskForStartChooser({
      taskText: thought.text,
      notes: '',
      sessionId: null,
      carryoverSeconds: 0,
    });

    try {
      track('parking_lot_task_started');
    } catch (error) {
      console.error('Analytics tracking failed in startThoughtAsNextTask:', error);
    }
  }, [thoughts, closePostSessionParkingLot, prepareTaskForStartChooser]);

  const handleParkingLotStartThoughtAsNextTask = useCallback((thoughtId) => {
    const thought = thoughts.find((entry) => entry.id === thoughtId);
    if (!thought?.text) return;

    const hasActiveSessionToSwitch = Boolean(task.trim()) && (isRunning || isTimerVisible || currentSessionId);
    if (!hasActiveSessionToSwitch) {
      startThoughtAsNextTask(thoughtId);
      return;
    }

    setParkingLotTaskSwitchConfirm({
      thoughtId,
      taskText: thought.text,
      returnToCompact: parkingLotReturnToCompactRef.current === true,
      returnToFloating: parkingLotReturnToFloatingRef.current === true,
    });
  }, [currentSessionId, isRunning, isTimerVisible, startThoughtAsNextTask, task, thoughts]);

  const getPulseClassName = () => {
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
      [Boolean(postSessionParkingLotSessionId), ...WINDOW_SIZES.modal.postSessionParkingLot],
      [showPostSessionPrompt, ...WINDOW_SIZES.modal.postSessionPrompt],
      [showTimeUpModal, ...WINDOW_SIZES.modal.timeUp],
      [showNotesModal, ...WINDOW_SIZES.modal.notes],
      [showQuickCapture, ...WINDOW_SIZES.modal.quickCapture],
    ];
    const active = MODAL_SIZES.find(([open]) => open);
    if (active) {
      window.electronAPI.modalOpened(active[1], active[2]);
      const retryTimer = setTimeout(() => {
        window.electronAPI.modalOpened(active[1], active[2]);
      }, 120);
      const settleTimer = setTimeout(() => {
        window.electronAPI.modalOpened(active[1], active[2]);
      }, 260);
      return () => {
        clearTimeout(retryTimer);
        clearTimeout(settleTimer);
      };
    } else {
      window.electronAPI.modalClosed();
      // Modal close can restore older bounds from main process;
      // re-apply current screen target after restoration settles.
      const settleTimer = setTimeout(() => {
        resyncFullWindowSize();
        setTimeout(() => resyncFullWindowSize(), 140);
      }, 60);
      return () => clearTimeout(settleTimer);
    }
    return undefined;
  }, [showSettings, showHistoryModal, showTaskPreview, distractionJarOpen, postSessionParkingLotSessionId, showPostSessionPrompt, showTimeUpModal, showNotesModal, showQuickCapture, resyncFullWindowSize]);

  // No active timer: keep full view tightly fit to content.
  // Base height matches the compact no-timer layout, then grows with
  // multi-line task input (and start-session chooser when shown).
  useEffect(() => {
    const hasModalOpen =
      showSettings ||
      showHistoryModal ||
      showTaskPreview ||
      distractionJarOpen ||
      Boolean(postSessionParkingLotSessionId) ||
      showPostSessionPrompt ||
      showTimeUpModal ||
      showNotesModal ||
      showQuickCapture;

    if (isCompact || hasModalOpen) return undefined;
    if (isRunning || isTimerVisible) return undefined;
    if (!showSurfaceReentryPrompt && hasSavedContext) return undefined;

    const resizeTimer = setTimeout(() => {
      resizeToMainCardContent(getIdleScreenDefaultHeight());
    }, 40);

    return () => clearTimeout(resizeTimer);
  }, [
    isCompact,
    isRunning,
    isTimerVisible,
    task,
    hasSavedContext,
    isStartModalOpen,
    showSurfaceReentryPrompt,
    reentrySurfaceStage,
    getIdleScreenDefaultHeight,
    resizeToMainCardContent,
    showSettings,
    showHistoryModal,
    showTaskPreview,
    distractionJarOpen,
    postSessionParkingLotSessionId,
    showPostSessionPrompt,
    showTimeUpModal,
    showNotesModal,
    showQuickCapture,
    showUpdateBanner,
  ]);

  // Active full-view states: deterministic default heights by screen.
  useEffect(() => {
    const hasModalOpen =
      showSettings ||
      showHistoryModal ||
      showTaskPreview ||
      distractionJarOpen ||
      Boolean(postSessionParkingLotSessionId) ||
      showPostSessionPrompt ||
      showTimeUpModal ||
      showNotesModal ||
      showQuickCapture;

    if (isCompact || hasModalOpen) return undefined;
    if (!isRunning && !isTimerVisible && !hasSavedContext) return undefined;

    const targetHeight = getActiveScreenDefaultHeight();
    const resizeTimer = setTimeout(() => {
      resizeToMainCardContent(targetHeight);
    }, 40);

    return () => clearTimeout(resizeTimer);
  }, [
    isCompact,
    isRunning,
    isTimerVisible,
    hasSavedContext,
    checkInState,
    checkInMessage,
    showSettings,
    showHistoryModal,
    showTaskPreview,
    distractionJarOpen,
    postSessionParkingLotSessionId,
    showPostSessionPrompt,
    showTimeUpModal,
    showNotesModal,
    showQuickCapture,
    showUpdateBanner,
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
          const restorePreviousBounds = pendingCompactRestoreRef.current === true;
          pendingCompactRestoreRef.current = false;
          await window.electronAPI.enterPillMode({ restorePreviousBounds });
          windowModeActualRef.current = 'pill';

          if (compactRevealTimerRef.current) clearTimeout(compactRevealTimerRef.current);
          compactRevealTimerRef.current = setTimeout(() => {
            setCompactTransitioning(false);
            compactRevealTimerRef.current = null;
          }, 200);
        } else {
          if (compactEnteredAtRef.current) {
            const durationSec = Math.round((Date.now() - compactEnteredAtRef.current) / 1000);
            track('view_mode_session', { mode: 'compact', duration_seconds: durationSec });
            compactEnteredAtRef.current = null;
          }

          setCompactTransitioning(true);
          didJustExitCompactRef.current = true;
          const pendingHeight = pendingCompactExitHeightRef.current;
          pendingCompactExitHeightRef.current = null;
          await window.electronAPI.exitPillMode({
            width: fullWindowTargetWidthRef.current,
            height: Number.isFinite(pendingHeight) ? pendingHeight : undefined,
          });
          windowModeActualRef.current = 'full';

          if (Number.isFinite(pendingHeight)) {
            ensureWindowSizeForCurrentScreen(pendingHeight);
          }
          if (compactRevealTimerRef.current) clearTimeout(compactRevealTimerRef.current);
          compactRevealTimerRef.current = setTimeout(() => {
            if (Number.isFinite(pendingHeight)) {
              ensureWindowSizeForCurrentScreen(pendingHeight);
            }
            setTimeout(() => {
              if (Number.isFinite(pendingHeight)) {
                ensureWindowSizeForCurrentScreen(pendingHeight);
              }
            }, 150);
            setCompactTransitioning(false);
            compactRevealTimerRef.current = null;
          }, 90);
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
  }, [ensureWindowSizeForCurrentScreen, isCompact, syncWindowMode]);

  // Safety net: if no active task/session in full mode, keep timer panel hidden.
  useEffect(() => {
    if (isCompact) return;
    if (isRunning) return;
    if (isStartModalOpen) return;
    if (hasSavedContext) return;
    if (task.trim()) return;
    if (!isTimerVisible) return;
    setIsTimerVisible(false);
  }, [hasSavedContext, isCompact, isRunning, isStartModalOpen, task, isTimerVisible]);

  if (startupGateState !== 'ready') {
    const normalizedLicenseKeyInput = licenseKeyInput.trim();
    const canSubmitLicense = normalizedLicenseKeyInput.length > 0;
    const normalizedPreferredNameInput = normalizePreferredName(preferredNameInput);
    const canSubmitPreferredName = normalizedPreferredNameInput.length > 0;

    if (startupGateState === 'checking') {
      return (
        <div className="app-container electron-draggable" style={{ alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', padding: '1rem' }}>
          <div
            ref={startupGateCardRef}
            className="electron-no-drag"
            style={{
              width: '100%',
              maxWidth: '22rem',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: '0.9rem',
              boxShadow: 'var(--shadow-minimal)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.6rem',
            }}
          >
            <img
              src={theme === 'light' ? appLockupLight : appLockupDark}
              alt="Focana"
              style={{ height: 28, width: '100%', maxWidth: 140, objectFit: 'contain' }}
            />
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Loading your workspace...
            </p>
          </div>
        </div>
      );
    }

    if (startupGateState === 'activation') {
      const activationErrorMessage = licenseStatus?.lastError || '';
      return (
        <div className="app-container electron-draggable" style={{ alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', padding: '1rem' }}>
          <div
            ref={startupGateCardRef}
            className="electron-no-drag"
            style={{
              width: '100%',
              maxWidth: '26rem',
              background: 'var(--bg-card)',
              border: '1px solid var(--brand-action)',
              borderRadius: '0.9rem',
              boxShadow: 'var(--shadow-minimal)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.9rem',
            }}
          >
            <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)', fontWeight: 700 }}>
              Activate Focana on this Mac
            </h1>

            <form
              className="electron-no-drag"
              onSubmit={(event) => {
                event.preventDefault();
                void handleLicenseActivation();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}
            >
              <input
                type="text"
                value={licenseKeyInput}
                onChange={(event) => setLicenseKeyInput(event.target.value)}
                placeholder="Paste your Focana license key"
                autoFocus
                className="input electron-no-drag"
                style={{ width: '100%', fontSize: '0.95rem', padding: '0.7rem 0.8rem' }}
              />

              <Button
                type="submit"
                disabled={!canSubmitLicense || licenseSubmitting}
                className="electron-no-drag"
                style={{ width: '100%', minHeight: '2.7rem' }}
              >
                {licenseSubmitting ? 'Submitting...' : 'Submit'}
              </Button>
            </form>

            {activationErrorMessage && (
              <div style={{
                padding: '0.75rem 0.9rem',
                borderRadius: '0.75rem',
                border: '1px solid var(--error-surface-border)',
                background: 'var(--error-surface-bg)',
              }}>
                <p style={{ margin: 0, color: 'var(--error-surface-text)', fontSize: '0.86rem', lineHeight: 1.5 }}>
                  {activationErrorMessage}
                </p>
              </div>
            )}

            <div style={{
              padding: '0.75rem 0.9rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-card)',
            }}>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.5 }}>
                Where is my key? Check your Lemon Squeezy receipt email or Lemon Squeezy My Orders. If this key is already active on another Mac, deactivate it there first or contact support at hello@focana.app.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (startupGateState === 'name') {
      return (
        <div className="app-container electron-draggable" style={{ alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', padding: '1rem' }}>
          <div
            ref={startupGateCardRef}
            className="electron-no-drag"
            style={{
              width: '100%',
              maxWidth: '26rem',
              background: 'var(--bg-card)',
              border: '1px solid var(--brand-action)',
              borderRadius: '0.9rem',
              boxShadow: 'var(--shadow-minimal)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.9rem',
            }}
          >
            <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)', fontWeight: 700 }}>
              One more thing. What should we call you?
            </h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.5 }}>
              We’ll use this for in-app encouragement and to personalize follow-up emails. You can change it any time in Settings.
            </p>

            <form
              className="electron-no-drag"
              onSubmit={(event) => {
                event.preventDefault();
                void handlePreferredNameSubmit();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}
            >
              <input
                type="text"
                value={preferredNameInput}
                onChange={(event) => {
                  setPreferredNameInput(event.target.value);
                  if (preferredNameError) setPreferredNameError('');
                }}
                placeholder="Your name"
                autoFocus
                className="input electron-no-drag"
                style={{ width: '100%', fontSize: '0.95rem', padding: '0.7rem 0.8rem' }}
              />

              <Button
                type="submit"
                disabled={!canSubmitPreferredName || preferredNameSubmitting}
                className="electron-no-drag"
                style={{ width: '100%', minHeight: '2.7rem' }}
              >
                {preferredNameSubmitting ? 'Saving...' : 'Continue'}
              </Button>
            </form>

            {preferredNameError ? (
              <div style={{
                padding: '0.75rem 0.9rem',
                borderRadius: '0.75rem',
                border: '1px solid var(--error-surface-border)',
                background: 'var(--error-surface-bg)',
              }}>
                <p style={{ margin: 0, color: 'var(--error-surface-text)', fontSize: '0.86rem', lineHeight: 1.5 }}>
                  {preferredNameError}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      );
    }
  }

  const activeTaskLabel = task.trim()
    ? task
    : ((isRunning || isTimerVisible) ? lastNonEmptyTaskRef.current : task);
  const fullScreenTaskState = isRunning ? 'running' : (isTimerVisible ? 'paused' : 'draft');
  const isRunningFullWindow = fullScreenTaskState === 'running';
  const showReentryTaskHint = showSurfaceReentryPrompt && !isCompact;
  const fullScreenTaskEyebrow = fullScreenTaskState === 'paused'
    ? 'Paused session'
    : 'Set your next focus';
  const fullScreenTaskHelper = fullScreenTaskState === 'paused'
    ? (showReentryTaskHint
      ? 'Ready to continue? Press play to resume this session.'
      : 'Adjust the task if needed, then press play to continue.')
    : (postSessionStartAssist
      ? 'Start something new, or use Parking Lot or History if you want to pull from existing work.'
      : (isStartModalOpen
      ? 'Choose Freeflow or set a timer to begin.'
      : ''));
  const fullScreenTimerControls = (
    <>
      {!isRunning ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handlePlay}
              disabled={!task.trim()}
              variant="outline"
              className="focus-control-btn focus-control-btn--primary timer-run-btn"
              aria-label="Resume Timer"
            >
              <Play style={{ width: isShortFullWindow ? 9 : 11, height: isShortFullWindow ? 9 : 11 }} />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Resume Timer</p></TooltipContent>
        </Tooltip>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handlePause}
              variant="outline"
              className="focus-control-btn focus-control-btn--soft timer-run-btn"
              aria-label="Pause Timer"
            >
              <svg
                viewBox="0 0 16 16"
                aria-hidden="true"
                className="focus-control-icon focus-control-icon--pause"
              >
                <rect x="2.7" y="2.2" width="2.1" height="11.6" rx="1.05" fill="currentColor" />
                <rect x="11.2" y="2.2" width="2.1" height="11.6" rx="1.05" fill="currentColor" />
              </svg>
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Pause Timer</p></TooltipContent>
        </Tooltip>
      )}
      {isRunning ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleStop}
              disabled={!task.trim()}
              variant="outline"
              className="focus-control-btn focus-control-btn--outline"
              aria-label="End Session"
            >
              <Square className="focus-control-icon" style={{ width: isShortFullWindow ? 8 : 10, height: isShortFullWindow ? 8 : 10 }} />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>End Session</p></TooltipContent>
        </Tooltip>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleStop}
              disabled={!task.trim()}
              variant="outline"
              className="focus-control-btn focus-control-btn--outline"
              aria-label="End Session"
            >
              <Square className="focus-control-icon" style={{ width: isShortFullWindow ? 8 : 10, height: isShortFullWindow ? 8 : 10 }} />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>End Session</p></TooltipContent>
        </Tooltip>
      )}
    </>
  );

  // Compact mode render
  if (isCompact) {
    return (
      // electron-draggable on the outer container lets users drag the pill window
      // from the transparent corner pixels (outside the rounded pill shape).
      // The pill itself is electron-no-drag so its mouse events fire normally.
      <div className={`app-container pill-mode electron-draggable${compactTransitioning ? ' pill-mode--transitioning' : ''}`}>
        <CompactMode
          task={activeTaskLabel}
          isRunning={isRunning}
          time={time}
          pulseSignal={compactPulseSignal}
          successCueSignal={compactSuccessCueSignal}
          onDoubleClick={handleExitCompact}
          onOpenDistractionJar={handleOpenParkingLot}
          thoughtCount={thoughts.length}
          onPlay={handlePlay}
          onPause={handlePause}
          onStop={handleStop}
          pulseEnabled={pulseSettings.compactEnabled}
          dndActive={dndEnabled}
          checkInState={checkInState}
          reentryPromptVisible={showSurfaceReentryPrompt}
          reentryPromptStrongActive={reentryStrongActive}
          reentryPromptKind={reentryPromptKind}
          reentryPromptStage={reentrySurfaceStage}
          reentryPromptTaskText={reentrySurfaceTaskText}
          reentryPromptMinutes={reentrySurfaceMinutes}
          reentryResumeTaskName={reentryResumeCandidate?.taskText || ''}
          onReentryTaskTextChange={(nextValue) => setReentrySurfaceTaskText(clampTaskText(nextValue))}
          onReentryMinutesChange={setReentrySurfaceMinutes}
          onReentryStageChange={setReentrySurfaceStage}
          onReentryStartSession={handleSurfaceReentryStart}
          onReentryStartNewFromResume={beginStartSomethingNewFromResumeCandidate}
          onReentrySnooze={snoozeReentryAttention}
        />
        <CheckInPromptPopup
          isOpen={checkInState === 'prompting'}
          onFocused={() => resolveCheckIn('focused')}
          onDetour={openCheckInDetourChoice}
          taskName={activeTaskLabel}
          variant="compact"
        />
        <PostSessionParkingLotModal
          isOpen={Boolean(postSessionParkingLotSessionId)}
          thoughts={postSessionParkingLotThoughts}
          onDone={closePostSessionParkingLot}
          onDismissThought={removeThoughtById}
          onKeepThoughtForLater={hidePostSessionThought}
          onCopyThought={copyPostSessionThought}
          onStartThoughtAsNextTask={startThoughtAsNextTask}
          onCopyAll={copyAllPostSessionThoughts}
          onClearAll={clearAllPostSessionThoughts}
        />
        <SessionNotesModal
          isOpen={showNotesModal}
          onClose={handleSkipSessionNotes}
          onSave={handleSaveSessionNotes}
          onComplete={handleStopFlowComplete}
          onIncomplete={handleStopFlowIncomplete}
          onResume={handleResumeStopFlow}
          showResumeAction={stopFlowResumeStateRef.current?.canResume === true}
          sessionDuration={sessionToSave.current?.duration || 0}
          taskName={task}
          sessionFlowKey={sessionNotesFlowKey}
          flow={sessionNotesMode}
          initialRecap={contextNotes}
          initialNextSteps={nextStepsNotes}
          feedbackPrompt={sessionFeedbackPrompt?.modal === 'session-notes' ? {
            isOpen: true,
            onSelect: captureSessionFeedback,
            onContinue: continueSessionFeedbackFlow,
            onDismiss: continueSessionFeedbackFlow,
            autoAdvanceMs: SESSION_FEEDBACK_AUTO_ADVANCE_MS,
            continueDelayMs: SESSION_FEEDBACK_CONTINUE_DELAY_MS,
          } : null}
        />
        <PostSessionPrompt
          isOpen={showPostSessionPrompt}
          taskName={postSessionResumeCandidate?.taskText || task}
          selectedBreakMinutes={postSessionBreakMinutes}
          hasBreakSelection={postSessionBreakHasSelection}
          showTimerDuringBreak={postSessionBreakShowTimer}
          onBreakMinutesChange={handlePostSessionBreakMinutesChange}
          onBreakTimerVisibilityChange={setPostSessionBreakShowTimer}
          onTakeBreak={handleTakePostSessionBreak}
          onStartAnotherSession={handlePostSessionStartAnother}
          onDoneForNow={handlePostSessionDoneForNow}
        />
        <TimeUpModal
          isOpen={showTimeUpModal}
          taskName={task}
          onEndSession={handleTimeUpEndSession}
          onAddTime={handleTimeUpAddTime}
          onSwitchToFreeflow={handleTimeUpSwitchToFreeflow}
          onResumeLater={handleTimeUpResumeLater}
        />
        <TaskPreviewModal
          isOpen={showTaskPreview}
          onClose={handleCloseTaskPreview}
          session={previewSession}
          sessions={sessions}
          onUseTask={handleUseTask}
          onRestoreSession={handleRestoreSession}
          onUpdateNotes={handleUpdateTaskNotes}
          canUseTask={previewUseTaskEnabled}
          canRestore={previewRestoreEnabled}
        />
        <HistoryModal
          isOpen={showHistoryModal}
          onClose={handleCloseHistory}
          sessions={sessions}
          onUseTask={handleUseTask}
          onRestoreSession={handleRestoreSession}
          onPreviewTask={handlePreviewTask}
          onDeleteSession={handleDeleteSession}
          onDeleteSessions={handleDeleteSessions}
        />
        <QuickCaptureModal isOpen={showQuickCapture} onClose={() => setShowQuickCapture(false)} onSave={handleQuickCaptureSave} />
        <Toast toast={toast} onDismiss={() => setToast(null)} placement="pill-center" />
        {showConfetti && <ConfettiBurst burstId={confettiBurstId} />}
      </div>
    );
  }

  return (
    <div className={`app-container app-container--full app-container--focus-${fullScreenTaskState}${suppressToolbarTooltips ? ' app-container--suppress-tooltips' : ''}${compactTransitioning ? ' app-container--transitioning' : ''}`}>
      <div ref={mainCardRef} className={`main-card electron-draggable${isRunningFullWindow ? ' main-card--running' : ''}`}>
        {/* Header */}
        <div className={`full-header electron-draggable${isRunningFullWindow ? ' full-header--running' : ''}`}>
          <div className="full-header__brand">
            <img
              src={theme === 'light' ? appLockupLight : appLockupDark}
              alt="Focana"
              className="full-header__brand-lockup"
            />
          </div>
          <div className="full-header__nav">
            {enabledMainControls.history && pinnedControls.history && (
              <Button
                aria-label="Open Session History"
                onClick={() => setShowHistoryModal(true)}
                className="full-header__nav-btn"
                variant="ghost"
                tabIndex={2}
              >
                History
              </Button>
            )}
            {enabledMainControls.parkingLot && pinnedControls.parkingLot && (
              <Button
                aria-label="Open Parking Lot"
                onClick={() => setDistractionJarOpen(true)}
                className="full-header__nav-btn"
                variant="ghost"
                tabIndex={3}
              >
                Parking Lot
                {thoughts.length > 0 && <span className="full-header__nav-badge">{thoughts.length}</span>}
              </Button>
            )}
          </div>
          <div className="electron-no-drag top-toolbar full-header__toolbar">
            {enabledMainControls.dnd && pinnedControls.dnd && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={dndEnabled ? 'Turn Off Do Not Disturb' : 'Turn On Do Not Disturb'}
                    onClick={() => setDoNotDisturb(!dndEnabled, 'toolbar')}
                    size="icon"
                    variant="ghost"
                    className={`full-header__tool-btn${dndEnabled ? ' is-active' : ''}`}
                  >
                    <BellOff style={{ width: 16, height: 16 }} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>{dndEnabled ? 'Turn off Do Not Disturb' : 'Turn on Do Not Disturb'}</p></TooltipContent>
              </Tooltip>
            )}
            {enabledMainControls.theme && pinnedControls.theme && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button aria-label="Toggle Theme" onClick={handleToggleTheme} size="icon" variant="ghost" className="full-header__tool-btn">
                    {theme === 'dark'
                      ? <Sun style={{ width: 18, height: 18 }} />
                      : <Moon style={{ width: 18, height: 18 }} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>{theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</p></TooltipContent>
              </Tooltip>
            )}
            {enabledMainControls.alwaysOnTop && pinnedControls.alwaysOnTop && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={isAlwaysOnTop ? 'Disable Always on Top' : 'Enable Always on Top'}
                    onClick={handleToggleAlwaysOnTop}
                    size="icon"
                    variant="ghost"
                    className={`full-header__tool-btn${isAlwaysOnTop ? ' is-active' : ''}`}
                  >
                    <Pin style={{ width: 16, height: 16, fill: isAlwaysOnTop ? 'currentColor' : 'none' }} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>{isAlwaysOnTop ? 'Disable Always on Top' : 'Enable Always on Top'}</p></TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button aria-label="Open Settings" onClick={() => setShowSettings(true)} size="icon" variant="ghost" className="full-header__tool-btn">
                  <Settings style={{ width: 20, height: 20 }} />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Settings & Shortcuts</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button aria-label="Enter Compact Mode" onClick={() => requestCompactEntry()} size="icon" variant="ghost" className="full-header__tool-btn">
                  <Minimize2 style={{ width: 16, height: 16 }} />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Enter Compact Mode</p></TooltipContent>
            </Tooltip>
            {enabledMainControls.floatingMinimize && pinnedControls.floatingMinimize && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button aria-label="Minimize to Floating" onClick={handleMinimizeToFloating} size="icon" variant="ghost" className="full-header__tool-btn">
                    <X style={{ width: 16, height: 16 }} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Minimize to Floating</p></TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {showUpdateBanner && (
          <div
            className="electron-no-drag"
            style={{
              marginTop: '0.75rem',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.875rem',
              padding: '0.75rem 0.875rem',
              borderRadius: '0.875rem',
              border: '1px solid color-mix(in srgb, var(--brand-primary) 70%, transparent)',
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-primary) 16%, var(--bg-card)) 0%, var(--bg-card) 58%, color-mix(in srgb, var(--brand-primary) 9%, var(--bg-surface)) 100%)',
              boxShadow: '0 14px 34px rgba(46, 31, 24, 0.14)',
            }}
          >
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--brand-action)' }}>
                Update Ready
              </span>
              <span style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                Focana {updateState.availableVersion} is downloaded and ready.
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                Restart when you want to install the update. Your current work stays saved.
              </span>
            </div>
            <Button
              type="button"
              onClick={() => { void handleInstallUpdate(); }}
              style={{
                background: 'var(--brand-primary)',
                color: 'var(--text-on-brand)',
                minWidth: '9.5rem',
                height: '2.35rem',
                borderRadius: '9999px',
                flexShrink: 0,
                boxShadow: '0 10px 18px rgba(180, 83, 9, 0.22)',
              }}
            >
              <RotateCcw style={{ width: 14, height: 14, marginRight: '0.45rem' }} />
              Restart to Update
            </Button>
          </div>
        )}

        {/* Content */}
        <div className={`full-view-content electron-draggable full-view-content--${fullScreenTaskState} ${getPulseClassName()}`}>
          <div className={`focus-stage focus-stage--${fullScreenTaskState}`}>
            <div className="focus-stage__surface">
              {fullScreenTaskState === 'running' ? (
                <FocusHeroCard
                  task={activeTaskLabel}
                  timerText={formatTime(time)}
                  controls={fullScreenTimerControls}
                  onLockedInteraction={handleLockedTaskInputInteraction}
                />
              ) : (showSurfaceReentryPrompt ? (
                <ReentryPrompt
                  isOpen
                  surface="full"
                  promptKind={reentryPromptKind}
                  stage={reentrySurfaceStage}
                  strongActive={reentryStrongActive}
                  taskText={reentrySurfaceTaskText}
                  minutes={reentrySurfaceMinutes}
                  maxTaskLength={TASK_CHARACTER_LIMIT}
                  resumeTaskName={reentryResumeCandidate?.taskText || ''}
                  onTaskTextChange={(nextValue) => setReentrySurfaceTaskText(clampTaskText(nextValue))}
                  onMinutesChange={setReentrySurfaceMinutes}
                  onStageChange={setReentrySurfaceStage}
                  onStartSession={handleSurfaceReentryStart}
                  onStartNewFromResume={beginStartSomethingNewFromResumeCandidate}
                  onSnooze={snoozeReentryAttention}
                />
              ) : (
                <TaskInput
                  ref={taskInputRef}
                  task={task}
                  setTask={handleTaskChange}
                  maxLength={TASK_CHARACTER_LIMIT}
                  isActive={isNoteFocused || isStartModalOpen || fullScreenTaskState === 'paused'}
                  visualState={fullScreenTaskState}
                  eyebrowText={fullScreenTaskEyebrow}
                  helperText={fullScreenTaskHelper}
                  checkInPromptActive={checkInState === 'prompting' || checkInState === 'detour-choice'}
                  checkInCelebrating={checkInCelebrating}
                  checkInCelebrationType={checkInCelebrationType}
                  reentryPromptActive={showReentryTaskHint}
                  reentryStrongActive={reentryStrongActive}
                  onFocus={() => setIsNoteFocused(true)}
                  onBlur={() => setIsNoteFocused(false)}
                  onTaskSubmit={handleTaskSubmit}
                  onLockedInteraction={handleLockedTaskInputInteraction}
                  onHeightChange={handleTaskInputHeightChange}
                />
              ))}

              {isStartModalOpen && (
                <div className="start-chooser">
                  <div className="start-chooser__timer">
                    <span className="start-chooser__label">Set timer</span>
                    <input
                      type="number"
                      value={sessionMinutes}
                      onChange={(e) => setSessionMinutes(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        const validatedMinutes = getValidatedSessionMinutes();
                        if (validatedMinutes === null) return;
                        handleStartSession('timed', validatedMinutes);
                      }}
                      min="1"
                      max="240"
                      step="1"
                      className="input start-chooser__input"
                      ref={sessionMinutesInputRef}
                    />
                    <span className="start-chooser__unit">min</span>
                  </div>
                  <span className="start-chooser__divider">or</span>
                  <Button
                    onClick={() => handleStartSession('freeflow', 0)}
                    className="start-chooser__freeflow"
                  >
                    Freeflow
                  </Button>
                  <div style={{ flex: 1 }} />
                  <button
                    onClick={() => setIsStartModalOpen(false)}
                    tabIndex={-1}
                    className="start-chooser__cancel"
                    aria-label="Cancel"
                  >
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              )}
            </div>

            {(checkInState === 'prompting' || checkInState === 'detour-choice' || checkInState === 'detour-resolved' || (checkInState === 'resolved' && !showCenteredFullWindowCheckInToast)) && (
              <div
                style={{
                  width: '100%',
                  maxWidth: checkInState === 'prompting' ? 480 : (checkInState === 'detour-choice' || checkInState === 'detour-resolved' ? 480 : 460),
                  marginTop: '0.5rem',
                  border: `1px solid ${checkInState === 'prompting' || checkInState === 'detour-choice' ? '#D97706' : 'var(--border-subtle)'}`,
                  borderRadius: checkInState === 'prompting' ? '0.75rem' : '0.5rem',
                  padding: checkInState === 'prompting' ? '0.85rem 0.875rem' : '0.5rem 0.625rem',
                  display: 'flex',
                  flexDirection: checkInState === 'prompting' ? 'column' : 'row',
                  alignItems: checkInState === 'prompting' ? 'stretch' : 'center',
                  justifyContent: 'space-between',
                  gap: checkInState === 'prompting' ? '0.75rem' : '0.5rem',
                  background: checkInState === 'prompting' ? 'var(--bg-surface)' : 'var(--bg-card)',
                  boxShadow: checkInState === 'prompting' ? '0 12px 28px rgba(46, 31, 24, 0.16)' : 'none',
                  transition: 'all 0.25s ease',
                  opacity: 1,
                }}
              >
                {checkInState === 'prompting' && (
                  <>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                        Still focused on
                      </div>
                      <div style={{ marginTop: '0.2rem', fontSize: '1rem', fontWeight: 800, color: '#B45309', lineHeight: 1.3, overflowWrap: 'anywhere' }}>
                        {activeTaskLabel.trim() || 'this task'}?
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                      <Button
                        variant="outline"
                        onClick={() => resolveCheckIn('focused')}
                        style={{ minWidth: '7rem', justifyContent: 'center' }}
                        title="Still focused"
                      >
                        Yes
                      </Button>
                      <Button
                        variant="outline"
                        onClick={openCheckInDetourChoice}
                        style={{ minWidth: '7rem', justifyContent: 'center' }}
                        title="Not focused"
                      >
                        No
                      </Button>
                    </div>
                  </>
                )}

                {checkInState === 'resolved' && (
                  <>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {checkInMessage}
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

            {hasSavedContext && (
              <ContextBox
                recap={contextNotes}
                nextSteps={nextStepsNotes}
                onUpdateRecap={handleUpdateContextNotes}
                onUpdateNextSteps={handleUpdateNextStepsNotes}
                onDismiss={handleDismissSavedContext}
                isSessionActive={isRunning}
              />
            )}

            {isTimerVisible && fullScreenTaskState !== 'running' && (
              <div className={`focus-timer-panel focus-timer-panel--${fullScreenTaskState}${isShortFullWindow ? ' focus-timer-panel--compact' : ''}`}>
                <div className="focus-timer-panel__body">
                  <div className="focus-timer-panel__clock">{formatTime(time)}</div>
                  <div className="focus-timer-panel__controls">{fullScreenTimerControls}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <ParkingLot
        isOpen={distractionJarOpen}
        onClose={handleCloseParkingLot}
        thoughts={thoughts}
        onAddThought={addThought}
        onUpdateThought={updateThought}
        onRemoveThought={removeThought}
        onRemoveThoughts={removeThoughts}
        onToggleThought={toggleThought}
        onClearCompleted={clearCompletedThoughts}
        onStartThoughtAsNextTask={handleParkingLotStartThoughtAsNextTask}
      />
      <Dialog open={parkingLotTaskSwitchConfirm !== null} onOpenChange={(open) => { if (!open) setParkingLotTaskSwitchConfirm(null); }}>
        <DialogContent style={{ background: 'var(--bg-surface)', borderColor: 'var(--brand-action)', maxWidth: '25rem' }}>
          <DialogHeader>
            <DialogTitle>End current session and switch tasks?</DialogTitle>
          </DialogHeader>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5 }}>
            Focana will stop your current session first, then prepare this Parking Lot item as your next task.
          </p>
          <DialogFooter style={{ marginTop: '1rem', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button
              variant="outline"
              onClick={handleCancelParkingLotTaskSwitch}
              style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
            >
              No, Keep This Session
            </Button>
            <Button onClick={handleConfirmParkingLotTaskSwitch} style={{ background: 'var(--brand-primary)', color: 'var(--text-on-brand)' }}>
              Yes, End Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PostSessionParkingLotModal
        isOpen={Boolean(postSessionParkingLotSessionId)}
        thoughts={postSessionParkingLotThoughts}
        onDone={closePostSessionParkingLot}
        onDismissThought={removeThoughtById}
        onKeepThoughtForLater={hidePostSessionThought}
        onCopyThought={copyPostSessionThought}
        onStartThoughtAsNextTask={startThoughtAsNextTask}
        onCopyAll={copyAllPostSessionThoughts}
        onClearAll={clearAllPostSessionThoughts}
      />
      <SessionNotesModal
        isOpen={showNotesModal}
        onClose={handleSkipSessionNotes}
        onSave={handleSaveSessionNotes}
        onComplete={handleStopFlowComplete}
        onIncomplete={handleStopFlowIncomplete}
        onResume={handleResumeStopFlow}
        showResumeAction={stopFlowResumeStateRef.current?.canResume === true}
        sessionDuration={sessionToSave.current?.duration || 0}
        taskName={task}
        sessionFlowKey={sessionNotesFlowKey}
        flow={sessionNotesMode}
        initialRecap={contextNotes}
        initialNextSteps={nextStepsNotes}
        feedbackPrompt={sessionFeedbackPrompt?.modal === 'session-notes' ? {
          isOpen: true,
          onSelect: captureSessionFeedback,
          onContinue: continueSessionFeedbackFlow,
          onDismiss: continueSessionFeedbackFlow,
          autoAdvanceMs: SESSION_FEEDBACK_AUTO_ADVANCE_MS,
          continueDelayMs: SESSION_FEEDBACK_CONTINUE_DELAY_MS,
        } : null}
      />
      <PostSessionPrompt
        isOpen={showPostSessionPrompt}
        taskName={postSessionResumeCandidate?.taskText || task}
        selectedBreakMinutes={postSessionBreakMinutes}
        hasBreakSelection={postSessionBreakHasSelection}
        showTimerDuringBreak={postSessionBreakShowTimer}
        onBreakMinutesChange={handlePostSessionBreakMinutesChange}
        onBreakTimerVisibilityChange={setPostSessionBreakShowTimer}
        onTakeBreak={handleTakePostSessionBreak}
        onStartAnotherSession={handlePostSessionStartAnother}
        onDoneForNow={handlePostSessionDoneForNow}
      />
      <TimeUpModal
        isOpen={showTimeUpModal}
        taskName={task}
        onEndSession={handleTimeUpEndSession}
        onAddTime={handleTimeUpAddTime}
        onSwitchToFreeflow={handleTimeUpSwitchToFreeflow}
        onResumeLater={handleTimeUpResumeLater}
      />
      <TaskPreviewModal
        isOpen={showTaskPreview}
        onClose={handleCloseTaskPreview}
        session={previewSession}
        sessions={sessions}
        onUseTask={handleUseTask}
        onRestoreSession={handleRestoreSession}
        onUpdateNotes={handleUpdateTaskNotes}
        canUseTask={previewUseTaskEnabled}
        canRestore={previewRestoreEnabled}
      />
      <HistoryModal
        isOpen={showHistoryModal}
        onClose={handleCloseHistory}
        sessions={sessions}
        onUseTask={handleUseTask}
        onRestoreSession={handleRestoreSession}
        onPreviewTask={handlePreviewTask}
        onDeleteSession={handleDeleteSession}
        onDeleteSessions={handleDeleteSessions}
      />
      <SettingsModal
        isOpen={showSettings}
        onClose={handleCloseSettings}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenParkingLot={() => {
          setShowSettings(false);
          parkingLotReturnToCompactRef.current = false;
          parkingLotReturnToFloatingRef.current = false;
          pushModal('settings');
          setDistractionJarOpen(true);
        }}
        onOpenSessionHistory={() => {
          setShowSettings(false);
          pushModal('settings');
          setShowHistoryModal(true);
        }}
        alwaysOnTopDefault={isAlwaysOnTop}
        onAlwaysOnTopChange={setIsAlwaysOnTop}
        onRestartApp={() => {
          setShowSettings(false);
          settingsReturnToCompactRef.current = false;
          window.electronAPI.restartApp?.();
        }}
        onCloseApp={() => {
          setShowSettings(false);
          settingsReturnToCompactRef.current = false;
          handleQuitApp();
        }}
        shortcuts={shortcuts}
        onShortcutsChange={(nextShortcuts) => setShortcuts(mergeShortcutsWithDefaults(nextShortcuts))}
        shortcutsEnabledDefault={shortcutsEnabled}
        onShortcutsEnabledChange={setShortcutsEnabled}

        pinnedControlsDefault={pinnedControls}
        onPinnedControlsChange={setPinnedControls}
        enabledControlsDefault={enabledMainControls}
        onEnabledControlsChange={setEnabledMainControls}
        preferredName={preferredName}
        onPreferredNameChange={(nextPreferredName) => {
          const normalizedPreferredName = normalizePreferredName(nextPreferredName);
          setPreferredName(normalizedPreferredName);
          setPreferredNameInput(normalizedPreferredName);
        }}
        dndEnabled={dndEnabled}
        onDndChange={(enabled) => {
          setDoNotDisturb(enabled, 'settings');
        }}
        checkInSettings={checkInSettings}
        onCheckInSettingsChange={({ enabled, intervalFreeflow }) => {
          setCheckInSettings((prev) => ({
            ...prev,
            enabled: enabled ?? prev.enabled,
            intervalFreeflow: Number.isFinite(intervalFreeflow) ? intervalFreeflow : prev.intervalFreeflow,
            timedPercents: TIMED_CHECKIN_PERCENTS,
          }));
        }}
        updateState={updateState}
        onCheckForUpdates={handleCheckForUpdates}
        onInstallUpdate={handleInstallUpdate}
        runtimeInfo={runtimeInfo}
        licenseStatus={licenseStatus}
        onValidateLicense={handleValidateLicenseNow}
        onDeactivateLicense={handleDeactivateLicense}
      />
      <Dialog open={showTimerValidationModal} onOpenChange={(open) => { if (!open) closeTimerValidationModal(); }}>
        <DialogContent style={{ background: 'var(--bg-surface)', borderColor: 'var(--brand-action)', maxWidth: '22rem' }}>
          <DialogHeader>
            <DialogTitle style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Timer input error
            </DialogTitle>
          </DialogHeader>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.5 }}>
            {timerValidationMessage}
          </p>
          <DialogFooter>
            <Button
              onClick={closeTimerValidationModal}
              style={{ background: 'var(--brand-primary)', color: 'var(--text-on-brand)' }}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <QuickCaptureModal isOpen={showQuickCapture} onClose={() => setShowQuickCapture(false)} onSave={handleQuickCaptureSave} />
      <Toast toast={toast} onDismiss={() => setToast(null)} placement={toast?.placement || 'top-right'} />
      {showConfetti && <ConfettiBurst burstId={confettiBurstId} />}
    </div>
  );
}
