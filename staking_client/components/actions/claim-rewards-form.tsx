"use client";

import { useState, useEffect } from "react";
import { useStakingStore } from "@/lib/store";
import { useSolanaAdapter } from "@/lib/hooks/use-solana-adapter";
import { StakingPool, UserPosition } from "@/lib/types";
import { Check, Loader2, Award } from "lucide-react";
import { AnimatedCounter } from "../dashboard/animated-counter";
import { PublicKey } from "@solana/web3.js";

interface ClaimRewardsFormProps {
  pool: StakingPool;
  position: UserPosition;
}

export function ClaimRewardsForm({
  pool,
  position,
}: ClaimRewardsFormProps) {
  const { claimRewards, actionState, resetActionState } = useStakingStore();
  const adapter = useSolanaAdapter();
  const [currentRewards, setCurrentRewards] = useState(position.rewardsEarned);
  const [error, setError] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      const secondlyRate = pool.apy / 100 / 365 / 24 / 60 / 60;
      const rewardAccrual = position.stakedAmount * secondlyRate;
      setCurrentRewards((prev) => prev + rewardAccrual);
    }, 1000);

    return () => clearInterval(interval);
  }, [pool.apy, position.stakedAmount]);

  const handleClaim = async () => {
    setError("");

    if (adapter) {
      try {
        if (pool.poolId === null) {
          setError("This pool is missing its on-chain pool ID");
          return;
        }
        const rewardMint = new PublicKey(pool.rewardMint);
        const txHash = await adapter.claimPoolRewards({
          poolId: pool.poolId,
          rewardMint,
        });
        await claimRewards(pool.id, txHash);
      } catch (err: any) {
        setError(err.message || "Transaction failed");
      }
    } else {
      await claimRewards(pool.id);
    }
  };

  return (
    <div className="space-y-6">
      {actionState.type === "claim" && actionState.success && (
        <div className="rounded-lg border border-emerald-700/50 bg-emerald-500/10 p-4 flex items-center gap-3">
          <Check className="h-5 w-5 text-emerald-400" />
          <div>
            <p className="font-semibold text-emerald-300">Rewards claimed!</p>
            <p className="text-sm text-emerald-200">
              {actionState.amount.toFixed(4)} SOL added to your wallet
            </p>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Award className="h-6 w-6 text-emerald-400" />
          <h3 className="text-lg font-semibold text-white">
            Your Pending Rewards
          </h3>
        </div>

        <div className="mb-6">
          <p className="text-4xl font-bold text-emerald-400">
            <AnimatedCounter
              value={currentRewards}
              decimals={4}
              suffix=" SOL"
            />
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Accruing at{" "}
            {((position.stakedAmount * pool.apy) / 100 / 365).toFixed(6)} SOL
            per day
          </p>
        </div>

        <div className="rounded-lg bg-white/5 p-4 space-y-2 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Staked Amount</span>
            <span className="text-white font-semibold">
              {position.stakedAmount.toFixed(2)} SOL
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Pool APY</span>
            <span className="text-white font-semibold">
              {pool.apy.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Total Previously Claimed</span>
            <span className="text-emerald-400 font-semibold">
              {position.claimedRewards.toFixed(2)} SOL
            </span>
          </div>
        </div>

        <button
          onClick={async () => {
            await handleClaim();
            setTimeout(() => {
              resetActionState();
            }, 2000);
          }}
          disabled={actionState.type === "claim" && actionState.isLoading}
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white transition-all hover:bg-emerald-500 disabled:bg-emerald-600/50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {actionState.type === "claim" && actionState.isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : actionState.type === "claim" && actionState.success ? (
            <>
              <Check className="h-4 w-4" />
              Claimed!
            </>
          ) : (
            <>
              <Award className="h-4 w-4" />
              Claim Rewards
            </>
          )}
        </button>
      </div>

      <div className="rounded-lg border border-blue-700/50 bg-blue-500/10 p-4">
        <p className="text-xs font-semibold text-blue-300">ℹ️ NOTE</p>
        <p className="mt-2 text-xs text-blue-200">
          Claiming rewards does not unstake your SOL. Your staked amount
          continues earning rewards.
        </p>
      </div>
    </div>
  );
}
