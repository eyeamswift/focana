import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Edit3, X, Save } from "lucide-react";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

export default function ContextBox({ notes, onUpdateNotes, onDismiss, isSessionActive = false }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState(notes);

  const handleSave = () => {
    onUpdateNotes(editedNotes.trim());
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedNotes(notes);
    setIsEditing(false);
  };

  if (!notes && !isEditing) return null;

  return (
    <Card className={`w-full max-w-[380px] bg-[#FFF9E6] border-[#8B6F47]/20 p-3 mt-2 transition-opacity duration-300 ${
      isSessionActive ? 'opacity-75 hover:opacity-100' : 'opacity-100'
    }`}>
      <TooltipProvider>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="text-xs font-medium text-[#8B6F47] mb-1">
              📝 Where you left off:
            </p>
            {!isEditing ? (
              <p className="text-sm text-[#5C4033] leading-relaxed">
                {notes}
              </p>
            ) : (
              <div className="space-y-2">
                <Textarea
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  className="min-h-[60px] text-sm border-[#8B6F47]/30 bg-[#FFFEF8]"
                  maxLength={500}
                />
                <div className="flex gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleSave}
                        size="sm"
                        className="h-7 px-2 bg-[#F59E0B] hover:bg-[#D97706] text-white"
                      >
                        <Save className="w-3 h-3 mr-1" />
                        Save
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Save changes</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleCancel}
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 border-[#8B6F47]/30 text-[#8B6F47]"
                      >
                        Cancel
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Discard changes</p></TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )}
          </div>
          
          {!isEditing && (
            <div className="flex gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setIsEditing(true)}
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-[#8B6F47] hover:bg-[#FFFEF8]"
                  >
                    <Edit3 className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Edit notes</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onDismiss}
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-[#8B6F47] hover:bg-[#FFFEF8]"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Dismiss notes</p></TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </TooltipProvider>
    </Card>
  );
}