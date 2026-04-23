"use client";

import { create } from "zustand";
import { StakingPool, UserPosition, StakingAction, ActionState } from "./types";

interface StakingStore {
  pools: StakingPool[];
  userPositions: UserPosition[];
  recentActions: StakingAction[];
  actionState: ActionState;
  userWalletBalance: number;
  isLoading: boolean;
  getUserPosition: (poolId: string) => UserPosition | undefined;
  getPoolById: (poolId: string) => StakingPool | undefined;
  getTotalStats: () => {
    totalStaked: number;
    totalRewards: number;
    totalClaimed: number;
    activePositions: number;
  };
  fetchPools: () => Promise<void>;
  initializeStore: () => void;
  simulateRewardAccrual: () => void;
  stakeTokens: (
    poolId: string,
    amount: number,
    txHash?: string,
  ) => Promise<void>;
  unstakeTokens: (
    poolId: string,
    amount: number,
    txHash?: string,
  ) => Promise<void>;
  claimRewards: (poolId: string, txHash?: string) => Promise<void>;
  withdrawUnstaked: (poolId: string, txHash?: string) => Promise<void>;
  setActionState: (state: Partial<ActionState>) => void;
  resetActionState: () => void;
  updateRewardSimulation: () => void;
}

export const useStakingStore = create<StakingStore>()((set, get) => ({
  pools: [],
  userPositions: [],
  recentActions: [],
  actionState: {
    type: null,
    poolId: null,
    amount: 0,
    isLoading: false,
    error: null,
    success: false,
  },
  userWalletBalance: 0,
  isLoading: false,

  getUserPosition: (poolId: string) =>
    get().userPositions.find((pos) => pos.poolId === poolId),
  getPoolById: (poolId: string) =>
    get().pools.find((pool) => pool.id === poolId),
  getTotalStats: () => {
    const { userPositions } = get();
    return {
      totalStaked: userPositions.reduce(
        (sum, pos) => sum + pos.stakedAmount,
        0,
      ),
      totalRewards: userPositions.reduce(
        (sum, pos) => sum + pos.rewardsEarned,
        0,
      ),
      totalClaimed: userPositions.reduce(
        (sum, pos) => sum + pos.claimedRewards,
        0,
      ),
      activePositions: userPositions.filter(
        (pos) => pos.stakedAmount > 0 && pos.unstakedAt === null,
      ).length,
    };
  },

  fetchPools: async () => {
    set({ isLoading: true });
    try {
      const response = await fetch("/api/pools?limit=100");
      const data = await response.json();
      if (data.pools) {
        const pools: StakingPool[] = data.pools.map((pool: {
          id: string;
          poolId: number | null;
          name: string;
          description: string;
          authority: string;
          tokenMint: string;
          rewardMint: string;
          stakedAmount: string;
          rewardAmount: string;
          startTime: string;
          endTime?: string;
          lockUpPeriod: string;
        }) => ({
          id: pool.id,
          poolId: pool.poolId,
          name: pool.name,
          description: pool.description,
          stakeMint: pool.tokenMint,
          rewardMint: pool.rewardMint,
          apy: 0,
          tvl: parseFloat(pool.stakedAmount) / 1e9,
          totalStakers: 0,
          minimumStake: 0.1,
          rewardToken: pool.rewardMint,
          status: "active",
        }));
        console.log("Fetched pools:", pools);
        set({ pools, isLoading: false });
      }
    } catch (error) {
      console.error("Failed to fetch pools:", error);
      set({ isLoading: false });
    }
  },
  initializeStore: () => {
    get().fetchPools();
  },
  simulateRewardAccrual: () => {},

  stakeTokens: async (poolId: string, amount: number, txHash?: string) => {
    set({
      actionState: {
        type: "stake",
        poolId,
        amount,
        isLoading: true,
        error: null,
        success: false,
      },
    });
    try {
      const existingPosition = get().userPositions.find(
        (pos) => pos.poolId === poolId,
      );
      if (existingPosition) {
        set((state) => ({
          userPositions: state.userPositions.map((pos) =>
            pos.poolId === poolId
              ? {
                  ...pos,
                  stakedAmount: pos.stakedAmount + amount,
                  stakedAt: Date.now(),
                }
              : pos,
          ),
          userWalletBalance: state.userWalletBalance - amount,
          recentActions: [
            {
              id: `action-${Date.now()}`,
              type: "stake",
              poolId,
              amount,
              timestamp: Date.now(),
              status: "confirmed",
              transactionHash: txHash,
            },
            ...state.recentActions.slice(0, 9),
          ],
          actionState: {
            type: "stake",
            poolId,
            amount,
            isLoading: false,
            error: null,
            success: true,
          },
        }));
      } else {
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
              type: "stake",
              poolId,
              amount,
              timestamp: Date.now(),
              status: "confirmed",
              transactionHash: txHash,
            },
            ...state.recentActions.slice(0, 9),
          ],
          actionState: {
            type: "stake",
            poolId,
            amount,
            isLoading: false,
            error: null,
            success: true,
          },
        }));
      }
    } catch (error) {
      set((state) => ({
        actionState: {
          ...state.actionState,
          isLoading: false,
          error: "Failed to stake tokens",
        },
      }));
    }
  },

  unstakeTokens: async (poolId: string, amount: number, txHash?: string) => {
    set({
      actionState: {
        type: "unstake",
        poolId,
        amount,
        isLoading: true,
        error: null,
        success: false,
      },
    });
    try {
      set((state) => ({
        userPositions: state.userPositions.map((pos) =>
          pos.poolId === poolId
            ? {
                ...pos,
                stakedAmount: Math.max(0, pos.stakedAmount - amount),
                unstakedAt: Date.now(),
                cooldownPeriod: 172800,
              }
            : pos,
        ),
        recentActions: [
          {
            id: `action-${Date.now()}`,
            type: "unstake",
            poolId,
            amount,
            timestamp: Date.now(),
            status: "confirmed",
            transactionHash: txHash,
          },
          ...state.recentActions.slice(0, 9),
        ],
        actionState: {
          type: "unstake",
          poolId,
          amount,
          isLoading: false,
          error: null,
          success: true,
        },
      }));
    } catch (error) {
      set((state) => ({
        actionState: {
          ...state.actionState,
          isLoading: false,
          error: "Failed to unstake tokens",
        },
      }));
    }
  },

  claimRewards: async (poolId: string, txHash?: string) => {
    const position = get().getUserPosition(poolId);
    if (!position) return;
    set({
      actionState: {
        type: "claim",
        poolId,
        amount: position.rewardsEarned,
        isLoading: true,
        error: null,
        success: false,
      },
    });
    try {
      set((state) => ({
        userPositions: state.userPositions.map((pos) =>
          pos.poolId === poolId
            ? {
                ...pos,
                rewardsEarned: 0,
                claimedRewards: pos.claimedRewards + position.rewardsEarned,
              }
            : pos,
        ),
        userWalletBalance: state.userWalletBalance + position.rewardsEarned,
        recentActions: [
          {
            id: `action-${Date.now()}`,
            type: "claim",
            poolId,
            amount: position.rewardsEarned,
            timestamp: Date.now(),
            status: "confirmed",
            transactionHash: txHash,
          },
          ...state.recentActions.slice(0, 9),
        ],
        actionState: {
          type: "claim",
          poolId,
          amount: position.rewardsEarned,
          isLoading: false,
          error: null,
          success: true,
        },
      }));
    } catch (error) {
      set((state) => ({
        actionState: {
          ...state.actionState,
          isLoading: false,
          error: "Failed to claim rewards",
        },
      }));
    }
  },

  withdrawUnstaked: async (poolId: string, txHash?: string) => {
    const position = get().getUserPosition(poolId);
    if (!position || position.cooldownPeriod > 0) {
      set((state) => ({
        actionState: {
          ...state.actionState,
          isLoading: false,
          error: "Cooldown period not yet complete",
        },
      }));
      return;
    }
    set({
      actionState: {
        type: "withdraw",
        poolId,
        amount: position.stakedAmount,
        isLoading: true,
        error: null,
        success: false,
      },
    });
    try {
      set((state) => ({
        userPositions: state.userPositions.filter(
          (pos) => pos.poolId !== poolId || pos.stakedAmount > 0,
        ),
        userWalletBalance: state.userWalletBalance + position.stakedAmount,
        recentActions: [
          {
            id: `action-${Date.now()}`,
            type: "withdraw",
            poolId,
            amount: position.stakedAmount,
            timestamp: Date.now(),
            status: "confirmed",
            transactionHash: txHash,
          },
          ...state.recentActions.slice(0, 9),
        ],
        actionState: {
          type: "withdraw",
          poolId,
          amount: position.stakedAmount,
          isLoading: false,
          error: null,
          success: true,
        },
      }));
    } catch (error) {
      set((state) => ({
        actionState: {
          ...state.actionState,
          isLoading: false,
          error: "Failed to withdraw",
        },
      }));
    }
  },

  setActionState: (newState: Partial<ActionState>) =>
    set((state) => ({ actionState: { ...state.actionState, ...newState } })),
  resetActionState: () =>
    set({
      actionState: {
        type: null,
        poolId: null,
        amount: 0,
        isLoading: false,
        error: null,
        success: false,
      },
    }),
  updateRewardSimulation: () => {},
}));
