import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';
import { FileText, ChevronsRight, ChevronLeft, ChevronRight, History, NotebookPen, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';

const ITEMS_PER_PAGE = 5;
const formatSessionDate = (createdAt) => {
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return 'Unknown date';
  return format(parsed, 'MMM d, yyyy');
};

export default function HistoryModal({
  isOpen,
  onClose,
  sessions,
  onUseTask,
  onPreviewTask,
  onDeleteSession,
  onDeleteSessions,
}) {
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeFilter, setActiveFilter] = useState('needs-attention');
  const [pendingDelete, setPendingDelete] = useState(null);

  const filteredSessions = sessions.filter((session) => {
    if (activeFilter === 'completed') return !!session?.completed;
    return !session?.completed;
  });

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / ITEMS_PER_PAGE));
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const paginatedSessions = filteredSessions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const pageSessionIds = paginatedSessions.map((session) => session.id);
  const allOnPageSelected = pageSessionIds.length > 0 && pageSessionIds.every((id) => selectedIds.includes(id));

  useEffect(() => {
    if (isOpen) {
      setCurrentPage(0);
      setSelectedIds([]);
      setActiveFilter('needs-attention');
      setPendingDelete(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(filteredSessions.length / ITEMS_PER_PAGE) - 1);
    setCurrentPage((prev) => Math.min(prev, maxPage));
    setSelectedIds((prev) => prev.filter((id) => filteredSessions.some((session) => session.id === id)));
  }, [filteredSessions]);

  const handleUseAndClose = (session) => {
    onUseTask(session);
  };

  const toggleSessionSelection = (sessionId) => {
    setSelectedIds((prev) => (
      prev.includes(sessionId)
        ? prev.filter((id) => id !== sessionId)
        : [...prev, sessionId]
    ));
  };

  const handleToggleSelectPage = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageSessionIds.includes(id)));
      return;
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...pageSessionIds])));
  };

  const handleDeleteSelected = async () => {
    if (!selectedIds.length) return;
    setPendingDelete({
      type: 'bulk',
      ids: [...selectedIds],
      label: `${selectedIds.length} selected session${selectedIds.length === 1 ? '' : 's'}`,
    });
  };

  const handleDeleteOne = async (e, sessionId) => {
    e.stopPropagation();
    const session = sessions.find((item) => item.id === sessionId);
    setPendingDelete({
      type: 'single',
      ids: [sessionId],
      label: session?.task || 'this session',
    });
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete?.ids?.length) {
      setPendingDelete(null);
      return;
    }

    if (pendingDelete.type === 'single') {
      await onDeleteSession?.(pendingDelete.ids[0]);
    } else {
      await onDeleteSessions?.(pendingDelete.ids);
    }

    setSelectedIds((prev) => prev.filter((id) => !pendingDelete.ids.includes(id)));
    setPendingDelete(null);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent style={{ background: 'var(--bg-surface)', borderColor: 'var(--brand-action)', maxWidth: '32rem' }}>
        <button className="dialog-close-btn" onClick={onClose} aria-label="Close">
          <X style={{ width: 16, height: 16 }} />
        </button>
        <DialogHeader>
          <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History style={{ width: 24, height: 24, color: 'var(--brand-action)' }} />
            Session History
          </DialogTitle>
        </DialogHeader>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
          <Button
            type="button"
            size="sm"
            variant={activeFilter === 'needs-attention' ? 'default' : 'outline'}
            onClick={() => setActiveFilter('needs-attention')}
            style={activeFilter === 'needs-attention' ? { background: 'var(--brand-primary)', color: 'var(--text-on-brand)' } : undefined}
          >
            Needs Attention
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeFilter === 'completed' ? 'default' : 'outline'}
            onClick={() => setActiveFilter('completed')}
            style={activeFilter === 'completed' ? { background: 'var(--brand-primary)', color: 'var(--text-on-brand)' } : undefined}
          >
            Completed
          </Button>
        </div>

        <div className="space-y-3" style={{ padding: '1rem 0', minHeight: 250 }}>
          {paginatedSessions.length > 0 ? paginatedSessions.map((session) => (
            <div
              key={session.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem',
                background: 'var(--bg-card)',
                borderRadius: '0.375rem',
                border: `1px solid ${selectedIds.includes(session.id) ? 'var(--border-focus)' : 'transparent'}`,
                transition: 'border-color 0.15s',
              }}
              onClick={() => onPreviewTask?.(session)}
            >
              <label
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.375rem', marginRight: '0.125rem' }}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(session.id)}
                  onChange={() => toggleSessionSelection(session.id)}
                  aria-label={`Select session ${session.task}`}
                  style={{ width: 16, height: 16, accentColor: 'var(--brand-primary)', cursor: 'pointer' }}
                />
              </label>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {session.task}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <span>{Math.round(session.durationMinutes)} min</span>
                  <span>{formatSessionDate(session.createdAt)}</span>
                  {session.notes && (
                    <Tooltip>
                      <TooltipTrigger>
                        <FileText style={{ width: 12, height: 12, color: 'var(--brand-primary)' }} />
                      </TooltipTrigger>
                      <TooltipContent><p>Has notes</p></TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.125rem', marginLeft: '0.5rem', flexShrink: 0 }}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label="Preview Session Notes"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreviewTask?.(session);
                      }}
                      size="icon"
                      variant="ghost"
                      style={{ color: 'var(--text-secondary)', borderRadius: '9999px' }}
                    >
                      <NotebookPen style={{ width: 18, height: 18 }} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>View/Add notes</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label="Use This Task"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUseAndClose(session);
                      }}
                      size="icon"
                      variant="ghost"
                      style={{ color: 'var(--brand-primary)', borderRadius: '9999px' }}
                    >
                      <ChevronsRight style={{ width: 20, height: 20 }} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Open this task</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label="Delete Session"
                      onClick={(e) => handleDeleteOne(e, session.id)}
                      size="icon"
                      variant="ghost"
                      style={{ color: 'var(--error)', borderRadius: '9999px' }}
                    >
                      <Trash2 style={{ width: 18, height: 18 }} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Delete session</p></TooltipContent>
                </Tooltip>
              </div>
            </div>
          )) : (
            <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)', paddingTop: '4rem' }}>
              No sessions for the current filter.
            </p>
          )}
        </div>

        <DialogFooter className="dialog-footer-between" style={{ flexWrap: 'nowrap', alignItems: 'flex-end', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', rowGap: '0.5rem', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
            {filteredSessions.length > 0 && (
              <>
                <Button variant="outline" onClick={handleToggleSelectPage}>
                  {allOnPageSelected ? 'Unselect Page' : 'Select Page'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDeleteSelected}
                  disabled={selectedIds.length === 0}
                  style={{ color: selectedIds.length === 0 ? 'var(--text-secondary)' : 'var(--error)' }}
                >
                  Delete Selected{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
                </Button>
              </>
            )}
            {filteredSessions.length > ITEMS_PER_PAGE && (
              <>
                <Button variant="outline" size="icon" onClick={() => setCurrentPage((p) => Math.max(p - 1, 0))} disabled={currentPage === 0}>
                  <ChevronLeft style={{ width: 16, height: 16 }} />
                </Button>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', width: '5rem', textAlign: 'center' }}>
                  Page {currentPage + 1} of {totalPages}
                </span>
                <Button variant="outline" size="icon" onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages - 1))} disabled={currentPage === totalPages - 1}>
                  <ChevronRight style={{ width: 16, height: 16 }} />
                </Button>
              </>
            )}
          </div>
          <Button onClick={() => onClose()} style={{ background: 'var(--brand-primary)', color: 'var(--text-on-brand)', flexShrink: 0 }}>
            Close
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingDelete !== null} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <DialogContent style={{ background: 'var(--bg-surface)', borderColor: 'var(--brand-action)', maxWidth: '26rem' }}>
          <DialogHeader>
            <DialogTitle>Delete session?</DialogTitle>
          </DialogHeader>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5 }}>
            {pendingDelete?.type === 'bulk'
              ? `This will permanently delete ${pendingDelete.label}.`
              : `This will permanently delete "${pendingDelete?.label || 'this session'}".`}
          </p>
          <DialogFooter style={{ marginTop: '1rem', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button variant="outline" onClick={() => setPendingDelete(null)} style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}>
              Cancel
            </Button>
            <Button onClick={handleConfirmDelete} style={{ background: 'var(--error)', color: 'white' }}>
              {pendingDelete?.type === 'bulk' ? 'Delete Sessions' : 'Delete Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
