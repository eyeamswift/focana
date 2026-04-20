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
  initialRecap = '',
  initialNextSteps = '',
}) {
  const [recap, setRecap] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const recapRef = useRef(null);
  const nextStepsRef = useRef(null);

  useEffect(() => {
    setRecap(typeof initialRecap === 'string' ? initialRecap : '');
    setNextSteps(typeof initialNextSteps === 'string' ? initialNextSteps : '');
  }, [initialNextSteps, initialRecap, isOpen, sessionFlowKey]);

  const getCurrentNotes = () => {
    const liveRecap = typeof recapRef.current?.value === 'string'
      ? recapRef.current.value
      : recap;
    const liveNextSteps = typeof nextStepsRef.current?.value === 'string'
      ? nextStepsRef.current.value
      : nextSteps;

    return {
      recap: liveRecap.trim(),
      nextSteps: liveNextSteps.trim(),
    };
  };

  const handleRequestClose = () => {
    setRecap(typeof initialRecap === 'string' ? initialRecap : '');
    setNextSteps(typeof initialNextSteps === 'string' ? initialNextSteps : '');
    onClose();
  };

  const handleSave = () => {
    onSave(getCurrentNotes());
    setRecap('');
    setNextSteps('');
  };

  const handleSkip = () => {
    handleRequestClose();
  };

  const handleComplete = () => {
    onComplete?.(getCurrentNotes());
    setRecap('');
    setNextSteps('');
  };

  const handleIncomplete = () => {
    onIncomplete?.(getCurrentNotes());
    setRecap('');
    setNextSteps('');
  };

  const handleResume = () => {
    onResume?.();
    setRecap('');
    setNextSteps('');
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
          maxHeight: 'min(calc(100vh - 1.75rem), 34rem)',
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
                <label htmlFor="session-next-steps" style={{ display: 'block', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Immediate next step <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 400 }}>(optional)</span>
                </label>
                <Textarea
                  id="session-next-steps"
                  name="next-steps"
                  ref={nextStepsRef}
                  value={nextSteps}
                  onChange={(e) => setNextSteps(e.target.value)}
                  placeholder="What should you do first when you come back?"
                  maxLength={500}
                  className="no-resize"
                  style={{ minHeight: 84, borderColor: 'var(--border-strong)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', textAlign: 'right' }}>
                  {nextSteps.length}/500 characters
                </p>
              </div>

              <div>
                <label htmlFor="session-recap" style={{ display: 'block', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Additional details <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 400 }}>(optional)</span>
                </label>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.45, margin: '0 0 0.5rem' }}>
                  Add any background information/details that will help you pick up where you left off, i.e. what you completed, relevant links, etc.
                </p>
                <Textarea
                  id="session-recap"
                  name="recap"
                  ref={recapRef}
                  value={recap}
                  onChange={(e) => setRecap(e.target.value)}
                  placeholder="Completed pieces, useful context, links, and reminders..."
                  maxLength={500}
                  className="no-resize"
                  style={{ minHeight: 88, borderColor: 'var(--border-strong)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', textAlign: 'right' }}>
                  {recap.length}/500 characters
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
