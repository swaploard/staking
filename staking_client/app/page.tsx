'use client';

import { useEffect } from 'react';
import { useStakingStore } from '@/lib/store';
import { StatCard } from '@/components/dashboard/stat-card';
import { PositionCard } from '@/components/dashboard/position-card';
import { ActionHistory } from '@/components/dashboard/action-history';
import { AnimatedCounter } from '@/components/dashboard/animated-counter';
import { Footer } from '@/components/common/footer';
import { Wallet, TrendingUp, Award, BarChart3 } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletActivity } from '@/hooks/useWalletActivity';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { pools, userPositions, getTotalStats, userWalletBalance, initializeStore } = useStakingStore();
  const { connected, publicKey } = useWallet();
  const walletPubkey = connected ? publicKey?.toBase58() : undefined;
  const {
    actions: databaseActions,
    loading: activityLoading,
    error: activityError,
  } = useWalletActivity(walletPubkey, { limit: 5 });

  useEffect(() => {
    initializeStore();
  }, []);

  const stats = getTotalStats();
  const userPositions_filled = userPositions.filter((pos) => pos.stakedAmount > 0);

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          style={{ marginBottom: '32px' }}
        >
          <h1>Solana Staking</h1>
          <p
            style={{
              marginTop: '8px',
              fontSize: '15px',
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
            }}
          >
            Maximize your rewards with strategic staking across multiple pools
          </p>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          style={{ marginBottom: '32px' }}
        >
          <StatCard
            label="Wallet Balance"
            value={`${userWalletBalance.toFixed(2)} SOL`}
            icon={Wallet}
            subtext="Available to stake"
            variant="primary"
            index={0}
          />
          <StatCard
            label="Total Staked"
            value={
              <AnimatedCounter value={stats.totalStaked} suffix=" SOL" decimals={2} />
            }
            icon={TrendingUp}
            subtext={`${stats.activePositions} active pool${stats.activePositions !== 1 ? 's' : ''}`}
            index={1}
          />
          <StatCard
            label="Pending Rewards"
            value={
              <AnimatedCounter value={stats.totalRewards} suffix=" SOL" decimals={3} />
            }
            icon={Award}
            subtext="Not yet claimed"
            variant="success"
            index={2}
          />
          <StatCard
            label="Total Claimed"
            value={`${stats.totalClaimed.toFixed(2)} SOL`}
            icon={BarChart3}
            subtext="Lifetime rewards"
            index={3}
          />
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left Column - Positions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="lg:col-span-2"
          >
            <h2 style={{ marginBottom: '16px' }}>Your Positions</h2>
            {userPositions_filled.length === 0 ? (
              <div
                className="animate-fade-in"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px',
                  padding: '48px 24px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>📍</div>
                <h3>No Staking Positions Yet</h3>
                <p
                  style={{
                    marginTop: '8px',
                    color: 'var(--text-secondary)',
                    fontSize: '14px',
                  }}
                >
                  Start earning rewards by staking in a pool
                </p>
                <Link
                  href="/pools"
                  style={{
                    display: 'inline-block',
                    marginTop: '16px',
                    padding: '8px 24px',
                    backgroundColor: 'var(--accent-purple, #6366f1)',
                    color: '#ffffff',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 500,
                    transition: 'opacity 0.2s',
                  }}
                  className="hover:opacity-90"
                >
                  Browse Pools
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {userPositions_filled.map((position, idx) => {
                  const pool = pools.find((p) => p.id === position.poolId);
                  if (!pool) return null;
                  return (
                    <motion.div
                      key={position.poolId}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 + idx * 0.05 }}
                    >
                      <PositionCard position={position} pool={pool} />
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Right Column - History */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <h2 style={{ marginBottom: '16px' }}>Activity</h2>
            <ActionHistory
              actions={databaseActions}
              isLoading={activityLoading}
              error={activityError}
              walletConnected={connected}
            />
          </motion.div>
        </div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          style={{ marginTop: '32px' }}
        >
          <Link
            href="/pools"
            style={{
              display: 'block',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: '8px',
              padding: '32px',
              textAlign: 'center',
              transition: 'border-color 0.2s, background-color 0.2s',
            }}
            className="hover:opacity-95 group"
          >
            <h3 style={{ color: 'var(--text-primary)' }}>
              Explore More Pools
            </h3>
            <p
              style={{
                marginTop: '8px',
                color: 'var(--text-secondary)',
                fontSize: '14px',
              }}
            >
              Discover additional staking opportunities and optimize your portfolio
            </p>
          </Link>
        </motion.div>
      </div>

      <Footer />
    </main>
  );
}
