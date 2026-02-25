# Focana - Desktop Focus App for ADHD

## What This App Is
Focana is a minimalist Electron desktop app that floats above all other windows as a persistent focus tool. It's a digital sticky note + timer designed specifically for ADHD brains. The core philosophy is: "One note. One focus. Zero overwhelm."

## Tech Stack
- **Electron 33+** (desktop framework)
- **React 18** (UI - ported from Base44 web app)
- **Vite** (bundler for renderer process)
- **electron-store** (local JSON persistence - replaces Base44 backend)
- **lucide-react** (icons)
- **date-fns** (date formatting)
- **Plain CSS with CSS custom properties** (no Tailwind, no shadcn)
- **electron-builder** (packaging for macOS DMG)

## Critical Architecture Rules
1. **No Base44 dependencies.** This app is fully standalone. No `@base44/sdk`, no `FocusSession` entity, no `ParkingLotItem` entity, no `AuthContext`. All data lives locally via electron-store.
2. **No shadcn/ui, no Radix UI, no Tailwind.** Rebuild all UI components with plain HTML/CSS. The Base44 version used shadcn — we are replacing every `@/components/ui/*` import with custom lightweight components.
3. **Always-on-top by default.** The main window must float above all other apps. This is non-negotiable for ADHD users.
4. **Frameless window with custom title bar.** No native macOS chrome. The app handles its own drag region and close/minimize buttons.
5. **Offline-first.** No network calls. Everything works without internet.
6. **electron-store for all persistence.** Session history, parking lot thoughts, settings, shortcuts, pulse settings — all stored in a single electron-store instance.

## Project Structure
```
focana/
├── CLAUDE.md                   # This file
├── package.json
├── electron-builder.yml
├── vite.config.js              # Vite config for renderer
├── src/
│   ├── main/                   # Electron main process (Node.js)
│   │   ├── main.js             # App entry, window creation, IPC handlers
│   │   ├── tray.js             # System tray setup
│   │   ├── shortcuts.js        # Global keyboard shortcut registration
│   │   ├── store.js            # electron-store schema and instance
│   │   └── preload.js          # Preload script exposing IPC to renderer
│   ├── renderer/               # React UI (browser context)
│   │   ├── index.html          # HTML entry
│   │   ├── main.jsx            # React entry point
│   │   ├── App.jsx             # Root component (was Focana.jsx)
│   │   ├── components/
│   │   │   ├── TaskInput.jsx
│   │   │   ├── Timer.jsx
│   │   │   ├── ContextBox.jsx
│   │   │   ├── ParkingLot.jsx       # Was DistractionJar
│   │   │   ├── IncognitoMode.jsx
│   │   │   ├── HistoryModal.jsx
│   │   │   ├── SessionNotesModal.jsx
│   │   │   ├── StartSessionModal.jsx
│   │   │   ├── SettingsModal.jsx
│   │   │   ├── QuickCaptureModal.jsx
│   │   │   ├── StatusBar.jsx
│   │   │   ├── TaskPreviewModal.jsx
│   │   │   └── Toast.jsx
│   │   ├── styles/
│   │   │   └── main.css        # All styles, CSS variables for brand kit
│   │   └── utils/
│   │       └── time.js         # formatTime helper
│   └── assets/
│       ├── icon.icns           # macOS app icon
│       └── icon.png            # Tray icon (16x16 or 22x22)
└── reference/                  # Base44 source code for logic reference (read-only)
```

## Brand Kit (Use These Exact Colors)

### Light Mode
```css
--bg-body: #F5F5F0;
--bg-window: #FEFDFB;
--bg-input: #F9FAFB;
--bg-card: #FFF9E6;
--bg-surface: #FFFEF8;
--text-primary: #5C4033;       /* Warm Brown */
--text-secondary: #8B6F47;    /* Coffee Brown */
--text-placeholder: #8B6F47;
--brand-primary: #F59E0B;     /* Sunshine Yellow */
--brand-hover: #D97706;       /* Deep Amber */
--brand-action: #D97706;
--focus-ring: #6366F1;        /* Muted indigo */
--success: #10B981;
--error: #DC2626;
--border-default: rgba(139, 111, 71, 0.2);
--border-focus: #D97706;
```

### Dark Mode
```css
--bg-body: #1C1917;
--bg-window: #292524;
--bg-input: #292524;
--bg-card: #1C1917;
--bg-surface: #292524;
--text-primary: #F5F5F4;
--text-secondary: #A8A29E;
--text-placeholder: #A8A29E;
--brand-primary: #F59E0B;
--brand-hover: #D97706;
--brand-action: #D97706;
--focus-ring: #6366F1;
--success: #10B981;
--error: #DC2626;
--celebration: #FCD34D;       /* Golden Glow */
--border-default: #404040;
--border-focus: #6366F1;
```

### Typography
- Primary font: `Inter, -apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- Timer font: Same but with `font-variant-numeric: tabular-nums`
- No emoji in UI chrome — use lucide-react icons instead

## Data Schema (electron-store)

```javascript
{
  currentTask: { text: '', contextNote: '', startedAt: null },
  timerState: { mode: 'freeflow', seconds: 0, isRunning: false, initialTime: 0 },
  parkingLot: [{ id: 'uuid', text: '', completed: false, createdAt: '' }],
  sessions: [{ id: 'uuid', task: '', durationMinutes: 0, mode: '', completed: false, notes: '', createdAt: '' }],
  thoughts: [{ text: '', completed: false }],
  settings: {
    theme: 'light',
    shortcuts: {
      startPause: 'CommandOrControl+Shift+S',
      newTask: 'CommandOrControl+N',
      toggleIncognito: 'CommandOrControl+Shift+I',
      completeTask: 'CommandOrControl+Enter',
      openParkingLot: 'CommandOrControl+Shift+P'
    },
    pulseSettings: {
      timeAwarenessEnabled: true,
      timeAwarenessInterval: 30,
      celebrationEnabled: true,
      incognitoEnabled: true
    },
    shortcutsEnabled: true,
    bringToFront: true,
    keepTextAfterCompletion: false,
    launchOnStartup: false
  },
  windowState: { x: 100, y: 100, width: 400, height: 220 }
}
```

## Window Behavior
- Default size: 400x220 (expanded), ~400x48 (pill/incognito mode)
- Always-on-top: ON by default, toggleable via pin button
- Frameless: true (custom drag region in header area)
- Resizable: false
- Background color matches --bg-surface to prevent white flash
- Remembers position between launches
- macOS: vibrancy/transparency optional, not required

## IPC API (preload.js → main process)
The renderer communicates with main via these channels:
```javascript
window.electronAPI = {
  // Window control
  closeWindow: () => ipcRenderer.send('close-window'),
  minimizeToTray: () => ipcRenderer.send('minimize-to-tray'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
  bringToFront: () => ipcRenderer.send('bring-to-front'),
  
  // Shortcuts
  registerGlobalShortcuts: (shortcuts) => ipcRenderer.send('register-shortcuts', shortcuts),
  onShortcut: (callback) => ipcRenderer.on('shortcut-triggered', (_, action) => callback(action)),
  
  // Store (persistence)
  storeGet: (key) => ipcRenderer.invoke('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),
  
  // Notifications
  showNotification: (title, body) => ipcRenderer.send('show-notification', { title, body }),
}
```

## Key UX Behaviors to Preserve
1. **Task input → Enter → Start Session modal** (choose freeflow or timed)
2. **Freeflow timer counts UP** from 00:00
3. **Timed mode counts DOWN** from user-specified minutes
4. **Stop saves session** and opens Session Notes modal (optional notes about where you left off)
5. **Incognito/pill mode**: collapses to minimal rounded pill showing task + timer + play/pause/stop
6. **Double-click pill to expand** back to full view
7. **Parking Lot (Notepad)**: slide-out dialog for capturing distracting thoughts
8. **Session History**: paginated list of past sessions, click to reuse a task
9. **Pulse animations**: gentle opacity pulse for time awareness, celebration pulse at milestones (5, 15, 30, 45, 60, 90, 120 min)
10. **Global keyboard shortcuts** work even when app is not focused

## What NOT to Build
- No cloud sync, no accounts, no auth
- No AI features
- No body doubling
- No analytics dashboard
- No calendar integration
- No auto-updates (manual distribution for now)
