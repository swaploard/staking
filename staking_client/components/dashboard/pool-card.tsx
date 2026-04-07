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
  const statusColor = {
    active: 'bg-emerald-500/20 text-emerald-300',
    inactive: 'bg-slate-500/20 text-slate-300',
    maintenance: 'bg-yellow-500/20 text-yellow-300',
  };

  const tvlInMillions = (pool.tvl / 1000000).toFixed(2);

  return (
    <Link href={`/pools/${pool.id}`}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -8, scale: 1.02 }}
        transition={{ duration: 0.3 }}
        className="group cursor-pointer"
      >
        <div className="relative rounded-2xl glass border-cyan-500/30 p-6 transition-all duration-300 overflow-hidden hover:border-cyan-400/60 hover:neon-glow">
          {/* Animated gradient background on hover */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-cyan-500/5 to-transparent" />

          <div className="relative z-10">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-white transition-colors group-hover:text-cyan-300 font-heading">{pool.name}</h3>
                <p className="mt-1 text-sm text-slate-400 group-hover:text-slate-300 transition-colors">{pool.description}</p>
              </div>
              <Badge className={statusColor[pool.status]}>
                {pool.status.charAt(0).toUpperCase() + pool.status.slice(1)}
              </Badge>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-4">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="rounded-xl glass border-purple-500/20 p-3"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">APY</p>
                <p className="mt-2 flex items-center gap-1 text-2xl font-bold gradient-text-2">
                  <TrendingUp className="h-5 w-5 text-cyan-400" />
                  {pool.apy.toFixed(1)}%
                </p>
              </motion.div>
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="rounded-xl glass border-blue-500/20 p-3"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">TVL</p>
                <p className="mt-2 text-2xl font-bold text-white">${tvlInMillions}M</p>
              </motion.div>
            </div>

            <div className="flex gap-4 text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {pool.totalStakers.toLocaleString()} stakers
              </div>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Min {pool.minimumStake} SOL
              </div>
            </div>

            {userStaked > 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 border-t border-slate-700 pt-4"
              >
                <p className="text-xs text-slate-400">Your stake</p>
                <p className="mt-1 text-lg font-bold gradient-text">{userStaked.toFixed(2)} SOL</p>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
