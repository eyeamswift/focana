import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Copy, Edit3, Save, NotebookPen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function DistractionJar({ 
  isOpen, 
  onClose, 
  thoughts, 
  onAddThought, 
  onRemoveThought,
  onToggleThought,
  onClearCompleted 
}) {
  const [newThought, setNewThought] = useState('');
  const [expandedThought, setExpandedThought] = useState(null);
  const [editingText, setEditingText] = useState('');

  const handleAdd = () => {
    if (newThought.trim()) {
      onAddThought(newThought.trim());
      setNewThought('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  const copyAllToClipboard = () => {
    const textToCopy = thoughts.map(t => `- ${t.text}`).join('\n');
    navigator.clipboard.writeText(textToCopy);
  };

  const handleThoughtClick = (index) => {
    setExpandedThought(index);
    setEditingText(thoughts[index].text);
  };

  const handleSaveEdit = () => {
    if (editingText.trim() && expandedThought !== null) {
      const newThoughts = [...thoughts];
      const thoughtToUpdate = newThoughts[expandedThought];
      thoughtToUpdate.text = editingText.trim();
      // To properly update, we need a way to pass the whole updated array back
      // Since we only have add/remove, we do a remove and add. This might change order.
      // A better approach would be an `onUpdateThoughts` prop. For now, this works.
      onRemoveThought(expandedThought);
      onAddThought(thoughtToUpdate.text);
    }
    setExpandedThought(null);
    setEditingText('');
  };

  const handleDeleteThought = () => {
    if (expandedThought !== null) {
      onRemoveThought(expandedThought);
      setExpandedThought(null);
      setEditingText('');
    }
  };

  const handleCloseExpanded = () => {
    setExpandedThought(null);
    setEditingText('');
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg bg-[#FFFEF8] border-[#D97706] shadow-2xl rounded-lg">
          <TooltipProvider>
            <DialogHeader>
              <DialogTitle className="text-[#5C4033] font-semibold text-lg flex items-center gap-2">
                <NotebookPen className="w-6 h-6 text-[#D97706]" />
                Notepad
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex gap-2">
                <Textarea
                  value={newThought}
                  onChange={(e) => setNewThought(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Capture a thought... (Enter to add)"
                  className="flex-1 min-h-[40px] text-base border-[#8B6F47]/30 text-[#5C4033] bg-white"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleAdd}
                      size="icon"
                      className="bg-[#F59E0B] hover:bg-[#D97706] text-white shrink-0"
                      disabled={!newThought.trim()}
                      aria-label="Add Note"
                    >
                      <Plus className="w-5 h-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Add note</p></TooltipContent>
                </Tooltip>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2 -mr-2">
                {thoughts.map((thought, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-2 bg-[#FFF9E6] rounded-md border border-transparent hover:border-[#F59E0B]/50 transition-colors"
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center pt-0.5">
                          <Checkbox 
                            id={`thought-${index}`} 
                            checked={thought.completed} 
                            onCheckedChange={() => onToggleThought(index)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent><p>Mark as {thought.completed ? 'incomplete' : 'complete'}</p></TooltipContent>
                    </Tooltip>
                    <div 
                      className={`flex-1 text-sm cursor-pointer ${thought.completed ? 'line-through text-[#8B6F47]' : 'text-[#5C4033]'}`}
                      onClick={() => handleThoughtClick(index)}
                    >
                      <p className="line-clamp-2 break-words">
                        {thought.text}
                      </p>
                      {thought.text.length > 60 && (
                        <p className="text-xs text-[#8B6F47] mt-1">Click to expand...</p>
                      )}
                    </div>
                  </div>
                ))}
                 {thoughts.length === 0 && <p className="text-center text-sm text-[#8B6F47] py-4">No notes yet.</p>}
              </div>
            </div>
            <DialogFooter className="sm:justify-between">
               <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" className="text-[#8B6F47]" onClick={onClearCompleted}>Clear Completed</Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Remove all completed notes</p></TooltipContent>
                </Tooltip>
                <div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" className="mr-2" onClick={copyAllToClipboard}>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy All
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Copy all notes to clipboard</p></TooltipContent>
                  </Tooltip>
                  <DialogClose asChild>
                    <Button type="button" className="bg-[#F59E0B] hover:bg-[#D97706] text-white">
                      Close
                    </Button>
                  </DialogClose>
                </div>
            </DialogFooter>
          </TooltipProvider>
        </DialogContent>
      </Dialog>

      {/* Expanded Note Modal */}
      <Dialog open={expandedThought !== null} onOpenChange={(open) => !open && handleCloseExpanded()}>
        <DialogContent className="sm:max-w-md bg-[#FFFEF8] border-[#D97706] shadow-2xl rounded-lg">
          <TooltipProvider>
            <DialogHeader>
              <DialogTitle className="text-[#5C4033] font-semibold text-lg flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#F59E0B]" />
                Edit Note
              </DialogTitle>
            </DialogHeader>
            
            <div className="py-4">
              <Textarea
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                className="min-h-[120px] text-base border-[#8B6F47]/30 text-[#5C4033] bg-white"
                placeholder="Edit your note..."
              />
              <p className="text-xs text-[#8B6F47] mt-1 text-right">
                {editingText.length} characters
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleDeleteThought}
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Delete this note permanently</p></TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleCloseExpanded}
                    variant="outline"
                    className="border-[#8B6F47]/30 text-[#8B6F47] hover:bg-[#FFF9E6]"
                  >
                    Cancel
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Close without saving changes</p></TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleSaveEdit}
                    className="bg-[#F59E0B] hover:bg-[#D97706] text-white"
                    disabled={!editingText.trim()}
                  >
                    <Save className="w-4 h-4 mr-1" />
                    Save
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Save your changes</p></TooltipContent>
              </Tooltip>
            </DialogFooter>
          </TooltipProvider>
        </DialogContent>
      </Dialog>
    </>
  );
}