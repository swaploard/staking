'use client';

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
  const { getPoolById, getUserPosition } = useStakingStore();

  const pool = getPoolById(poolId);
  const userPosition = getUserPosition(poolId);

  if (!pool) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800 p-12 text-center">
            <h2 className="text-2xl font-bold text-white">Pool not found</h2>
            <p className="mt-2 text-slate-400">The pool you&apos;re looking for doesn&apos;t exist.</p>
            <Link href="/pools" className="mt-4 inline-block text-blue-400 hover:text-blue-300">
              Back to Pools
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const tvlInMillions = (pool.tvl / 1000000).toFixed(2);
  const statusColor = {
    active: 'bg-emerald-500/20 text-emerald-300',
    inactive: 'bg-slate-500/20 text-slate-300',
    maintenance: 'bg-yellow-500/20 text-yellow-300',
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link href="/pools" className="mb-4 inline-block text-blue-400 hover:text-blue-300">
              ← Back to Pools
            </Link>
            <h1 className="text-4xl font-bold text-white">{pool.name}</h1>
            <p className="mt-2 text-slate-400">{pool.description}</p>
          </div>
          <span className={`rounded-full px-4 py-2 text-sm font-semibold ${statusColor[pool.status]}`}>
            {pool.status.charAt(0).toUpperCase() + pool.status.slice(1)}
          </span>
        </div>

        {/* Pool Stats */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="lg:col-span-2 space-y-8">
            {/* Staking Action Panel */}
            <StakingActionPanel poolId={poolId} pool={pool} />

            {/* User Position if exists */}
            {userPosition && userPosition.stakedAmount > 0 && (
              <div>
                <h2 className="mb-4 text-2xl font-bold text-white">Your Position</h2>
                <PositionCard position={userPosition} pool={pool} />
              </div>
            )}

            {/* Reward Simulation Info */}
            <div className="rounded-lg border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800 p-6">
              <h3 className="text-lg font-semibold text-white">How Rewards Work</h3>
              <div className="mt-4 space-y-3 text-sm text-slate-400">
                <p>
                  <span className="font-medium text-white">Real-time Accrual:</span> Your rewards accrue continuously based on your staked amount and the pool&apos;s APY.
                </p>
                <p>
                  <span className="font-medium text-white">Claim Anytime:</span> Claim your accrued rewards whenever you want. There&apos;s no lockup period for rewards.
                </p>
                <p>
                  <span className="font-medium text-white">Unstaking Cooldown:</span> When you unstake, there&apos;s a 48-hour cooldown period before you can withdraw your SOL.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Pool Info */}
          <div className="space-y-6">
            {/* Pool Details Card */}
            <div className="rounded-lg border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800 p-6">
              <h3 className="mb-4 text-lg font-semibold text-white">Pool Details</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-400">Reward Token</p>
                  <p className="mt-1 text-lg font-semibold text-white">{pool.rewardToken}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Pool Status</p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {pool.status === 'active' ? '✅ Active' : pool.status === 'maintenance' ? '⚠️ Maintenance' : '❌ Inactive'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Total Participants</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-400">{pool.totalStakers.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Risk Disclosure */}
            <div className="rounded-lg border border-blue-700/50 bg-blue-500/10 p-4">
              <p className="text-xs font-semibold text-blue-300">⚠️ IMPORTANT</p>
              <p className="mt-2 text-xs text-blue-200">
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
