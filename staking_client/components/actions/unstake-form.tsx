"use client";

import { useState } from "react";
import { useStakingStore } from "@/lib/store";
import { useSolanaAdapter } from "@/lib/hooks/use-solana-adapter";
import { StakingPool, UserPosition } from "@/lib/types";
import { AlertCircle, Check, Loader2, Clock } from "lucide-react";

interface UnstakeFormProps {
  pool: StakingPool;
  position: UserPosition;
}

export function UnstakeForm({ pool, position }: UnstakeFormProps) {
  const { unstakeTokens, actionState, resetActionState } = useStakingStore();
  const adapter = useSolanaAdapter();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  const handleUnstake = async () => {
    const unstakeAmount = parseFloat(amount);

    if (isNaN(unstakeAmount) || unstakeAmount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (unstakeAmount > position.stakedAmount) {
      setError(
        `Maximum unstake amount is ${position.stakedAmount.toFixed(2)} SOL`,
      );
      return;
    }

    setError("");

    if (adapter) {
      try {
        if (pool.poolId === null) {
          setError("This pool is missing its on-chain pool ID");
          return;
        }
        const txHash = await adapter.unstakeTokens({
          poolId: pool.poolId,
          amount: unstakeAmount,
        });
        await unstakeTokens(pool.id, unstakeAmount, txHash);
      } catch (err: any) {
        setError(err.message || "Transaction failed");
      }
    } else {
      await unstakeTokens(pool.id, unstakeAmount);
    }
  };

  const setMaxAmount = () => {
    setAmount(position.stakedAmount.toFixed(2));
    setError("");
  };

  return (
    <div className="space-y-6">
      {actionState.type === "unstake" && actionState.success && (
        <div className="rounded-lg border border-emerald-700/50 bg-emerald-500/10 p-4 flex items-center gap-3">
          <Check className="h-5 w-5 text-emerald-400" />
          <div>
            <p className="font-semibold text-emerald-300">
              Unstaking initiated!
            </p>
            <p className="text-sm text-emerald-200">
              48-hour cooldown period started. Withdraw after cooldown
              completes.
            </p>
          </div>
        </div>
      )}

      {actionState.type === "unstake" && actionState.error && (
        <div className="rounded-lg border border-red-700/50 bg-red-500/10 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <p className="text-sm text-red-200">{actionState.error}</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-700/50 bg-red-500/10 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      <div className="rounded-lg border border-yellow-700/50 bg-yellow-500/10 p-4 flex items-start gap-3">
        <Clock className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-yellow-300">48-Hour Cooldown</p>
          <p className="text-sm text-yellow-200 mt-1">
            After unstaking, you'll need to wait 48 hours before you can
            withdraw your SOL.
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Amount to Unstake (SOL)
        </label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError("");
            }}
            placeholder="0.00"
            disabled={actionState.type === "unstake" && actionState.isLoading}
            className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-white placeholder-slate-500 transition-all hover:border-slate-600 focus:border-blue-600 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={setMaxAmount}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-blue-400 hover:text-blue-300"
          >
            Max
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Currently staked: {position.stakedAmount.toFixed(2)} SOL
        </p>
      </div>

      {amount && parseFloat(amount) > 0 && (
        <div className="rounded-lg bg-white/5 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Unstaking Amount</span>
            <span className="text-white font-semibold">
              {parseFloat(amount).toFixed(2)} SOL
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Remaining Staked</span>
            <span className="text-white font-semibold">
              {Math.max(0, position.stakedAmount - parseFloat(amount)).toFixed(
                2,
              )}{" "}
              SOL
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Accrued Rewards</span>
            <span className="text-emerald-400 font-semibold">
              {position.rewardsEarned.toFixed(4)} SOL
            </span>
          </div>
        </div>
      )}

      <button
        onClick={async () => {
          await handleUnstake();
          if (!error && parseFloat(amount) > 0) {
            setTimeout(() => {
              setAmount("");
              resetActionState();
            }, 2000);
          }
        }}
        disabled={actionState.type === "unstake" && actionState.isLoading}
        className="w-full rounded-lg bg-yellow-600 px-4 py-3 font-semibold text-white transition-all hover:bg-yellow-500 disabled:bg-yellow-600/50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {actionState.type === "unstake" && actionState.isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : actionState.type === "unstake" && actionState.success ? (
          <>
            <Check className="h-4 w-4" />
            Unstaking!
          </>
        ) : (
          "Unstake"
        )}
      </button>
    </div>
  );
}
