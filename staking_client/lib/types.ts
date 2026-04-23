// Core types for Solana staking dashboard

export interface StakingPool {
  id: string;
  poolId: number | null;
  name: string;
  description: string;
  stakeMint: string;
  rewardMint: string;
  apy: number; // Annual Percentage Yield (%)
  tvl: number; // Total Value Locked (SOL)
  totalStakers: number;
  minimumStake: number; // Minimum SOL to stake
  rewardToken: string; // Token address
  status: 'active' | 'inactive' | 'maintenance';
}

export interface UserPosition {
  poolId: string;
  stakedAmount: number; // SOL
  rewardsEarned: number; // Accrued rewards
  claimedRewards: number; // Total claimed
  stakedAt: number; // Timestamp
  unstakedAt: number | null; // Timestamp when unstaking started
  cooldownPeriod: number; // Remaining cooldown in seconds
}

export interface StakingAction {
  id: string;
  type: 'stake' | 'unstake' | 'claim' | 'withdraw';
  poolId: string;
  amount: number;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  transactionHash?: string;
}

export interface DashboardStats {
  totalStaked: number; // Total SOL staked
  totalRewards: number; // Total rewards earned
  totalClaimed: number; // Total rewards claimed
  activePositions: number; // Number of active staking positions
}

export interface ActionState {
  type: 'stake' | 'unstake' | 'claim' | 'withdraw' | null;
  poolId: string | null;
  amount: number;
  isLoading: boolean;
  error: string | null;
  success: boolean;
}
