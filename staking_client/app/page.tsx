'use client';

import { useEffect } from 'react';
import { useStakingStore } from '@/lib/store';
import { StatCard } from '@/components/dashboard/stat-card';
import { PositionCard } from '@/components/dashboard/position-card';
import { ActionHistory } from '@/components/dashboard/action-history';
import { AnimatedCounter } from '@/components/dashboard/animated-counter';
import { Footer } from '@/components/common/footer';
import { Wallet, TrendingUp, Award, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { pools, userPositions, recentActions, getTotalStats, userWalletBalance, initializeStore } = useStakingStore();

  useEffect(() => {
    initializeStore();
  }, []);

  const stats = getTotalStats();
  const userPositions_filled = userPositions.filter((pos) => pos.stakedAmount > 0);

  return (
    <main className="min-h-screen">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-yellow-600" />
        <motion.div
          animate={{
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.2, 1]
          }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            opacity: [0.2, 0.4, 0.2],
            scale: [1, 1.1, 1]
          }}
          transition={{ duration: 10, repeat: Infinity, delay: 1 }}
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-600/20 rounded-full blur-3xl"
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <h1 className="text-5xl font-bold text-white font-heading gradient-text">Solana Staking</h1>
          <p className="mt-3 text-slate-400 text-lg">Maximize your rewards with strategic staking across multiple pools</p>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
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
            transition={{ delay: 0.3, duration: 0.6 }}
            className="lg:col-span-2"
          >
            <h2 className="mb-6 text-3xl font-bold text-white font-heading">Your Positions</h2>
            {userPositions_filled.length === 0 ? (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="rounded-2xl glass border-cyan-500/30 p-12 text-center hover:border-cyan-400/60 hover:neon-glow transition-all"
              >
                <div className="mb-4 text-5xl animate-float">📍</div>
                <h3 className="text-lg font-semibold text-white">No Staking Positions Yet</h3>
                <p className="mt-2 text-slate-400">Start earning rewards by staking in a pool</p>
                <Link
                  href="/pools"
                  className="mt-4 inline-block rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-white font-medium transition-all hover:from-indigo-500 hover:to-purple-500 hover:shadow-lg hover:shadow-purple-500/50"
                >
                  Browse Pools
                </Link>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="grid gap-5 sm:grid-cols-2"
              >
                {userPositions_filled.map((position, idx) => {
                  const pool = pools.find((p) => p.id === position.poolId);
                  if (!pool) return null;
                  return (
                    <motion.div
                      key={position.poolId}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + idx * 0.1 }}
                    >
                      <PositionCard position={position} pool={pool} />
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </motion.div>

          {/* Right Column - History */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <h2 className="mb-6 text-3xl font-bold text-white font-heading">Activity</h2>
            <ActionHistory actions={recentActions} />
          </motion.div>
        </div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          whileHover={{ scale: 1.02 }}
          className="mt-12"
        >
          <Link
            href="/pools"
            className="block rounded-2xl glass border-purple-500/30 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 p-8 text-center transition-all hover:border-purple-400/60 hover:neon-glow-purple"
          >
            <h3 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-300 font-heading">Explore More Pools</h3>
            <p className="mt-3 text-slate-300">Discover additional staking opportunities and optimize your portfolio</p>
          </Link>
        </motion.div>
      </div>

      <Footer />
    </main>
  );
}
