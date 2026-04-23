"use client";

import { useState } from "react";
import { useStakingStore } from "@/lib/store";
import { useSolanaAdapter } from "@/lib/hooks/use-solana-adapter";
import { StakingPool } from "@/lib/types";
import { AlertCircle, Check, Loader2, Info } from "lucide-react";
import { PublicKey } from "@solana/web3.js";

interface WithdrawFormProps {
  pool: StakingPool;
}

export function WithdrawForm({ pool }: WithdrawFormProps) {
  const { withdrawUnstaked, actionState, resetActionState } = useStakingStore();
  const adapter = useSolanaAdapter();
  const [error, setError] = useState("");

  const handleWithdraw = async () => {
    setError("");

    if (adapter) {
      try {
        if (pool.poolId === null) {
          setError("This pool is missing its on-chain pool ID");
          return;
        }
        const stakeMint = new PublicKey(pool.stakeMint);
        const txHash = await adapter.withdrawUnstaked({
          poolId: pool.poolId,
          stakeMint,
        });
        await withdrawUnstaked(pool.id, txHash);
      } catch (err: any) {
        setError(err.message || "Transaction failed");
      }
    } else {
      await withdrawUnstaked(pool.id);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-700/50 bg-red-500/10 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {actionState.type === "withdraw" && actionState.success && (
        <div className="rounded-lg border border-emerald-700/50 bg-emerald-500/10 p-4 flex items-center gap-3">
          <Check className="h-5 w-5 text-emerald-400" />
          <div>
            <p className="font-semibold text-emerald-300">
              Withdrawal successful!
            </p>
            <p className="text-sm text-emerald-200">
              Your SOL has been returned to your wallet.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Info className="h-6 w-6 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">
            Withdraw Unstaked SOL
          </h3>
        </div>

        <p className="text-slate-300 mb-6">
          Your unstaking cooldown period has completed. You can now withdraw
          your SOL from this pool.
        </p>

        <div className="rounded-lg bg-white/5 p-4 space-y-2 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Pool</span>
            <span className="text-white font-semibold">{pool.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Status</span>
            <span className="text-emerald-400 font-semibold">
              Ready to Withdraw
            </span>
          </div>
        </div>

        <button
          onClick={async () => {
            await handleWithdraw();
            setTimeout(() => {
              resetActionState();
            }, 2000);
          }}
          disabled={actionState.type === "withdraw" && actionState.isLoading}
          className="w-full rounded-lg bg-green-600 px-4 py-3 font-semibold text-white transition-all hover:bg-green-500 disabled:bg-green-600/50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {actionState.type === "withdraw" && actionState.isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : actionState.type === "withdraw" && actionState.success ? (
            <>
              <Check className="h-4 w-4" />
              Withdrawn!
            </>
          ) : (
            "Withdraw Now"
          )}
        </button>
      </div>

      <div className="rounded-lg border border-blue-700/50 bg-blue-500/10 p-4">
        <p className="text-xs font-semibold text-blue-300">ℹ️ IMPORTANT</p>
        <p className="mt-2 text-xs text-blue-200">
          Withdrawing completes your position with this pool. Unclaimed rewards
          will be lost if not claimed before withdrawal.
        </p>
      </div>
    </div>
  );
}
