'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

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
      <motion.span 
        key={remaining}
        initial={{ scale: 1.2, opacity: 0.5 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-sm font-mono font-bold text-cyan-400"
      >
        {days > 0 && `${days}d ${hours}h`}
        {days === 0 && hours > 0 && `${hours}h ${minutes}m`}
        {days === 0 && hours === 0 && `${minutes}m ${secs}s`}
      </motion.span>
    );
  }

  const timerBlocks = [
    { value: days, label: 'days' },
    { value: hours, label: 'hours' },
    { value: minutes, label: 'mins' },
    { value: secs, label: 'secs' },
  ];

  return (
    <div className="flex gap-3">
      {timerBlocks.map((block, idx) => (
        <motion.div 
          key={block.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          className="flex flex-col items-center rounded-xl glass border-purple-500/30 px-3 py-2 hover:border-purple-400/60 hover:bg-purple-500/5 transition-all"
        >
          <motion.span 
            key={`${block.label}-${block.value}`}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
            className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-300 font-mono"
          >
            {block.value.toString().padStart(2, '0')}
          </motion.span>
          <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold mt-1">{block.label}</span>
        </motion.div>
      ))}
    </div>
  );
}
