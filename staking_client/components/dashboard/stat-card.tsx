'use client';

import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  subtext?: string;
  variant?: 'default' | 'primary' | 'success';
  index?: number;
}

export function StatCard({ label, value, icon: Icon, subtext, variant = 'default', index = 0 }: StatCardProps) {
  const iconColors = {
    default: '#8b5cf6',
    primary: '#55cdff',
    success: '#27a644',
  };

  const iconBgColors = {
    default: 'rgba(139, 92, 246, 0.1)',
    primary: 'rgba(85, 205, 255, 0.1)',
    success: 'rgba(39, 166, 68, 0.1)',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: '8px',
        padding: '20px',
        transition: 'border-color 0.2s ease',
        cursor: 'default',
      }}
      className="hover:border-[#55cdff]/40"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p
            style={{
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
            }}
          >
            {label}
          </p>
          <p
            style={{
              marginTop: '8px',
              fontSize: '28px',
              fontWeight: 590,
              letterSpacing: '-0.15px',
              color: 'var(--text-primary)',
              lineHeight: 1.2,
            }}
          >
            {value}
          </p>
          {subtext && (
            <p
              style={{
                marginTop: '6px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
              }}
            >
              {subtext}
            </p>
          )}
        </div>
        <div
          style={{
            borderRadius: '8px',
            backgroundColor: iconBgColors[variant],
            padding: '10px',
          }}
        >
          <Icon
            style={{ width: '20px', height: '20px', color: iconColors[variant] }}
          />
        </div>
      </div>
    </motion.div>
  );
}
