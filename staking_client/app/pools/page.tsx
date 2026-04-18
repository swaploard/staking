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
    <main className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          style={{ marginBottom: '32px' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1>Staking Pools</h1>
              <p
                style={{
                  marginTop: '8px',
                  fontSize: '15px',
                  lineHeight: 1.6,
                  color: 'var(--text-secondary)',
                }}
              >
                Choose a pool and start earning rewards
              </p>
            </div>
            <Link
              href="/"
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-default)',
                borderRadius: '6px',
                padding: '6px 16px',
                transition: 'border-color 0.2s, color 0.2s',
                textDecoration: 'none',
              }}
              className="hover:!text-[var(--text-primary)] hover:border-[#55cdff]/40"
            >
              Back to Dashboard
            </Link>
          </div>
        </motion.div>

        {/* Search and Filter */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          style={{ marginBottom: '32px' }}
        >
          <div className="relative" style={{ marginBottom: '12px' }}>
            <Search
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '16px',
                height: '16px',
                color: 'var(--text-tertiary)',
              }}
            />
            <input
              type="text"
              placeholder="Search pools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-default)',
                borderRadius: '6px',
                padding: '10px 16px 10px 36px',
                fontSize: '13px',
                color: 'var(--text-primary)',
                transition: 'border-color 0.2s',
                outline: 'none',
              }}
              className="focus:border-[#55cdff]/50 placeholder:text-[var(--text-tertiary)]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter style={{ width: '14px', height: '14px', color: 'var(--text-tertiary)' }} />
            {(['apy', 'tvl', 'stakers'] as const).map((option) => (
              <button
                key={option}
                onClick={() => setSortBy(option)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 500,
                  transition: 'all 0.15s ease',
                  border: '1px solid',
                  borderColor: sortBy === option ? '#8b5cf6' : 'var(--border-default)',
                  backgroundColor: sortBy === option ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                  color: sortBy === option ? '#8b5cf6' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {option === 'apy' && 'APY'}
                {option === 'tvl' && 'TVL'}
                {option === 'stakers' && 'Stakers'}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Pools Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {sortedPools.map((pool, idx) => {
            const userPosition = userPositions.find((pos) => pos.poolId === pool.id);
            return (
              <motion.div
                key={pool.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 + idx * 0.03 }}
              >
                <PoolCard pool={pool} userStaked={userPosition?.stakedAmount || 0} />
              </motion.div>
            );
          })}
        </motion.div>

        {sortedPools.length === 0 && (
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: '8px',
              padding: '48px 24px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
            <h3>No Pools Found</h3>
            <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Try adjusting your search query
            </p>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
