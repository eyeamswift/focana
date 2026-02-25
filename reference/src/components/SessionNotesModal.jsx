import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle } from "lucide-react";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

export default function SessionNotesModal({ 
  isOpen, 
  onClose, 
  onSave,
  sessionDuration,
  taskName 
}) {
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    onSave(notes.trim());
    setNotes('');
  };

  const handleSkip = () => {
    onClose(); 
    setNotes('');
  };

  const formatDuration = (minutes) => {
    if (minutes < 1) return "less than a minute";
    return minutes === 1 ? "1 minute" : `${Math.round(minutes)} minutes`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-[#FFF9E6] border-[#D97706] rounded-xl shadow-2xl">
        <TooltipProvider>
          <DialogHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 bg-[#F59E0B] rounded-full flex items-center justify-center mb-3">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <DialogTitle className="text-xl font-bold text-[#5C4033]">
              🎯 Great focus session!
            </DialogTitle>
            <p className="text-[#8B6F47] text-sm">
              {formatDuration(sessionDuration)} on "{taskName}"
            </p>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div>
              <p className="text-[#5C4033] font-medium mb-2">
                Where did you leave off? <span className="text-[#8B6F47] text-sm font-normal">(optional)</span>
              </p>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Quick note about where to pick up next time..."
                className="min-h-[100px] border-[#8B6F47]/30 bg-[#FFFEF8] text-[#5C4033] resize-none"
                maxLength={500}
              />
              <p className="text-xs text-[#8B6F47] mt-1 text-right">
                {notes.length}/500 characters
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleSkip}
                  variant="outline"
                  className="border-[#8B6F47]/30 text-[#8B6F47] hover:bg-[#FFF9E6]"
                >
                  Skip
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Finish session without saving notes</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleSave}
                  className="bg-[#F59E0B] hover:bg-[#D97706] text-white"
                >
                  Save
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Save notes and finish session</p>
              </TooltipContent>
            </Tooltip>
          </DialogFooter>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}