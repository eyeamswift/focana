import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ParkingLotItem } from "@/entities/ParkingLotItem";

export default function QuickCaptureModal({ isOpen, onClose, onSave }) {
  const [thought, setThought] = useState('');

  useEffect(() => {
    if (isOpen) {
      setThought('');
      // Focus the textarea when modal opens
      setTimeout(() => {
        const textarea = document.querySelector('[data-quick-capture-textarea]');
        if (textarea) textarea.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (thought.trim()) {
      try {
        await ParkingLotItem.create({
          thought: thought.trim()
        });
        onSave();
        setThought('');
        onClose();
      } catch (error) {
        console.error('Error saving to parking lot:', error);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-[#FFFEF8] border-[#D97706] rounded-xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#5C4033] flex items-center gap-2">
            📝 Quick Capture
          </DialogTitle>
          <p className="text-sm text-[#8B6F47]">Capture a thought without losing focus</p>
        </DialogHeader>
        
        <div className="py-4">
          <Textarea
            data-quick-capture-textarea
            value={thought}
            onChange={(e) => setThought(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What's on your mind? Press Enter to save, Esc to cancel..."
            className="min-h-[100px] border-[#8B6F47]/30 bg-[#FFF9E6] text-[#5C4033] resize-none"
            maxLength={500}
          />
          <p className="text-xs text-[#8B6F47] mt-1 text-right">
            {thought.length}/500 characters
          </p>
        </div>
        
        <div className="flex justify-between">
          <Button
            onClick={onClose}
            variant="outline"
            className="border-[#8B6F47]/30 text-[#8B6F47] hover:bg-[#FFF9E6]"
          >
            Cancel (Esc)
          </Button>
          <Button
            onClick={handleSave}
            className="bg-[#F59E0B] hover:bg-[#D97706] text-white"
            disabled={!thought.trim()}
          >
            Save to Notepad (Enter)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}