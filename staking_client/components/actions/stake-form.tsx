'use client';

import { useState } from 'react';
import { useStakingStore } from '@/lib/store';
import { StakingPool } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { AlertCircle, Check, Loader2 } from 'lucide-react';

interface StakeFormProps {
  poolId: string;
  pool: StakingPool;
  availableBalance: number;
}

export function StakeForm({ poolId, pool, availableBalance }: StakeFormProps) {
  const { stakeTokens, actionState, resetActionState } = useStakingStore();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const handleStake = async () => {
    const stakeAmount = parseFloat(amount);

    if (isNaN(stakeAmount) || stakeAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (stakeAmount < pool.minimumStake) {
      setError(`Minimum stake is ${pool.minimumStake} SOL`);
      return;
    }

    if (stakeAmount > availableBalance) {
      setError('Insufficient balance');
      return;
    }

    setError('');
    await stakeTokens(poolId, stakeAmount);
  };

  const setMaxAmount = () => {
    setAmount(Math.max(availableBalance - 0.1, 0).toFixed(2));
    setError('');
  };

  const calculateRewards = () => {
    const stakeAmount = parseFloat(amount) || 0;
    const yearlyReward = (stakeAmount * pool.apy) / 100;
    return yearlyReward / 365; // Daily estimate
  };

  return (
    <div className="space-y-6">
      {actionState.type === 'stake' && actionState.success && (
        <div className="rounded-lg border border-emerald-700/50 bg-emerald-500/10 p-4 flex items-center gap-3">
          <Check className="h-5 w-5 text-emerald-400" />
          <div>
            <p className="font-semibold text-emerald-300">Staking successful!</p>
            <p className="text-sm text-emerald-200">{amount} SOL staked in {pool.name}</p>
          </div>
        </div>
      )}

      {actionState.type === 'stake' && actionState.error && (
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

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Amount to Stake (SOL)</label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError('');
            }}
            placeholder={`Min ${pool.minimumStake} SOL`}
            disabled={actionState.type === 'stake' && actionState.isLoading}
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
          Available: {availableBalance.toFixed(2)} SOL • Min: {pool.minimumStake} SOL
        </p>
      </div>

      {amount && parseFloat(amount) > 0 && (
        <div className="rounded-lg bg-white/5 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Pool APY</span>
            <span className="text-white font-semibold">{pool.apy.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Est. Daily Rewards</span>
            <span className="text-emerald-400 font-semibold">{calculateRewards().toFixed(4)} SOL</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Est. Yearly Rewards</span>
            <span className="text-emerald-400 font-semibold">
              {((parseFloat(amount) * pool.apy) / 100).toFixed(2)} SOL
            </span>
          </div>
        </div>
      )}

      <button
        onClick={async () => {
          await handleStake();
          if (!error && parseFloat(amount) > 0) {
            setTimeout(() => {
              setAmount('');
              resetActionState();
            }, 2000);
          }
        }}
        disabled={actionState.type === 'stake' && actionState.isLoading}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-all hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {actionState.type === 'stake' && actionState.isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : actionState.type === 'stake' && actionState.success ? (
          <>
            <Check className="h-4 w-4" />
            Success!
          </>
        ) : (
          'Stake Now'
        )}
      </button>
    </div>
  );
}
