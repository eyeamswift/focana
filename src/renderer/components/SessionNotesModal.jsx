import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';
import { CheckCircle, CircleDot, X } from 'lucide-react';
import SessionFeedbackPrompt from './SessionFeedbackPrompt';

export default function SessionNotesModal({
  isOpen,
  onClose,
  onSave,
  onComplete,
  onIncomplete,
  onResume,
  showResumeAction = false,
  sessionDuration,
  taskName,
  sessionFlowKey,
  flow = 'complete',
  feedbackPrompt = null,
}) {
  const [notes, setNotes] = useState('');
  const notesRef = useRef(null);

  useEffect(() => {
    setNotes('');
  }, [isOpen, sessionFlowKey]);

  const getCurrentNotes = () => {
    const liveValue = typeof notesRef.current?.value === 'string'
      ? notesRef.current.value
      : notes;
    return liveValue.trim();
  };

  const handleRequestClose = () => {
    setNotes('');
    onClose();
  };

  const handleSave = () => {
    onSave(getCurrentNotes());
    setNotes('');
  };

  const handleSkip = () => {
    handleRequestClose();
  };

  const handleComplete = () => {
    onComplete?.(getCurrentNotes());
    setNotes('');
  };

  const handleIncomplete = () => {
    onIncomplete?.(getCurrentNotes());
    setNotes('');
  };

  const handleResume = () => {
    onResume?.();
    setNotes('');
  };

  const formatDuration = (minutes) => {
    if (minutes < 1) return 'less than a minute';
    return minutes === 1 ? '1 minute' : `${Math.round(minutes)} minutes`;
  };

  const isStopDecisionFlow = flow === 'stop-decision';
  const isResumeLaterFlow = flow === 'resume-later';
  const safeTaskName = typeof taskName === 'string' && taskName.trim()
    ? taskName.trim()
    : 'Untitled task';
  const title = isStopDecisionFlow
    ? 'Did you finish?'
    : isResumeLaterFlow
      ? 'Where did you leave off?'
      : 'Great focus session!';
  const summaryText = isStopDecisionFlow
    ? `You spent ${formatDuration(sessionDuration)} on "${safeTaskName}".`
    : `${formatDuration(sessionDuration)} on "${safeTaskName}"`;
  const iconStyle = isStopDecisionFlow
    ? {
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
      }
    : {
        background: 'var(--brand-primary)',
      };

  const feedbackPromptActive = Boolean(feedbackPrompt?.isOpen);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (open || feedbackPromptActive) return;
      handleRequestClose();
    }}>
      <DialogContent
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--brand-action)',
          maxWidth: '25rem',
          maxHeight: 'min(calc(100vh - 1.75rem), 28rem)',
          padding: '1.25rem 1.25rem 1.1rem',
        }}
      >
        {!feedbackPromptActive && (
          <button className="dialog-close-btn" onClick={handleRequestClose} aria-label="Close">
            <X style={{ width: 16, height: 16 }} />
          </button>
        )}
        <DialogHeader style={{ textAlign: 'center', paddingBottom: '0.35rem' }}>
          <div style={{
            margin: '0 auto',
            width: '2.65rem',
            height: '2.65rem',
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.65rem',
            ...iconStyle,
          }}>
            {isStopDecisionFlow ? (
              <CircleDot style={{ width: 20, height: 20, color: 'var(--brand-action)' }} />
            ) : (
              <CheckCircle style={{ width: 24, height: 24, color: 'var(--text-on-brand)' }} />
            )}
          </div>
          <DialogTitle style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {title}
          </DialogTitle>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', lineHeight: 1.45, marginTop: '0.2rem' }}>
            {summaryText}
          </p>
        </DialogHeader>

        {feedbackPromptActive ? (
          <SessionFeedbackPrompt
            isOpen={feedbackPromptActive}
            onSelect={feedbackPrompt.onSelect}
            onContinue={feedbackPrompt.onContinue}
            onDismiss={feedbackPrompt.onDismiss}
            autoAdvanceMs={feedbackPrompt.autoAdvanceMs}
            continueDelayMs={feedbackPrompt.continueDelayMs}
          />
        ) : (
          <>
            <div className="space-y-4" style={{ padding: '0.3rem 0 0' }}>
              <div>
                <p style={{ color: 'var(--text-primary)', fontWeight: 500, marginBottom: '0.5rem' }}>
                  Where did you leave off? <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 400 }}>(optional)</span>
                </p>
                <Textarea
                  ref={notesRef}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Quick note about where to pick up next time..."
                  maxLength={500}
                  className="no-resize"
                  style={{ minHeight: 88, borderColor: 'var(--border-strong)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', textAlign: 'right' }}>
                  {notes.length}/500 characters
                </p>
              </div>
            </div>

            <DialogFooter style={{ marginTop: '0.85rem', flexDirection: 'column', alignItems: 'stretch', gap: '0.65rem' }}>
              {isStopDecisionFlow ? (
                <>
                  {showResumeAction ? (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={handleResume}
                            variant="outline"
                            size="sm"
                            style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
                          >
                            Resume
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Close this prompt and continue the current session</p></TooltipContent>
                      </Tooltip>
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={handleIncomplete}
                          variant="outline"
                          size="sm"
                          style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
                        >
                          No, Save for Later
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Save this session and keep the task active</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button onClick={handleComplete} size="sm" style={{ background: 'var(--brand-primary)', color: 'var(--text-on-brand)' }}>
                          Yes, Complete
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Save notes and mark the task complete</p></TooltipContent>
                    </Tooltip>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleSkip}
                        variant="outline"
                        size="sm"
                        style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
                      >
                        Skip
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Finish session without saving notes</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={handleSave} size="sm" style={{ background: 'var(--brand-primary)', color: 'var(--text-on-brand)' }}>
                        Save
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Save notes and finish session</p></TooltipContent>
                  </Tooltip>
                </div>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
