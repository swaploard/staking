"use client";

import { create } from "zustand";
import { StakingPool, UserPosition, StakingAction, ActionState } from "./types";

// Total unstake cooldown duration in seconds. Adjust this value as needed.
const UNSTAKE_COOLDOWN_SECONDS = 0;

/**
 * Compute the remaining cooldown seconds for a position.
 * Returns 0 if there is no active cooldown or if the cooldown has elapsed.
 */
export function getRemainingCooldown(position: UserPosition | null | undefined): number {
  if (!position || !position.unstakedAt || position.cooldownPeriod <= 0) return 0;
  const elapsed = Math.floor((Date.now() - position.unstakedAt) / 1000);
  return Math.max(0, position.cooldownPeriod - elapsed);
}

type PoolApiRecord = {
  id: string;
  poolId: number | null;
  name?: string | null;
  description?: string | null;
  tokenMint: string;
  rewardMint: string;
  aprBps?: string;
  apy?: number;
  stakedAmount?: string;
  tvl?: number;
  stakers?: number | string;
  totalStakers?: number | string;
  status?: string;
  rewardPerShare?: string;
};

function numberFromApi(value: unknown, fallback = 0) {
  const numberValue =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function mapPoolFromApi(pool: PoolApiRecord): StakingPool {
  const apy =
    typeof pool.apy === "number" ? pool.apy : numberFromApi(pool.aprBps) / 100;
  const tvl =
    pool.stakedAmount !== undefined
      ? numberFromApi(pool.stakedAmount) / 1e9
      : numberFromApi(pool.tvl);
  const status =
    pool.status === "inactive" || pool.status === "maintenance"
      ? pool.status
      : "active";

  return {
    id: pool.id,
    poolId: pool.poolId,
    name: pool.name || `Pool ${pool.poolId ?? pool.id.slice(0, 6)}`,
    description: pool.description || "Staking pool",
    stakeMint: pool.tokenMint,
    rewardMint: pool.rewardMint,
    apy,
    tvl,
    totalStakers: Math.trunc(
      numberFromApi(pool.totalStakers ?? pool.stakers),
    ),
    minimumStake: 0.1,
    rewardToken: pool.rewardMint,
    status,
    rewardPerShare: pool.rewardPerShare,
  };
}

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
  fetchPoolById: (poolId: string) => Promise<void>;
  fetchUserPositions: (pubkey: string | undefined) => Promise<void>;
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
      const response = await fetch("/api/stakingpools");
      const data = await response.json();
      if (data.pools) {
        const pools: StakingPool[] = data.pools.map(mapPoolFromApi);
        console.log("Fetched pools:", pools);
        set({ pools, isLoading: false });
      }
    } catch (error) {
      console.error("Failed to fetch pools:", error);
      set({ isLoading: false });
    }
  },
  fetchPoolById: async (poolId: string) => {
    set({ isLoading: true });
    try {
      const response = await fetch(`/api/pools/${encodeURIComponent(poolId)}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch pool");
      }

      if (data.pool) {
        const pool = mapPoolFromApi(data.pool);
        set((state) => ({
          pools: state.pools.some((current) => current.id === pool.id)
            ? state.pools.map((current) =>
              current.id === pool.id ? pool : current,
            )
            : [...state.pools, pool],
          isLoading: false,
        }));
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error(`Failed to fetch pool ${poolId}:`, error);
      set({ isLoading: false });
    }
  },
  fetchUserPositions: async (pubkey: string | undefined) => {
    if (!pubkey) {
      set({ userPositions: [] });
      return;
    }

    try {
      if (get().pools.length === 0) {
        await get().fetchPools();
      }

      const response = await fetch(`/api/wallet/${encodeURIComponent(pubkey)}/positions`);
      if (!response.ok) {
        throw new Error("Failed to fetch user positions");
      }
      const data = await response.json();

      if (data.positions) {
        const mappedPositions = data.positions.map((pos: any) => {
          const pool = get().pools.find((p) => p.id === pos.pool);

          const shares = Number(pos.shares);
          const rewardDebt = Number(pos.rewardDebt);
          const rewardPerShare = pool?.rewardPerShare ? Number(pool.rewardPerShare) : 0;

          const pendingRewardsLamports = Math.max(0, (shares * rewardPerShare) / 1e12 - rewardDebt);
          const rewardsEarned = pendingRewardsLamports / 1e9;

          return {
            poolId: pos.pool,
            stakedAmount: shares / 1e9,
            rewardsEarned,
            claimedRewards: 0,
            stakedAt: Number(pos.depositTime) * 1000,
            unstakedAt: null,
            cooldownPeriod: 0,
          };
        });

        set({ userPositions: mappedPositions });
      }
    } catch (error) {
      console.error("Failed to fetch user positions:", error);
    }
  },
  initializeStore: () => {
    get().fetchPools();
  },
  simulateRewardAccrual: () => { },

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
              cooldownPeriod: UNSTAKE_COOLDOWN_SECONDS,
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
    if (!position || getRemainingCooldown(position) > 0) {
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
  updateRewardSimulation: () => { },
}));
