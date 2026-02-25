import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Keyboard, RotateCcw, AlertTriangle, Zap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const DEFAULT_SHORTCUTS = {
  startPause: 'Cmd+Space',
  newTask: 'Cmd+N', 
  toggleIncognito: 'Cmd+Shift+I',
  completeTask: 'Cmd+Enter',
  openParkingLot: 'Cmd+Shift+P'
};

const SHORTCUT_DESCRIPTIONS = {
  startPause: 'Start/Pause Timer',
  newTask: 'New/Edit Task',
  toggleIncognito: 'Toggle Incognito Mode',
  completeTask: 'Complete Task + Celebrate', 
  openParkingLot: 'Open Notepad (Quick Capture)'
};

export default function SettingsModal({ isOpen, onClose, shortcuts, onShortcutsChange, pulseSettings, onPulseSettingsChange }) {
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
  const [recordingKey, setRecordingKey] = useState(null);
  const [conflicts, setConflicts] = useState({});

  useEffect(() => {
    if (isOpen) {
      setTempShortcuts(shortcuts || DEFAULT_SHORTCUTS);
      setTempPulseSettings(pulseSettings || {
        timeAwarenessEnabled: true,
        timeAwarenessInterval: 30,
        celebrationEnabled: true,
        incognitoEnabled: true,
      });

      // Load additional settings from localStorage
      const savedSettings = localStorage.getItem('focana-app-settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setShortcutsEnabled(settings.shortcutsEnabled ?? true);
        setBringToFront(settings.bringToFront ?? true);
        setKeepTextAfterCompletion(settings.keepTextAfterCompletion ?? false);
      }
    }
  }, [isOpen, shortcuts, pulseSettings]);

  const handleSave = () => {
    onShortcutsChange(tempShortcuts);
    onPulseSettingsChange(tempPulseSettings);
    
    // Save additional app settings
    const appSettings = {
      shortcutsEnabled,
      bringToFront,
      keepTextAfterCompletion
    };
    localStorage.setItem('focana-app-settings', JSON.stringify(appSettings));
    
    // Register shortcuts with Electron
    if (window.electronAPI?.updateGlobalShortcuts) {
      window.electronAPI.updateGlobalShortcuts(tempShortcuts, shortcutsEnabled);
    }
    
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
    setConflicts({});
  };

  const handleShortcutRecord = (key) => {
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
      
      // Check for conflicts
      const existingKey = Object.entries(tempShortcuts).find(([k, v]) => k !== key && v === shortcut);
      if (existingKey) {
        setConflicts({ [key]: `Conflicts with ${SHORTCUT_DESCRIPTIONS[existingKey[0]]}` });
      } else {
        setConflicts({ ...conflicts, [key]: null });
        setTempShortcuts({ ...tempShortcuts, [key]: shortcut });
      }
      
      setRecordingKey(null);
      document.removeEventListener('keydown', handleKeyPress);
    };
    
    document.addEventListener('keydown', handleKeyPress);
    
    // Auto-cancel recording after 10 seconds
    setTimeout(() => {
      setRecordingKey(null);
      document.removeEventListener('keydown', handleKeyPress);
    }, 10000);
  };

  const formatShortcutDisplay = (shortcut) => {
    if (!shortcut) return '';
    return shortcut.replace('Cmd', '⌘').replace('Ctrl', 'Ctrl').replace('Shift', '⇧').replace('Alt', '⌥');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl bg-[#FFFEF8] border-[#D97706] rounded-xl shadow-2xl max-h-[80vh] overflow-y-auto">
        <TooltipProvider>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#5C4033] flex items-center gap-2">
              <Settings className="w-6 h-6 text-[#D97706]" />
              Settings
            </DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="shortcuts" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="shortcuts" className="flex items-center gap-2">
                <Keyboard className="w-4 h-4" />
                Shortcuts
              </TabsTrigger>
              <TabsTrigger value="pulse" className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Pulse
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="shortcuts" className="space-y-6 mt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[#5C4033]">Global Shortcuts</h3>
                    <p className="text-sm text-[#8B6F47]">Work even when Focana isn't focused</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#8B6F47]">Enable All</span>
                    <Switch
                      checked={shortcutsEnabled}
                      onCheckedChange={setShortcutsEnabled}
                    />
                  </div>
                </div>
                
                {Object.entries(SHORTCUT_DESCRIPTIONS).map(([key, description]) => (
                  <div key={key} className="flex items-center justify-between p-3 bg-[#FFF9E6] rounded-lg border border-[#8B6F47]/10">
                    <div className="flex-1">
                      <p className="font-medium text-[#5C4033]">{description}</p>
                      {conflicts[key] && (
                        <div className="flex items-center gap-1 mt-1">
                          <AlertTriangle className="w-3 h-3 text-red-500" />
                          <span className="text-xs text-red-600">{conflicts[key]}</span>
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={() => handleShortcutRecord(key)}
                      variant="outline"
                      className={`min-w-[120px] font-mono ${
                        recordingKey === key 
                          ? 'bg-[#F59E0B] text-white border-[#F59E0B]' 
                          : 'border-[#8B6F47]/30 text-[#5C4033]'
                      }`}
                      disabled={!shortcutsEnabled}
                    >
                      {recordingKey === key 
                        ? 'Press keys...' 
                        : formatShortcutDisplay(tempShortcuts[key])}
                    </Button>
                  </div>
                ))}
                
                <div className="space-y-3 p-3 bg-[#FFF9E6] rounded-lg border border-[#8B6F47]/10">
                  <h4 className="font-medium text-[#5C4033]">Behavior Settings</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#8B6F47]">Bring Focana to front on shortcut</span>
                    <Switch
                      checked={bringToFront}
                      onCheckedChange={setBringToFront}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#8B6F47]">Keep text after task completion</span>
                    <Switch
                      checked={keepTextAfterCompletion}
                      onCheckedChange={setKeepTextAfterCompletion}
                    />
                  </div>
                </div>
                
                <div className="text-xs text-[#8B6F47] p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="font-medium text-blue-800 mb-1">macOS Note:</p>
                  <p>If Cmd+Space conflicts with Spotlight, consider using Cmd+Shift+S for Start/Pause Timer.</p>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="pulse" className="space-y-6 mt-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[#5C4033]">Pulse Animations</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-[#FFF9E6] rounded-lg border border-[#8B6F47]/10">
                    <div>
                      <p className="font-medium text-[#5C4033]">Time Awareness Pulse</p>
                      <p className="text-sm text-[#8B6F47]">Gentle reminder every few minutes</p>
                    </div>
                    <Switch
                      checked={tempPulseSettings.timeAwarenessEnabled}
                      onCheckedChange={(checked) =>
                        setTempPulseSettings({ ...tempPulseSettings, timeAwarenessEnabled: checked })
                      }
                    />
                  </div>
                  
                  {tempPulseSettings.timeAwarenessEnabled && (
                    <div className="ml-6 flex items-center gap-2">
                      <span className="text-sm text-[#8B6F47]">Interval:</span>
                      <Input
                        type="number"
                        value={tempPulseSettings.timeAwarenessInterval}
                        onChange={(e) =>
                          setTempPulseSettings({
                            ...tempPulseSettings,
                            timeAwarenessInterval: parseInt(e.target.value) || 30
                          })
                        }
                        min="5"
                        max="120"
                        className="w-20 text-center"
                      />
                      <span className="text-sm text-[#8B6F47]">minutes</span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between p-3 bg-[#FFF9E6] rounded-lg border border-[#8B6F47]/10">
                    <div>
                      <p className="font-medium text-[#5C4033]">Celebration Pulse</p>
                      <p className="text-sm text-[#8B6F47]">Celebrate focus milestones (5, 15, 30+ min)</p>
                    </div>
                    <Switch
                      checked={tempPulseSettings.celebrationEnabled}
                      onCheckedChange={(checked) =>
                        setTempPulseSettings({ ...tempPulseSettings, celebrationEnabled: checked })
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-[#FFF9E6] rounded-lg border border-[#8B6F47]/10">
                    <div>
                      <p className="font-medium text-[#5C4033]">Incognito Mode Pulse</p>
                      <p className="text-sm text-[#8B6F47]">Subtle presence indicator in pill view</p>
                    </div>
                    <Switch
                      checked={tempPulseSettings.incognitoEnabled}
                      onCheckedChange={(checked) =>
                        setTempPulseSettings({ ...tempPulseSettings, incognitoEnabled: checked })
                      }
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter className="gap-2 mt-6">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleRestoreDefaults}
                  variant="outline"
                  className="border-[#8B6F47]/30 text-[#8B6F47] hover:bg-[#FFF9E6]"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restore Defaults
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Reset all settings to default values</p></TooltipContent>
            </Tooltip>
            <Button
              onClick={onClose}
              variant="outline"
              className="border-[#8B6F47]/30 text-[#8B6F47] hover:bg-[#FFF9E6]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-[#F59E0B] hover:bg-[#D97706] text-white"
            >
              Save Settings
            </Button>
          </DialogFooter>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}