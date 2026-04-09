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
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ duration: 0.3 }}
      className="relative rounded-2xl glass border-pink-500/30 p-6 overflow-hidden hover:border-pink-400/60 hover:neon-glow-pink transition-all"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-pink-500/5 to-transparent" />

      <div className="relative z-10">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h4 className="font-semibold text-black font-heading text-lg">{pool.name}</h4>
            <p className="mt-1 text-sm text-blue-950">APY <span className="text-green-900 font-semibold">{pool.apy.toFixed(1)}%</span></p>
          </div>
          <Link href={`/pools/${pool.id}`} className="text-blue-950 hover:text-blue-900 hover:scale-110 transition-transform">
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="rounded-xl glass border-blue-500/20 p-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-950">Staked</p>
              <p className="mt-2 text-2xl font-bold text-black font-mono">{position.stakedAmount.toFixed(2)}</p>
              <p className="text-xs text-blue-950">SOL</p>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="rounded-xl glass border-emerald-500/20 p-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-950">Rewards</p>
              <p className="mt-2 text-2xl font-bold text-black">
                <AnimatedCounter value={position.rewardsEarned} suffix=" " decimals={3} />
              </p>
              <p className="text-xs text-blue-950">SOL</p>
            </motion.div>
          </div>

          {isUnstaking && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border-yellow-600/50 bg-yellow-500/10 p-3 backdrop-blur-sm"
            >
              <div className="mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-400 animate-spin" />
                <p className="text-sm font-semibold text-yellow-300">Cooldown Period</p>
              </div>
              <CountdownTimer seconds={position.cooldownPeriod} compact />
            </motion.div>
          )}

          <div className="border-t border-slate-700/50 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-900">Total Claimed</p>
            <p className="mt-2 text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-cyan-900 to-blue-300">{position.claimedRewards.toFixed(2)} SOL</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
