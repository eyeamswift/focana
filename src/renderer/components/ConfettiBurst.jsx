import React, { useMemo } from 'react';

const COLORS = ['var(--brand-primary)', 'var(--brand-action)', '#FCD34D', '#FB923C', '#A16207', '#FED7AA'];

export default function ConfettiBurst({ burstId = 0, count = 56 }) {
  const pieces = useMemo(() => {
    return Array.from({ length: count }, () => {
      const size = 6 + Math.random() * 8;
      return {
        left: `${Math.random() * 100}%`,
        top: `${-14 - Math.random() * 20}px`,
        delay: `${Math.random() * 0.22}s`,
        duration: `${1.2 + Math.random() * 0.9}s`,
        fall: `${95 + Math.random() * 25}vh`,
        drift: `${-110 + Math.random() * 220}px`,
        rotate: `${480 + Math.random() * 720}deg`,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: `${size}px`,
      };
    });
  }, [burstId, count]);

  return (
    <div className="confetti-overlay" aria-hidden="true">
      {pieces.map((piece, index) => (
        <span
          key={`${burstId}-${index}`}
          className="confetti-piece"
          style={{
            left: piece.left,
            top: piece.top,
            animationDelay: piece.delay,
            '--confetti-duration': piece.duration,
            '--confetti-fall': piece.fall,
            '--confetti-drift': piece.drift,
            '--confetti-rotate': piece.rotate,
            '--confetti-color': piece.color,
            '--confetti-size': piece.size,
          }}
        />
      ))}
    </div>
  );
}
