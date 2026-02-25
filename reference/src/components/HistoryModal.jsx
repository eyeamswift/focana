import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, ChevronsRight, ChevronLeft, ChevronRight, History } from "lucide-react";
import { format } from 'date-fns';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

const ITEMS_PER_PAGE = 5;

export default function HistoryModal({ isOpen, onClose, sessions, onUseTask }) {
  const [currentPage, setCurrentPage] = useState(0);

  const totalPages = Math.ceil(sessions.length / ITEMS_PER_PAGE);
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedSessions = sessions.slice(startIndex, endIndex);

  useEffect(() => {
    // Reset to the first page whenever the modal is opened
    if (isOpen) {
      setCurrentPage(0);
    }
  }, [isOpen]);

  const handleUseAndClose = (session) => {
    onUseTask(session);
    onClose();
  };
  
  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages - 1));
  };
  
  const goToPreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 0));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-[#FFFEF8] border-[#D97706] shadow-2xl rounded-lg">
        <TooltipProvider>
          <DialogHeader>
            <DialogTitle className="text-[#5C4033] font-semibold text-lg flex items-center gap-2">
              <History className="w-6 h-6 text-[#D97706]" />
              Session History
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 py-4 min-h-[250px]">
            {paginatedSessions.length > 0 ? paginatedSessions.map(session => (
              <div key={session.id} className="flex items-center justify-between p-2 bg-[#FFF9E6] rounded-md border border-transparent hover:border-[#F59E0B]/50 transition-colors">
                <div className="flex-1 overflow-hidden">
                  <p className="font-medium text-[#5C4033] truncate">{session.task}</p>
                  <div className="flex items-center gap-3 text-xs text-[#8B6F47]">
                    <span>{Math.round(session.duration_minutes)} min</span>
                    <span>{format(new Date(session.created_date), 'MMM d, yyyy')}</span>
                    {session.notes && (
                        <Tooltip>
                            <TooltipTrigger>
                                <FileText className="w-3 h-3 text-[#F59E0B]" />
                            </TooltipTrigger>
                            <TooltipContent><p>Has notes</p></TooltipContent>
                        </Tooltip>
                    )}
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => handleUseAndClose(session)}
                      size="icon"
                      variant="ghost"
                      className="text-[#F59E0B] hover:bg-[#F59E0B]/10 rounded-full shrink-0 ml-2"
                    >
                      <ChevronsRight className="w-5 h-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Use this task again</p></TooltipContent>
                </Tooltip>
              </div>
            )) : <p className="text-center text-sm text-[#8B6F47] pt-16">No sessions recorded yet.</p>}
          </div>

          <DialogFooter className="sm:justify-between items-center flex-wrap gap-2">
            {sessions.length > ITEMS_PER_PAGE ? (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={goToPreviousPage} disabled={currentPage === 0}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-[#8B6F47] w-20 text-center">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <Button variant="outline" size="icon" onClick={goToNextPage} disabled={currentPage === totalPages - 1}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            ) : <div />}
            <DialogClose asChild>
              <Button type="button" className="bg-[#F59E0B] hover:bg-[#D97706] text-white">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}