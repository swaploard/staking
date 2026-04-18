'use client';

import Link from 'next/link';
import { StakingPool } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Users, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

interface PoolCardProps {
  pool: StakingPool;
  userStaked?: number;
}

export function PoolCard({ pool, userStaked = 0 }: PoolCardProps) {
  const statusStyles: Record<string, { bg: string; color: string }> = {
    active: { bg: 'rgba(39, 166, 68, 0.12)', color: '#27a644' },
    inactive: { bg: 'rgba(138, 143, 152, 0.12)', color: '#8a8f98' },
    maintenance: { bg: 'rgba(255, 196, 124, 0.12)', color: '#ffc47c' },
  };

  const status = statusStyles[pool.status] || statusStyles.inactive;
  const tvlInMillions = (pool.tvl / 1000000).toFixed(2);

  return (
    <Link href={`/pools/${pool.id}`}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="group cursor-pointer"
      >
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: '8px',
            padding: '20px',
            transition: 'border-color 0.2s ease',
          }}
          className="hover:border-[#55cdff]/40"
        >
          {/* Header */}
          <div className="flex items-start justify-between" style={{ marginBottom: '16px' }}>
            <div>
              <h3
                style={{
                  fontSize: '16px',
                  fontWeight: 560,
                  color: 'var(--text-primary)',
                  transition: 'color 0.2s',
                }}
                className="group-hover:text-[#55cdff]"
              >
                {pool.name}
              </h3>
              <p style={{ marginTop: '4px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                {pool.description}
              </p>
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: '11px',
                fontWeight: 500,
                padding: '3px 8px',
                borderRadius: '4px',
                backgroundColor: status.bg,
                color: status.color,
              }}
            >
              {pool.status.charAt(0).toUpperCase() + pool.status.slice(1)}
            </span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '16px' }}>
            <div
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: '6px',
                padding: '12px',
              }}
            >
              <p style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                APY
              </p>
              <p className="flex items-center gap-1" style={{ marginTop: '6px', fontSize: '20px', fontWeight: 590, color: '#55cdff' }}>
                <TrendingUp style={{ width: '16px', height: '16px' }} />
                {pool.apy.toFixed(1)}%
              </p>
            </div>
            <div
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: '6px',
                padding: '12px',
              }}
            >
              <p style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                TVL
              </p>
              <p style={{ marginTop: '6px', fontSize: '20px', fontWeight: 590, color: 'var(--text-primary)' }}>
                ${tvlInMillions}M
              </p>
            </div>
          </div>

          {/* Meta */}
          <div className="flex gap-4" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            <div className="flex items-center gap-1.5">
              <Users style={{ width: '13px', height: '13px' }} />
              {pool.totalStakers.toLocaleString()} stakers
            </div>
            <div className="flex items-center gap-1.5">
              <Lock style={{ width: '13px', height: '13px' }} />
              Min {pool.minimumStake} SOL
            </div>
          </div>

          {/* User Stake */}
          {userStaked > 0 && (
            <div
              style={{
                marginTop: '16px',
                borderTop: '1px solid var(--border-default)',
                paddingTop: '12px',
              }}
            >
              <p style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                Your stake
              </p>
              <p style={{ marginTop: '4px', fontSize: '15px', fontWeight: 560, color: '#8b5cf6' }}>
                {userStaked.toFixed(2)} SOL
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </Link>
  );
}
