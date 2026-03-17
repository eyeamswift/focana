import React, { useEffect, useRef, useState } from 'react';
import { ThumbsDown, ThumbsUp, X } from 'lucide-react';

export default function SessionFeedbackPrompt({
  isOpen,
  onSelect,
  onContinue,
  onDismiss,
  autoAdvanceMs = 3000,
  continueDelayMs = 200,
}) {
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const continueTimerRef = useRef(null);

  useEffect(() => {
    if (continueTimerRef.current) {
      clearTimeout(continueTimerRef.current);
      continueTimerRef.current = null;
    }

    if (!isOpen) {
      setSelected(null);
      setSubmitting(false);
      return undefined;
    }

    setSelected(null);
    setSubmitting(false);
    continueTimerRef.current = setTimeout(() => {
      continueTimerRef.current = null;
      onContinue?.();
    }, autoAdvanceMs);

    return () => {
      if (continueTimerRef.current) {
        clearTimeout(continueTimerRef.current);
        continueTimerRef.current = null;
      }
    };
  }, [autoAdvanceMs, isOpen, onContinue]);

  const clearContinueTimer = () => {
    if (continueTimerRef.current) {
      clearTimeout(continueTimerRef.current);
      continueTimerRef.current = null;
    }
  };

  const handleSelect = async (feedback) => {
    if (!isOpen || submitting || selected) return;

    setSelected(feedback);
    setSubmitting(true);
    clearContinueTimer();

    try {
      await onSelect?.(feedback);
    } finally {
      continueTimerRef.current = setTimeout(() => {
        continueTimerRef.current = null;
        onContinue?.();
      }, continueDelayMs);
    }
  };

  const handleDismiss = () => {
    clearContinueTimer();
    (onDismiss || onContinue)?.();
  };

  const buildThumbStyle = (feedback) => {
    const isSelected = selected === feedback;
    return {
      borderRadius: '9999px',
      border: `1px solid ${isSelected ? 'var(--brand-action)' : 'var(--border-strong)'}`,
      background: isSelected
        ? 'linear-gradient(135deg, var(--brand-primary) 0%, color-mix(in srgb, var(--brand-primary) 72%, var(--brand-action)) 100%)'
        : 'var(--bg-surface)',
      color: isSelected ? 'var(--text-on-brand)' : 'var(--text-secondary)',
      width: '3rem',
      height: '3rem',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: isSelected
        ? '0 10px 22px rgba(185, 78, 16, 0.18)'
        : '0 1px 2px rgba(46, 31, 24, 0.08)',
      transition: 'transform 120ms ease, border-color 120ms ease, background 120ms ease, color 120ms ease, box-shadow 120ms ease',
      cursor: submitting ? 'default' : 'pointer',
    };
  };

  return (
    <div
      className="electron-no-drag"
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.9rem',
        padding: '0.5rem 0 0.25rem',
      }}
    >
      <button
        type="button"
        aria-label="Close feedback prompt"
        onClick={handleDismiss}
        style={{
          position: 'absolute',
          top: '-0.1rem',
          right: 0,
          width: '2rem',
          height: '2rem',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '9999px',
          border: '1px solid var(--border-default)',
          background: 'var(--bg-card)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          boxShadow: '0 1px 2px rgba(46, 31, 24, 0.08)',
        }}
      >
        <X style={{ width: 14, height: 14 }} />
      </button>

      <div style={{ textAlign: 'center', display: 'grid', gap: '0.35rem' }}>
        <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.98rem' }}>
          How was Focana this session?
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
          Optional
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <button
          type="button"
          aria-label="Thumbs up"
          onClick={() => { void handleSelect('up'); }}
          disabled={submitting}
          style={buildThumbStyle('up')}
        >
          <ThumbsUp style={{ width: 18, height: 18 }} />
        </button>
        <button
          type="button"
          aria-label="Thumbs down"
          onClick={() => { void handleSelect('down'); }}
          disabled={submitting}
          style={buildThumbStyle('down')}
        >
          <ThumbsDown style={{ width: 18, height: 18 }} />
        </button>
      </div>
    </div>
  );
}
