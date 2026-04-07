'use client';

import { create } from 'zustand';
import { StakingPool, UserPosition, StakingAction, ActionState } from './types';
import { MOCK_POOLS, MOCK_USER_POSITIONS } from './mocks';

interface StakingStore {
  // State
  pools: StakingPool[];
  userPositions: UserPosition[];
  recentActions: StakingAction[];
  actionState: ActionState;
  userWalletBalance: number; // Simulated SOL balance

  // Selectors
  getUserPosition: (poolId: string) => UserPosition | undefined;
  getPoolById: (poolId: string) => StakingPool | undefined;
  getTotalStats: () => { totalStaked: number; totalRewards: number; totalClaimed: number; activePositions: number };

  // Actions
  initializeStore: () => void;
  simulateRewardAccrual: () => void;
  
  // Staking actions
  stakeTokens: (poolId: string, amount: number) => Promise<void>;
  unstakeTokens: (poolId: string, amount: number) => Promise<void>;
  claimRewards: (poolId: string) => Promise<void>;
  withdrawUnstaked: (poolId: string) => Promise<void>;

  // UI State management
  setActionState: (state: Partial<ActionState>) => void;
  resetActionState: () => void;

  // Utility
  updateRewardSimulation: () => void;
}

export const useStakingStore = create<StakingStore>((set, get) => {
  // Start reward simulation interval
  let rewardInterval: NodeJS.Timeout | null = null;

  return {
    pools: MOCK_POOLS,
    userPositions: MOCK_USER_POSITIONS,
    recentActions: [],
    actionState: {
      type: null,
      poolId: null,
      amount: 0,
      isLoading: false,
      error: null,
      success: false,
    },
    userWalletBalance: 50, // 50 SOL starting balance

    // Selectors
    getUserPosition: (poolId: string) => {
      return get().userPositions.find((pos) => pos.poolId === poolId);
    },

    getPoolById: (poolId: string) => {
      return get().pools.find((pool) => pool.id === poolId);
    },

    getTotalStats: () => {
      const { userPositions } = get();
      return {
        totalStaked: userPositions.reduce((sum, pos) => sum + pos.stakedAmount, 0),
        totalRewards: userPositions.reduce((sum, pos) => sum + pos.rewardsEarned, 0),
        totalClaimed: userPositions.reduce((sum, pos) => sum + pos.claimedRewards, 0),
        activePositions: userPositions.filter((pos) => pos.stakedAmount > 0 && pos.unstakedAt === null).length,
      };
    },

    // Initialize store and start simulation
    initializeStore: () => {
      // Start reward accrual simulation
      if (rewardInterval) clearInterval(rewardInterval);
      rewardInterval = setInterval(() => {
        get().updateRewardSimulation();
      }, 3000); // Update every 3 seconds
    },

    // Simulate reward accrual
    updateRewardSimulation: () => {
      set((state) => ({
        userPositions: state.userPositions.map((pos) => {
          const pool = state.pools.find((p) => p.id === pos.poolId);
          if (!pool || pos.stakedAmount === 0) return pos;

          // Calculate rewards accrual (APY / 365 / 24 / 60 / 60 * stakedAmount)
          const secondlyRate = pool.apy / 100 / 365 / 24 / 60 / 60;
          const rewardAccrual = pos.stakedAmount * secondlyRate * 3; // 3 seconds

          // Update cooldown if unstaking
          let newCooldown = pos.cooldownPeriod;
          if (pos.unstakedAt !== null && newCooldown > 0) {
            newCooldown = Math.max(0, newCooldown - 3);
          }

          return {
            ...pos,
            rewardsEarned: pos.rewardsEarned + rewardAccrual,
            cooldownPeriod: newCooldown,
          };
        }),
      }));
    },

    // Staking Actions
    stakeTokens: async (poolId: string, amount: number) => {
      set({ actionState: { type: 'stake', poolId, amount, isLoading: true, error: null, success: false } });

      try {
        // Simulate transaction delay
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const existingPosition = get().userPositions.find((pos) => pos.poolId === poolId);

        if (existingPosition) {
          // Add to existing position
          set((state) => ({
            userPositions: state.userPositions.map((pos) =>
              pos.poolId === poolId
                ? { ...pos, stakedAmount: pos.stakedAmount + amount, stakedAt: Date.now() }
                : pos
            ),
            userWalletBalance: state.userWalletBalance - amount,
            recentActions: [
              {
                id: `action-${Date.now()}`,
                type: 'stake',
                poolId,
                amount,
                timestamp: Date.now(),
                status: 'confirmed',
              },
              ...state.recentActions.slice(0, 9),
            ],
            actionState: { type: 'stake', poolId, amount, isLoading: false, error: null, success: true },
          }));
        } else {
          // Create new position
          set((state) => ({
            userPositions: [
              ...state.userPositions,
              {
                poolId,
                stakedAmount: amount,
                rewardsEarned: 0,
                claimedRewards: 0,
                stakedAt: Date.now(),
                unstakedAt: null,
                cooldownPeriod: 0,
              },
            ],
            userWalletBalance: state.userWalletBalance - amount,
            recentActions: [
              {
                id: `action-${Date.now()}`,
                type: 'stake',
                poolId,
                amount,
                timestamp: Date.now(),
                status: 'confirmed',
              },
              ...state.recentActions.slice(0, 9),
            ],
            actionState: { type: 'stake', poolId, amount, isLoading: false, error: null, success: true },
          }));
        }
      } catch (error) {
        set((state) => ({
          actionState: {
            ...state.actionState,
            isLoading: false,
            error: 'Failed to stake tokens',
          },
        }));
      }
    },

    unstakeTokens: async (poolId: string, amount: number) => {
      set({ actionState: { type: 'unstake', poolId, amount, isLoading: true, error: null, success: false } });

      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));

        set((state) => ({
          userPositions: state.userPositions.map((pos) =>
            pos.poolId === poolId
              ? {
                  ...pos,
                  stakedAmount: Math.max(0, pos.stakedAmount - amount),
                  unstakedAt: Date.now(),
                  cooldownPeriod: 172800, // 48 hour cooldown in seconds
                }
              : pos
          ),
          recentActions: [
            {
              id: `action-${Date.now()}`,
              type: 'unstake',
              poolId,
              amount,
              timestamp: Date.now(),
              status: 'confirmed',
            },
            ...state.recentActions.slice(0, 9),
          ],
          actionState: { type: 'unstake', poolId, amount, isLoading: false, error: null, success: true },
        }));
      } catch (error) {
        set((state) => ({
          actionState: {
            ...state.actionState,
            isLoading: false,
            error: 'Failed to unstake tokens',
          },
        }));
      }
    },

    claimRewards: async (poolId: string) => {
      const position = get().getUserPosition(poolId);
      if (!position) return;

      set({ actionState: { type: 'claim', poolId, amount: position.rewardsEarned, isLoading: true, error: null, success: false } });

      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));

        set((state) => ({
          userPositions: state.userPositions.map((pos) =>
            pos.poolId === poolId
              ? {
                  ...pos,
                  rewardsEarned: 0,
                  claimedRewards: pos.claimedRewards + position.rewardsEarned,
                }
              : pos
          ),
          userWalletBalance: state.userWalletBalance + position.rewardsEarned,
          recentActions: [
            {
              id: `action-${Date.now()}`,
              type: 'claim',
              poolId,
              amount: position.rewardsEarned,
              timestamp: Date.now(),
              status: 'confirmed',
            },
            ...state.recentActions.slice(0, 9),
          ],
          actionState: { type: 'claim', poolId, amount: position.rewardsEarned, isLoading: false, error: null, success: true },
        }));
      } catch (error) {
        set((state) => ({
          actionState: {
            ...state.actionState,
            isLoading: false,
            error: 'Failed to claim rewards',
          },
        }));
      }
    },

    withdrawUnstaked: async (poolId: string) => {
      const position = get().getUserPosition(poolId);
      if (!position || position.cooldownPeriod > 0) {
        set((state) => ({
          actionState: {
            ...state.actionState,
            isLoading: false,
            error: 'Cooldown period not yet complete',
          },
        }));
        return;
      }

      set({ actionState: { type: 'withdraw', poolId, amount: 0, isLoading: true, error: null, success: false } });

      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));

        set((state) => ({
          userPositions: state.userPositions.filter((pos) => pos.poolId !== poolId || pos.stakedAmount > 0),
          userWalletBalance: state.userWalletBalance + 0, // Already deducted
          recentActions: [
            {
              id: `action-${Date.now()}`,
              type: 'withdraw',
              poolId,
              amount: 0,
              timestamp: Date.now(),
              status: 'confirmed',
            },
            ...state.recentActions.slice(0, 9),
          ],
          actionState: { type: 'withdraw', poolId, amount: 0, isLoading: false, error: null, success: true },
        }));
      } catch (error) {
        set((state) => ({
          actionState: {
            ...state.actionState,
            isLoading: false,
            error: 'Failed to withdraw',
          },
        }));
      }
    },

    setActionState: (newState: Partial<ActionState>) => {
      set((state) => ({
        actionState: { ...state.actionState, ...newState },
      }));
    },

    resetActionState: () => {
      set({
        actionState: {
          type: null,
          poolId: null,
          amount: 0,
          isLoading: false,
          error: null,
          success: false,
        },
      });
    },

    updateRewardSimulation: () => {
      set((state) => ({
        userPositions: state.userPositions.map((pos) => {
          const pool = state.pools.find((p) => p.id === pos.poolId);
          if (!pool || pos.stakedAmount === 0) return pos;

          const secondlyRate = pool.apy / 100 / 365 / 24 / 60 / 60;
          const rewardAccrual = pos.stakedAmount * secondlyRate * 3;

          let newCooldown = pos.cooldownPeriod;
          if (pos.unstakedAt !== null && newCooldown > 0) {
            newCooldown = Math.max(0, newCooldown - 3);
          }

          return {
            ...pos,
            rewardsEarned: pos.rewardsEarned + rewardAccrual,
            cooldownPeriod: newCooldown,
          };
        }),
      }));
    },
  };
});
