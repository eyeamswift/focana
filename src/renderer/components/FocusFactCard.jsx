import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Mail, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function FocusFactCard({
  fact,
  initialReaction = null,
  existingEmail = '',
  emailAlreadySent = false,
  onReact,
  onReadArticle,
  onEmailArticle,
  onContinue,
}) {
  const [reaction, setReaction] = useState(initialReaction);
  const [emailStage, setEmailStage] = useState(emailAlreadySent ? 'sent' : 'idle');
  const [email, setEmail] = useState(existingEmail);
  const [error, setError] = useState('');

  useEffect(() => {
    setReaction(initialReaction);
    setEmail(existingEmail);
    setEmailStage(emailAlreadySent ? 'sent' : 'idle');
    setError('');
  }, [emailAlreadySent, existingEmail, fact?.id, initialReaction]);

  const normalizedEmail = email.trim();
  const validEmail = useMemo(() => EMAIL_PATTERN.test(normalizedEmail), [normalizedEmail]);

  if (!fact) return null;

  const handleReaction = (nextReaction) => {
    setReaction(nextReaction);
    setError('');
    if (nextReaction !== 'up' && emailStage !== 'sent') setEmailStage('idle');
    onReact?.(nextReaction);
  };

  const requestEmail = async () => {
    if (emailStage === 'sending' || emailStage === 'sent') return;
    if (!existingEmail && emailStage !== 'form' && emailStage !== 'error') {
      setEmailStage('form');
      return;
    }
    if (!validEmail) {
      setError('Enter a valid email address.');
      return;
    }

    setEmailStage('sending');
    setError('');
    try {
      await onEmailArticle?.(normalizedEmail);
      setEmailStage('sent');
    } catch (requestError) {
      setEmailStage('error');
      setError(requestError?.message || 'That email did not go through. You can try again.');
    }
  };

  return (
    <section className="focus-fact-card" role="region" aria-labelledby="focus-fact-title" data-testid="focus-fact-card">
      <div className="focus-fact-card__eyebrow">A little something for after focus</div>
      <h2 id="focus-fact-title" className="focus-fact-card__title">Focus Fact</h2>
      <p className="focus-fact-card__fact">{fact.text}</p>
      <button
        type="button"
        className="focus-fact-card__source"
        onClick={onReadArticle}
        aria-label={`Read ${fact.articleTitle} in your browser`}
      >
        <span>{fact.sourceLabel}</span>
        <ExternalLink aria-hidden="true" size={15} />
      </button>

      <div className="focus-fact-card__reaction" aria-label="Was this Focus Fact useful?">
        <span>Useful?</span>
        <button
          type="button"
          className="focus-fact-card__reaction-button"
          aria-label="This Focus Fact was useful"
          aria-pressed={reaction === 'up'}
          onClick={() => handleReaction('up')}
        >
          <ThumbsUp aria-hidden="true" size={18} />
        </button>
        <button
          type="button"
          className="focus-fact-card__reaction-button"
          aria-label="This Focus Fact was not useful"
          aria-pressed={reaction === 'down'}
          onClick={() => handleReaction('down')}
        >
          <ThumbsDown aria-hidden="true" size={18} />
        </button>
      </div>

      {reaction === 'down' ? (
        <p className="focus-fact-card__status" role="status">Thanks. This fact will stay out of future rotations.</p>
      ) : null}

      {reaction === 'up' ? (
        <div className="focus-fact-card__email" data-testid="focus-fact-email-panel">
          {emailStage === 'form' || emailStage === 'error' ? (
            <label className="focus-fact-card__email-field">
              <span>Email address</span>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-describedby="focus-fact-email-promise focus-fact-email-error"
              />
            </label>
          ) : null}
          {emailStage === 'sent' ? (
            <p className="focus-fact-card__status" role="status">Article email requested. Check your inbox in a moment.</p>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="focus-fact-card__email-button"
              onClick={requestEmail}
              disabled={emailStage === 'sending'}
              data-testid="focus-fact-email-action"
            >
              <Mail aria-hidden="true" size={17} />
              {emailStage === 'sending' ? 'Sending one article…' : 'Email me the article'}
            </Button>
          )}
          <p id="focus-fact-email-promise" className="focus-fact-card__promise">
            One article email only. This does not subscribe you to marketing.
          </p>
          <p id="focus-fact-email-error" className="focus-fact-card__error" role="alert">{error}</p>
        </div>
      ) : null}

      <Button type="button" className="focus-fact-card__continue" onClick={onContinue}>
        Continue
      </Button>
    </section>
  );
}
