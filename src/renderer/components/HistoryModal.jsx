import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';
import { FileText, ChevronsRight, ChevronLeft, ChevronRight, History } from 'lucide-react';
import { format } from 'date-fns';

const ITEMS_PER_PAGE = 5;

export default function HistoryModal({ isOpen, onClose, sessions, onUseTask }) {
  const [currentPage, setCurrentPage] = useState(0);

  const totalPages = Math.ceil(sessions.length / ITEMS_PER_PAGE);
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const paginatedSessions = sessions.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    if (isOpen) setCurrentPage(0);
  }, [isOpen]);

  const handleUseAndClose = (session) => {
    onUseTask(session);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent style={{ background: '#FFFEF8', borderColor: '#D97706', maxWidth: '32rem' }}>
        <DialogHeader>
          <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History style={{ width: 24, height: 24, color: '#D97706' }} />
            Session History
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3" style={{ padding: '1rem 0', minHeight: 250 }}>
          {paginatedSessions.length > 0 ? paginatedSessions.map((session) => (
            <div
              key={session.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem',
                background: '#FFF9E6',
                borderRadius: '0.375rem',
                border: '1px solid transparent',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(245,158,11,0.5)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
            >
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <p style={{ fontWeight: 500, color: '#5C4033', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {session.task}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: '#8B6F47' }}>
                  <span>{Math.round(session.durationMinutes)} min</span>
                  <span>{format(new Date(session.createdAt), 'MMM d, yyyy')}</span>
                  {session.notes && (
                    <Tooltip>
                      <TooltipTrigger>
                        <FileText style={{ width: 12, height: 12, color: '#F59E0B' }} />
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
                    style={{ color: '#F59E0B', borderRadius: '9999px', flexShrink: 0, marginLeft: '0.5rem' }}
                  >
                    <ChevronsRight style={{ width: 20, height: 20 }} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Use this task again</p></TooltipContent>
              </Tooltip>
            </div>
          )) : (
            <p style={{ textAlign: 'center', fontSize: '0.875rem', color: '#8B6F47', paddingTop: '4rem' }}>
              No sessions recorded yet.
            </p>
          )}
        </div>

        <DialogFooter className="dialog-footer-between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          {sessions.length > ITEMS_PER_PAGE ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Button variant="outline" size="icon" onClick={() => setCurrentPage((p) => Math.max(p - 1, 0))} disabled={currentPage === 0}>
                <ChevronLeft style={{ width: 16, height: 16 }} />
              </Button>
              <span style={{ fontSize: '0.875rem', color: '#8B6F47', width: '5rem', textAlign: 'center' }}>
                Page {currentPage + 1} of {totalPages}
              </span>
              <Button variant="outline" size="icon" onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages - 1))} disabled={currentPage === totalPages - 1}>
                <ChevronRight style={{ width: 16, height: 16 }} />
              </Button>
            </div>
          ) : <div />}
          <Button onClick={() => onClose()} style={{ background: '#F59E0B', color: 'white' }}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
