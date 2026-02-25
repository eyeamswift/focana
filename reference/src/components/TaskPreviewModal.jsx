import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Edit3 } from "lucide-react";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

export default function TaskPreviewModal({ 
  isOpen, 
  onClose, 
  session,
  onUseTask,
  onUpdateNotes
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');

  useEffect(() => {
    if (session) {
      setEditedNotes(session.notes || '');
    }
  }, [session]);

  if (!session) return null;

  const handleUseTask = () => {
    onUseTask(session);
    onClose();
  };

  const handleSaveNotes = () => {
    onUpdateNotes(session.id, editedNotes.trim());
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedNotes(session.notes || '');
    setIsEditing(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-[#FFFEF8] border-[#D97706] rounded-xl shadow-2xl">
        <TooltipProvider>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#5C4033] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#F59E0B]" />
              "{session.task}"
            </DialogTitle>
            <p className="text-[#8B6F47] text-sm">
              Last session: {Math.round(session.duration_minutes)} minutes
            </p>
          </DialogHeader>
          
          <div className="py-4">
            {session.notes && !isEditing ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-[#8B6F47]">
                  📝 Last notes:
                </p>
                <div className="p-3 bg-[#FFF9E6] rounded-lg border border-[#8B6F47]/10">
                  <p className="text-[#5C4033] text-sm leading-relaxed">
                    {session.notes}
                  </p>
                </div>
              </div>
            ) : isEditing ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-[#8B6F47]">
                  Edit your notes:
                </p>
                <Textarea
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  className="min-h-[100px] border-[#8B6F47]/30 bg-[#FFF9E6] text-[#5C4033]"
                  maxLength={500}
                  placeholder="Where did you leave off?"
                />
                <p className="text-xs text-[#8B6F47] text-right">
                  {editedNotes.length}/500 characters
                </p>
                <div className="flex gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleSaveNotes}
                        size="sm"
                        className="bg-[#F59E0B] hover:bg-[#D97706] text-white"
                      >
                        Save Changes
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Save your edited notes</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleCancelEdit}
                        size="sm"
                        variant="outline"
                        className="border-[#8B6F47]/30 text-[#8B6F47]"
                      >
                        Cancel
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Discard changes and go back</p></TooltipContent>
                  </Tooltip>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-[#8B6F47] text-sm">
                  No notes from your last session
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="border-[#8B6F47]/30 text-[#8B6F47] hover:bg-[#FFF9E6]"
                >
                  Cancel
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Close this preview</p></TooltipContent>
            </Tooltip>
            
            {session.notes && !isEditing && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setIsEditing(true)}
                    variant="outline"
                    className="border-[#F59E0B] text-[#F59E0B] hover:bg-[#F59E0B] hover:text-white"
                  >
                    <Edit3 className="w-4 h-4 mr-1" />
                    Edit Notes
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Edit the notes for this task</p></TooltipContent>
              </Tooltip>
            )}
            
            {!isEditing && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleUseTask}
                    className="bg-[#F59E0B] hover:bg-[#D97706] text-white"
                  >
                    Use This Task
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Load this task into the main screen</p></TooltipContent>
              </Tooltip>
            )}
          </DialogFooter>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}