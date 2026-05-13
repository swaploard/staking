'use client';

import { useEffect } from 'react';
import { useStakingStore } from '@/lib/store';
import { StatCard } from '@/components/dashboard/stat-card';
import { PositionCard } from '@/components/dashboard/position-card';
import { CountdownTimer } from '@/components/dashboard/countdown-timer';
import { AnimatedCounter } from '@/components/dashboard/animated-counter';
import { StakingActionPanel } from '@/components/actions/staking-action-panel';
import { Footer } from '@/components/common/footer';
import { TrendingUp, Users, Lock, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function PoolDetailPage() {
  const params = useParams();
  const poolId = params.poolId as string;
  const { getPoolById, getUserPosition, initializeStore } = useStakingStore();

  useEffect(() => {
    initializeStore();
  }, [initializeStore]);

  const pool = getPoolById(poolId);
  const userPosition = getUserPosition(poolId);

  if (!pool) {
    return (
      <main className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: '8px',
              padding: '48px 24px',
              textAlign: 'center',
            }}
          >
            <h2>Pool not found</h2>
            <p style={{ marginTop: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}>
              The pool you&apos;re looking for doesn&apos;t exist.
            </p>
            <Link
              href="/pools"
              style={{
                display: 'inline-block',
                marginTop: '16px',
                color: '#55cdff',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              Back to Pools
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const tvlInMillions = (pool.tvl / 1000000).toFixed(2);
  const statusStyles: Record<string, { bg: string; color: string }> = {
    active: { bg: 'rgba(39, 166, 68, 0.12)', color: '#27a644' },
    inactive: { bg: 'rgba(138, 143, 152, 0.12)', color: '#8a8f98' },
    maintenance: { bg: 'rgba(255, 196, 124, 0.12)', color: '#ffc47c' },
  };
  const status = statusStyles[pool.status] || statusStyles.inactive;

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: '32px' }}>
          <div>
            <Link
              href="/pools"
              style={{
                display: 'inline-block',
                marginBottom: '12px',
                color: '#55cdff',
                fontSize: '13px',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              ← Back to Pools
            </Link>
            <h1>{pool.name}</h1>
            <p style={{ marginTop: '8px', fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {pool.description}
            </p>
          </div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: '12px',
              fontWeight: 500,
              padding: '4px 12px',
              borderRadius: '4px',
              backgroundColor: status.bg,
              color: status.color,
            }}
          >
            {pool.status.charAt(0).toUpperCase() + pool.status.slice(1)}
          </span>
        </div>

        {/* Pool Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" style={{ marginBottom: '32px' }}>
          <StatCard
            label="Annual Percentage Yield"
            value={`${pool.apy.toFixed(1)}%`}
            icon={TrendingUp}
            subtext="Estimated yearly return"
            variant="primary"
          />
          <StatCard
            label="Total Value Locked"
            value={`$${tvlInMillions}M`}
            icon={BarChart3}
            subtext={`${pool.tvl.toLocaleString()} SOL`}
          />
          <StatCard
            label="Total Stakers"
            value={pool.totalStakers.toLocaleString()}
            icon={Users}
            subtext="Active participants"
          />
          <StatCard
            label="Minimum Stake"
            value={`${pool.minimumStake} SOL`}
            icon={Lock}
            subtext="To get started"
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left Column - Actions */}
          <div className="lg:col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Staking Action Panel */}
            <StakingActionPanel poolId={poolId} pool={pool} />

            {/* User Position if exists */}
            {userPosition && userPosition.stakedAmount > 0 && (
              <div>
                <h2 style={{ marginBottom: '12px' }}>Your Position</h2>
                <PositionCard position={userPosition} pool={pool} />
              </div>
            )}

            {/* Reward Simulation Info */}
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-default)',
                borderRadius: '8px',
                padding: '20px',
              }}
            >
              <h4 style={{ fontWeight: 560, fontSize: '15px', color: 'var(--text-primary)' }}>
                How Rewards Work
              </h4>
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Real-time Accrual:</span>{' '}
                  Your rewards accrue continuously based on your staked amount and the pool&apos;s APY.
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Claim Anytime:</span>{' '}
                  Claim your accrued rewards whenever you want. There&apos;s no lockup period for rewards.
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Unstaking Cooldown:</span>{' '}
                  When you unstake, there&apos;s a 48-hour cooldown period before you can withdraw your SOL.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Pool Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Pool Details Card */}
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-default)',
                borderRadius: '8px',
                padding: '20px',
              }}
            >
              <h4 style={{ fontWeight: 560, fontSize: '15px', marginBottom: '16px', color: 'var(--text-primary)' }}>
                Pool Details
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Reward Token</p>
                  <p style={{ marginTop: '4px', fontSize: '15px', fontWeight: 560, color: 'var(--text-primary)' }}>
                    {pool.rewardMint}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Pool Status</p>
                  <p style={{ marginTop: '4px', fontSize: '15px', fontWeight: 560, color: 'var(--text-primary)' }}>
                    {pool.status === 'active' ? '✅ Active' : pool.status === 'maintenance' ? '⚠️ Maintenance' : '❌ Inactive'}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Total Participants</p>
                  <p style={{ marginTop: '4px', fontSize: '15px', fontWeight: 560, color: '#27a644' }}>
                    {pool.totalStakers.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Risk Disclosure */}
            <div
              style={{
                backgroundColor: 'rgba(255, 196, 124, 0.06)',
                border: '1px solid rgba(255, 196, 124, 0.2)',
                borderRadius: '8px',
                padding: '16px',
              }}
            >
              <p style={{ fontSize: '12px', fontWeight: 560, color: '#ffc47c' }}>⚠️ IMPORTANT</p>
              <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Staking involves risks. This is a simulation environment. Always do your own research before staking real assets.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
