'use client';

import { useStakingStore } from '@/lib/store';
import { PoolCard } from '@/components/dashboard/pool-card';
import { Footer } from '@/components/common/footer';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Filter, Save, ListChecks, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';

export default function PoolsPage() {
  const { toast } = useToast();
  const { pools, userPositions, isLoading, initializeStore } = useStakingStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'apy' | 'tvl' | 'stakers'>('apy');
  const [selectedPoolIds, setSelectedPoolIds] = useState<Set<string>>(new Set());
  const [poolView, setPoolView] = useState<'all' | 'selected'>('all');
  const [isSavingSelection, setIsSavingSelection] = useState(false);
  const [isLoadingSelection, setIsLoadingSelection] = useState(true);

  useEffect(() => {
    initializeStore();
  }, [initializeStore]);

  useEffect(() => {
    let isMounted = true;

    async function fetchSelectedPools() {
      try {
        setIsLoadingSelection(true);
        const response = await fetch('/api/stakingpools', { cache: 'no-store' });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch selected pools');
        }

        const ids = Array.isArray(data.ids)
          ? data.ids
          : Array.isArray(data.pools)
            ? data.pools.map((pool: { id: string }) => pool.id)
            : [];

        if (isMounted) {
          setSelectedPoolIds(new Set(ids));
        }
      } catch (error) {
        console.error('Failed to fetch selected pools:', error);
        if (isMounted) {
          toast({
            title: 'Could not load selected pools',
            description: error instanceof Error ? error.message : 'Try refreshing the page',
            variant: 'destructive',
          });
        }
      } finally {
        if (isMounted) {
          setIsLoadingSelection(false);
        }
      }
    }

    fetchSelectedPools();

    return () => {
      isMounted = false;
    };
  }, [toast]);

  const togglePoolSelection = (poolId: string, checked: boolean | 'indeterminate') => {
    setSelectedPoolIds((current) => {
      const next = new Set(current);
      if (checked === true) {
        next.add(poolId);
      } else {
        next.delete(poolId);
      }
      return next;
    });
  };

  const saveSelectedPools = async () => {
    setIsSavingSelection(true);
    try {
      const response = await fetch('/api/stakingpools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ poolIds: [...selectedPoolIds] }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save selected pools');
      }

      const savedIds = Array.isArray(data.ids) ? data.ids : [...selectedPoolIds];
      setSelectedPoolIds(new Set(savedIds));
      toast({
        title: 'Selected pools saved',
        description: `${savedIds.length} pool${savedIds.length === 1 ? '' : 's'} saved to Stakingpool`,
      });
    } catch (error) {
      console.error('Failed to save selected pools:', error);
      toast({
        title: 'Selection was not saved',
        description: error instanceof Error ? error.message : 'Try again in a moment',
        variant: 'destructive',
      });
    } finally {
      setIsSavingSelection(false);
    }
  };

  const basePools =
    poolView === 'selected'
      ? pools.filter((pool) => selectedPoolIds.has(pool.id))
      : pools;

  const filteredPools = basePools.filter(
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

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2" style={{ marginRight: '8px' }}>
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

            <div className="flex items-center gap-2">
              {(['all', 'selected'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setPoolView(option)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 500,
                    transition: 'all 0.15s ease',
                    border: '1px solid',
                    borderColor: poolView === option ? '#55cdff' : 'var(--border-default)',
                    backgroundColor: poolView === option ? 'rgba(85, 205, 255, 0.1)' : 'transparent',
                    color: poolView === option ? '#55cdff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {option === 'selected' && <ListChecks style={{ width: '13px', height: '13px' }} />}
                  {option === 'all' ? 'All pools' : `Selected (${selectedPoolIds.size})`}
                </button>
              ))}
            </div>

            <button
              onClick={saveSelectedPools}
              disabled={isSavingSelection || isLoadingSelection}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                marginLeft: 'auto',
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 500,
                border: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                cursor: isSavingSelection || isLoadingSelection ? 'not-allowed' : 'pointer',
                opacity: isSavingSelection || isLoadingSelection ? 0.7 : 1,
              }}
            >
              {isSavingSelection ? (
                <Loader2 className="animate-spin" style={{ width: '13px', height: '13px' }} />
              ) : (
                <Save style={{ width: '13px', height: '13px' }} />
              )}
              Save selected
            </button>
          </div>
        </motion.div>

        {/* Pools Grid */}
        {isLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton
                key={`skeleton-${idx}`}
                style={{
                  height: '280px',
                  borderRadius: '8px',
                }}
              />
            ))}
          </motion.div>
        ) : (
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
                  className="relative"
                >
                  <div
                    className="absolute right-3 top-3 z-10 flex items-center"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Checkbox
                      checked={selectedPoolIds.has(pool.id)}
                      onCheckedChange={(checked) => togglePoolSelection(pool.id, checked)}
                      aria-label={`Select ${pool.name || pool.id}`}
                      className="size-5 border-[#55cdff]/50 bg-[var(--bg-secondary)] data-[state=checked]:border-[#55cdff] data-[state=checked]:bg-[#55cdff] data-[state=checked]:text-slate-950"
                    />
                  </div>
                  <PoolCard pool={pool} userStaked={userPosition?.stakedAmount || 0} />
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {!isLoading && sortedPools.length === 0 && (
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
              {poolView === 'selected'
                ? 'Select pools and save them to Stakingpool'
                : 'Try adjusting your search query'}
            </p>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
