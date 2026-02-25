import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function StartSessionModal({ isOpen, onClose, task, onStart }) {
  const [minutes, setMinutes] = useState('25');

  const handleStart = (selectedMode) => {
    if (selectedMode === 'freeflow') {
      onStart('freeflow', 0);
    } else {
      const numMinutes = parseInt(minutes);
      if (numMinutes >= 1 && numMinutes <= 240) {
        onStart('timed', numMinutes);
      }
    }
  };

  const handleOpenChange = (open) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm bg-[#FFF9E6] border-[#D97706] rounded-xl shadow-2xl">
        <TooltipProvider>
          <DialogHeader className="text-center pb-2">
            <DialogTitle className="text-xl font-bold text-[#5C4033]">
              Ready to focus on:
            </DialogTitle>
            <p className="text-md text-[#D97706] font-semibold px-4 break-words">
              "{task}"
            </p>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => handleStart('freeflow')}
                  className="w-full h-12 text-lg bg-[#F59E0B] hover:bg-[#D97706] text-white"
                >
                  Start Freeflow
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Timer will count up from 00:00.</p>
              </TooltipContent>
            </Tooltip>

            <div className="flex items-center">
              <span className="flex-1 h-px bg-[#8B6F47]/20" />
              <span className="px-2 text-xs text-[#8B6F47]">OR</span>
              <span className="flex-1 h-px bg-[#8B6F47]/20" />
            </div>

            <div className="flex items-center justify-between gap-2 p-2 bg-[#FFFEF8] border border-[#8B6F47]/20 rounded-lg">
                <Input
                  type="number"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder="minutes"
                  className="w-24 h-9 text-center border-[#8B6F47]/30 text-[#5C4033] bg-white"
                  min="1"
                  max="240"
                  onKeyDown={(e) => {
                     if (e.key === 'Enter') handleStart('timed');
                  }}
                />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => handleStart('timed')}
                    className="flex-1 h-9 bg-white text-[#D97706] border border-[#D97706] hover:bg-[#D97706]/10"
                    variant="outline"
                  >
                    Set Timer
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Start a countdown from the specified minutes.</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}