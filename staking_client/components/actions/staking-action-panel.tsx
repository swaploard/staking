'use client';

import { useState } from 'react';
import { useStakingStore } from '@/lib/store';
import { StakingPool } from '@/lib/types';
import { StakeForm } from './stake-form';
import { UnstakeForm } from './unstake-form';
import { ClaimRewardsForm } from './claim-rewards-form';
import { WithdrawForm } from './withdraw-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';

interface StakingActionPanelProps {
  poolId: string;
  pool: StakingPool;
}

export function StakingActionPanel({ poolId, pool }: StakingActionPanelProps) {
  const { getUserPosition, userWalletBalance } = useStakingStore();
  const position = getUserPosition(poolId);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl glass border-purple-500/30 p-6 hover:border-purple-400/60 hover:neon-glow-purple transition-all"
    >
      <Tabs defaultValue="stake" className="w-full">
        <TabsList className="grid w-full grid-cols-4 glass border border-purple-500/20">
          <TabsTrigger value="stake">Stake</TabsTrigger>
          <TabsTrigger value="unstake" disabled={!position || position.stakedAmount === 0}>
            Unstake
          </TabsTrigger>
          <TabsTrigger value="claim" disabled={!position || position.rewardsEarned <= 0}>
            Claim
          </TabsTrigger>
          <TabsTrigger value="withdraw" disabled={!position || position.cooldownPeriod > 0}>
            Withdraw
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stake" className="mt-6">
          <StakeForm poolId={poolId} pool={pool} availableBalance={userWalletBalance} />
        </TabsContent>

        <TabsContent value="unstake" className="mt-6">
          {position && position.stakedAmount > 0 ? (
            <UnstakeForm poolId={poolId} pool={pool} position={position} />
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-400">No staked amount to unstake</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="claim" className="mt-6">
          {position && position.rewardsEarned > 0 ? (
            <ClaimRewardsForm poolId={poolId} pool={pool} position={position} />
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-400">No rewards to claim</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="withdraw" className="mt-6">
          {position && position.cooldownPeriod === 0 && position.stakedAmount === 0 ? (
            <WithdrawForm poolId={poolId} pool={pool} />
          ) : (
            <div className="text-center py-8 space-y-4">
              {position && position.cooldownPeriod > 0 ? (
                <>
                  <p className="text-slate-400">Cooldown period in progress</p>
                  <p className="text-sm text-yellow-400">Come back in {position.cooldownPeriod} seconds</p>
                </>
              ) : (
                <p className="text-slate-400">No positions to withdraw</p>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
