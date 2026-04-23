'use client';

import { useStakingStore } from '@/lib/store';
import { useWalletBalance } from '@/lib/hooks/use-wallet-balance';
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
  const { getUserPosition } = useStakingStore();
  const userWalletBalance = useWalletBalance();
  const position = getUserPosition(poolId);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: '8px',
        padding: '20px',
      }}
    >
      <Tabs defaultValue="stake" className="w-full">
        <TabsList
          className="grid w-full grid-cols-4"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: '6px',
            padding: '2px',
          }}
        >
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
          <StakeForm pool={pool} availableBalance={userWalletBalance} />
        </TabsContent>

        <TabsContent value="unstake" className="mt-6">
          {position && position.stakedAmount > 0 ? (
            <UnstakeForm pool={pool} position={position} />
          ) : (
            <div className="text-center py-8">
              <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>No staked amount to unstake</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="claim" className="mt-6">
          {position && position.rewardsEarned > 0 ? (
            <ClaimRewardsForm pool={pool} position={position} />
          ) : (
            <div className="text-center py-8">
              <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>No rewards to claim</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="withdraw" className="mt-6">
          {position && position.cooldownPeriod === 0 && position.stakedAmount === 0 ? (
            <WithdrawForm pool={pool} />
          ) : (
            <div className="text-center py-8" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {position && position.cooldownPeriod > 0 ? (
                <>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Cooldown period in progress</p>
                  <p style={{ fontSize: '12px', color: '#ffc47c' }}>Come back in {position.cooldownPeriod} seconds</p>
                </>
              ) : (
                <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>No positions to withdraw</p>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
