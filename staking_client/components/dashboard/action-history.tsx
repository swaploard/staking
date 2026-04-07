'use client';

import { StakingAction } from '@/lib/types';
import { Check, Clock, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActionHistoryProps {
  actions: StakingAction[];
}

export function ActionHistory({ actions }: ActionHistoryProps) {
  if (actions.length === 0) {
    return (
      <div className="rounded-lg border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800 p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">Recent Actions</h3>
        <p className="text-center text-slate-400">No recent actions</p>
      </div>
    );
  }

  const getActionIcon = (type: StakingAction['type']) => {
    const icons = {
      stake: '📤',
      unstake: '📥',
      claim: '🎁',
      withdraw: '💸',
    };
    return icons[type];
  };

  const getActionLabel = (type: StakingAction['type']) => {
    const labels = {
      stake: 'Stake',
      unstake: 'Unstake',
      claim: 'Claim Rewards',
      withdraw: 'Withdraw',
    };
    return labels[type];
  };

  const getStatusIcon = (status: StakingAction['status']) => {
    if (status === 'confirmed') {
      return <Check className="h-4 w-4 text-emerald-400" />;
    } else if (status === 'pending') {
      return <Clock className="h-4 w-4 text-blue-400" />;
    } else {
      return <AlertCircle className="h-4 w-4 text-red-400" />;
    }
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <h3 className="mb-4 text-lg font-semibold text-white">Recent Actions</h3>
      <div className="space-y-3">
        {actions.slice(0, 5).map((action) => (
          <div key={action.id} className="flex items-center justify-between rounded-lg bg-white/5 p-3">
            <div className="flex items-center gap-3">
              <span className="text-lg">{getActionIcon(action.type)}</span>
              <div>
                <p className="font-medium text-white">{getActionLabel(action.type)}</p>
                <p className="text-xs text-slate-400">
                  {action.amount > 0 ? `${action.amount.toFixed(2)} SOL` : 'Process'} •{' '}
                  {formatDistanceToNow(action.timestamp, { addSuffix: true })}
                </p>
              </div>
            </div>
            {getStatusIcon(action.status)}
          </div>
        ))}
      </div>
    </div>
  );
}
