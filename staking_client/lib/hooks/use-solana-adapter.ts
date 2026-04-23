"use client";

import { useCallback } from "react";
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { stake, StakeArgs } from "../adapters/stake";
import { unstake, UnstakeArgs } from "../adapters/unstake";
import { withdraw, WithdrawArgs } from "../adapters/withdraw";
import { claimRewards, ClaimRewardsArgs } from "../adapters/claim-rewards";

export interface SolanaAdapter {
  stakeTokens: (args: StakeArgs) => Promise<string>;
  unstakeTokens: (args: UnstakeArgs) => Promise<string>;
  withdrawUnstaked: (args: WithdrawArgs) => Promise<string>;
  claimPoolRewards: (args: ClaimRewardsArgs) => Promise<string>;
}

export function useSolanaAdapter(): SolanaAdapter | null {
  const { connection } = useConnection();
  const wallet = useWallet();

  const stakeTokens = useCallback(
    async (args: StakeArgs): Promise<string> => {
      if (!wallet || !wallet.signTransaction) {
        throw new Error("Wallet not connected");
      }
      return stake({ connection, wallet } as any, args);
    },
    [connection, wallet],
  );

  const unstakeTokens = useCallback(
    async (args: UnstakeArgs): Promise<string> => {
      if (!wallet || !wallet.signTransaction) {
        throw new Error("Wallet not connected");
      }
      return unstake({ connection, wallet } as any, args);
    },
    [connection, wallet],
  );

  const withdrawUnstaked = useCallback(
    async (args: WithdrawArgs): Promise<string> => {
      if (!wallet || !wallet.signTransaction) {
        throw new Error("Wallet not connected");
      }
      return withdraw({ connection, wallet } as any, args);
    },
    [connection, wallet],
  );

  const claimPoolRewards = useCallback(
    async (args: ClaimRewardsArgs): Promise<string> => {
      if (!wallet || !wallet.signTransaction) {
        throw new Error("Wallet not connected");
      }
      return claimRewards({ connection, wallet } as any, args);
    },
    [connection, wallet],
  );

  if (!wallet.connected) {
    return null;
  }

  return {
    stakeTokens,
    unstakeTokens,
    withdrawUnstaked,
    claimPoolRewards,
  };
}
