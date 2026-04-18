'use client';

import { StakingPool, UserPosition } from '@/lib/types';
import { CountdownTimer } from './countdown-timer';
import { AnimatedCounter } from './animated-counter';
import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

interface PositionCardProps {
  position: UserPosition;
  pool: StakingPool;
}

export function PositionCard({ position, pool }: PositionCardProps) {
  const isUnstaking = position.unstakedAt !== null && position.cooldownPeriod > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
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
          <h4 style={{ fontWeight: 560, fontSize: '15px', color: 'var(--text-primary)' }}>
            {pool.name}
          </h4>
          <p style={{ marginTop: '4px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            APY{' '}
            <span style={{ color: '#27a644', fontWeight: 500 }}>
              {pool.apy.toFixed(1)}%
            </span>
          </p>
        </div>
        <Link
          href={`/pools/${pool.id}`}
          style={{
            color: 'var(--text-tertiary)',
            transition: 'color 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '6px',
          }}
          className="hover:bg-[#23252a]"
        >
          <ArrowRight style={{ width: '16px', height: '16px' }} />
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '16px' }}>
        <div
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: '6px',
            padding: '12px',
          }}
        >
          <p style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
            Staked
          </p>
          <p style={{ marginTop: '6px', fontSize: '20px', fontWeight: 590, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {position.stakedAmount.toFixed(2)}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>SOL</p>
        </div>
        <div
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: '6px',
            padding: '12px',
          }}
        >
          <p style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
            Rewards
          </p>
          <p style={{ marginTop: '6px', fontSize: '20px', fontWeight: 590, color: '#27a644' }}>
            <AnimatedCounter value={position.rewardsEarned} suffix=" " decimals={3} />
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>SOL</p>
        </div>
      </div>

      {/* Cooldown */}
      {isUnstaking && (
        <div
          style={{
            backgroundColor: 'rgba(255, 196, 124, 0.08)',
            border: '1px solid rgba(255, 196, 124, 0.2)',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '16px',
          }}
        >
          <div className="flex items-center gap-2" style={{ marginBottom: '6px' }}>
            <Clock style={{ width: '14px', height: '14px', color: '#ffc47c' }} />
            <p style={{ fontSize: '13px', fontWeight: 500, color: '#ffc47c' }}>
              Cooldown Period
            </p>
          </div>
          <CountdownTimer seconds={position.cooldownPeriod} compact />
        </div>
      )}

      {/* Claimed */}
      <div
        style={{
          borderTop: '1px solid var(--border-default)',
          paddingTop: '12px',
        }}
      >
        <p style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
          Total Claimed
        </p>
        <p style={{ marginTop: '4px', fontSize: '15px', fontWeight: 500, color: 'var(--text-secondary)' }}>
          {position.claimedRewards.toFixed(2)} SOL
        </p>
      </div>
    </motion.div>
  );
}
