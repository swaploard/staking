'use client';

import { useStakingStore } from '@/lib/store';
import { PoolCard } from '@/components/dashboard/pool-card';
import { Footer } from '@/components/common/footer';
import { useState } from 'react';
import Link from 'next/link';
import { Search, Filter } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PoolsPage() {
  const { pools, userPositions } = useStakingStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'apy' | 'tvl' | 'stakers'>('apy');

  const filteredPools = pools.filter(
    (pool) =>
      pool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pool.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedPools = [...filteredPools].sort((a, b) => {
    switch (sortBy) {
      case 'apy':
        return b.apy - a.apy;
      case 'tvl':
        return b.tvl - a.tvl;
      case 'stakers':
        return b.totalStakers - a.totalStakers;
      default:
        return 0;
    }
  });

  return (
    <main className="min-h-screen relative">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950" />
        <motion.div 
          animate={{ 
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.2, 1]
          }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute top-0 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"
        />
        <motion.div 
          animate={{ 
            opacity: [0.2, 0.4, 0.2],
            scale: [1, 1.1, 1]
          }}
          transition={{ duration: 10, repeat: Infinity, delay: 1 }}
          className="absolute bottom-0 left-1/4 w-96 h-96 bg-cyan-600/20 rounded-full blur-3xl"
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-5xl font-bold text-white font-heading gradient-text">Staking Pools</h1>
              <p className="mt-3 text-slate-400 text-lg">Choose a pool and start earning rewards</p>
            </div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                href="/"
                className="rounded-lg glass border-cyan-500/30 px-4 py-2 text-white font-medium transition-all hover:border-cyan-400/60 hover:neon-glow"
              >
                Back to Dashboard
              </Link>
            </motion.div>
          </div>
        </motion.div>

        {/* Search and Filter */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-12 space-y-4"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-400" />
            <input
              type="text"
              placeholder="Search pools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl glass border-cyan-500/30 py-3 pl-10 pr-4 text-white placeholder-slate-500 transition-all hover:border-cyan-400/60 focus:border-cyan-400/60 focus:outline-none hover:neon-glow"
            />
          </div>

          <div className="flex gap-3">
            <Filter className="h-5 w-5 text-slate-400 mt-2" />
            {(['apy', 'tvl', 'stakers'] as const).map((option, idx) => (
              <motion.button
                key={option}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + idx * 0.05 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSortBy(option)}
                className={`px-5 py-2 rounded-lg font-medium transition-all capitalize ${
                  sortBy === option
                    ? 'glass border-purple-500/60 bg-purple-500/20 text-purple-300 neon-glow-purple'
                    : 'glass border-slate-500/20 text-slate-300 hover:border-slate-500/40'
                }`}
              >
                {option === 'apy' && 'APY'}
                {option === 'tvl' && 'TVL'}
                {option === 'stakers' && 'Stakers'}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Pools Grid */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {sortedPools.map((pool, idx) => {
            const userPosition = userPositions.find((pos) => pos.poolId === pool.id);
            return (
              <motion.div
                key={pool.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + idx * 0.05 }}
              >
                <PoolCard pool={pool} userStaked={userPosition?.stakedAmount || 0} />
              </motion.div>
            );
          })}
        </motion.div>

        {sortedPools.length === 0 && (
          <div className="rounded-lg border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800 p-12 text-center">
            <div className="mb-4 text-4xl">🔍</div>
            <h3 className="text-lg font-semibold text-white">No Pools Found</h3>
            <p className="mt-2 text-slate-400">Try adjusting your search query</p>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
