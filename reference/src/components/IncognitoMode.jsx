
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Play, Pause, Square, ClipboardList } from 'lucide-react';

export default function IncognitoMode({ 
  task, 
  isRunning, 
  time, 
  onDoubleClick,
  onOpenDistractionJar,
  thoughtCount = 0,
  onPlay,
  onPause,
  onStop,
  isElectron = false,
  pulseEnabled = true
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [shouldPulse, setShouldPulse] = useState(false);

  // Incognito pulse every 10-15 seconds (when not hovered)
  useEffect(() => {
    if (pulseEnabled && !isHovered) {
      const interval = setInterval(() => {
        setShouldPulse(true);
        setTimeout(() => setShouldPulse(false), 3000);
      }, 8000);

      return () => clearInterval(interval);
    }
  }, [pulseEnabled, isHovered]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    if (task && task.trim()) {
      return task;
    }
    return '';
  };

  const getTaskColor = () => {
    if (isRunning) return 'text-[#5C4033]';
    return 'text-[#8B6F47]';
  };
  
  const getTimerColor = () => {
    return isRunning ? 'text-[#D97706]' : 'text-[#8B6F47]';
  };

  const handleDoubleClick = (e) => {
    // Stop propagation for double click to prevent drag interference
    e.stopPropagation();
    onDoubleClick();
  };

  return (
    <>
      <style>
        {`
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
          
          .animate-pulse-incognito {
            animation: pulse-incognito 3s ease-in-out infinite;
          }
        `}
      </style>
      <div 
        className={`bg-[#FFFEF8]/90 backdrop-blur-sm rounded-full shadow-lg border border-black/5 ${shouldPulse && pulseEnabled ? 'animate-pulse-incognito' : ''}`}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ 
          cursor: isElectron ? 'default' : 'grab',
          pointerEvents: 'auto'
        }}
      >
        <div className="flex items-center justify-end gap-3 px-4 py-2">
          {/* Draggable area - allow mouse events to bubble up for drag functionality */}
          <div 
            className="group relative flex-1 flex items-center justify-between mr-3 gap-6"
            style={{ 
              cursor: isElectron ? 'default' : 'grab',
              pointerEvents: 'auto'
            }}
          >
            {/* Task on the left - only shows if there's a task */}
            {getStatusText() && (
              <span 
                className={`text-sm font-medium transition-colors duration-300 ${getTaskColor()}`}
                style={{ pointerEvents: 'none' }}
              >
                {getStatusText()}
              </span>
            )}
            
            {/* Timer in the middle */}
            <span 
              className={`text-lg font-mono font-bold transition-colors duration-300 ${getTimerColor()}`}
              style={{ pointerEvents: 'none' }}
            >
              {formatTime(time)}
            </span>

            {/* Unified Hint on hover */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/60 rounded-full pointer-events-none">
              <p className="text-xs text-white font-bold tracking-wide whitespace-nowrap drop-shadow-sm">
                Double-click to expand
              </p>
            </div>
          </div>
          
          {/* Right-side controls - these need to capture clicks */}
          <div className="flex items-center gap-2 z-10 flex-shrink-0">
            {/* Play/Pause Button */}
            <Button
              onClick={(e) => {
                e.stopPropagation();
                isRunning ? onPause() : onPlay();
              }}
              size="icon"
              variant="ghost"
              className="h-7 w-7 p-0 text-[#8B6F47] hover:text-[#5C4033] hover:bg-[#FFF9E6]/70 rounded-full transition-all duration-200"
              title={isRunning ? "Pause Timer" : "Resume Timer"}
              style={{ cursor: 'pointer', pointerEvents: 'auto' }}
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            
            {/* Stop Button */}
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onStop();
              }}
              size="icon"
              variant="ghost"
              className="h-7 w-7 p-0 text-[#8B6F47] hover:text-[#5C4033] hover:bg-[#FFF9E6]/70 rounded-full transition-all duration-200"
              title="Stop & Save Session"
              disabled={!task.trim()}
              style={{ cursor: 'pointer', pointerEvents: 'auto' }}
            >
              <Square className="w-4 h-4" />
            </Button>

            {/* Notepad Icon */}
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onOpenDistractionJar();
              }}
              size="icon"
              variant="ghost"
              className="h-7 w-7 p-0 text-[#8B6F47] hover:text-[#5C4033] hover:bg-[#FFF9E6]/70 rounded-full transition-all duration-200 z-10 relative flex-shrink-0"
              title="Open Notepad"
              style={{ cursor: 'pointer', pointerEvents: 'auto' }}
            >
              <ClipboardList className="w-4 h-4" />
              {thoughtCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#F59E0B] text-white text-xs rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  {thoughtCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
