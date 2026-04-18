'use client';

import { useEffect, useState } from 'react';

interface CountdownTimerProps {
  seconds: number;
  onComplete?: () => void;
  compact?: boolean;
}

export function CountdownTimer({ seconds, onComplete, compact = false }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) {
      onComplete?.();
      return;
    }

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [remaining, onComplete]);

  const days = Math.floor(remaining / (24 * 60 * 60));
  const hours = Math.floor((remaining % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((remaining % (60 * 60)) / 60);
  const secs = remaining % 60;

  if (compact) {
    return (
      <span
        style={{
          fontSize: '13px',
          fontFamily: 'var(--font-mono)',
          fontWeight: 500,
          color: '#55cdff',
        }}
      >
        {days > 0 && `${days}d ${hours}h`}
        {days === 0 && hours > 0 && `${hours}h ${minutes}m`}
        {days === 0 && hours === 0 && `${minutes}m ${secs}s`}
      </span>
    );
  }

  const timerBlocks = [
    { value: days, label: 'days' },
    { value: hours, label: 'hours' },
    { value: minutes, label: 'mins' },
    { value: secs, label: 'secs' },
  ];

  return (
    <div className="flex gap-2">
      {timerBlocks.map((block) => (
        <div
          key={block.label}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-default)',
            borderRadius: '6px',
            padding: '8px 12px',
          }}
        >
          <span
            style={{
              fontSize: '20px',
              fontWeight: 590,
              color: '#55cdff',
              fontFamily: 'var(--font-mono)',
              lineHeight: 1.2,
            }}
          >
            {block.value.toString().padStart(2, '0')}
          </span>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 500,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              marginTop: '4px',
            }}
          >
            {block.label}
          </span>
        </div>
      ))}
    </div>
  );
}
