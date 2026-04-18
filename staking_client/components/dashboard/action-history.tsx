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
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: '8px',
          padding: '20px',
        }}
      >
        <h4 style={{ fontWeight: 560, fontSize: '15px', marginBottom: '16px', color: 'var(--text-primary)' }}>
          Recent Actions
        </h4>
        <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
          No recent actions
        </p>
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
      return <Check style={{ width: '14px', height: '14px', color: '#27a644' }} />;
    } else if (status === 'pending') {
      return <Clock style={{ width: '14px', height: '14px', color: '#55cdff' }} />;
    } else {
      return <AlertCircle style={{ width: '14px', height: '14px', color: '#eb5757' }} />;
    }
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: '8px',
        padding: '20px',
      }}
    >
      <h4 style={{ fontWeight: 560, fontSize: '15px', marginBottom: '16px', color: 'var(--text-primary)' }}>
        Recent Actions
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {actions.slice(0, 5).map((action) => (
          <div
            key={action.id}
            className="flex items-center justify-between"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: '6px',
              padding: '10px 12px',
              transition: 'background-color 0.15s ease',
            }}
          >
            <div className="flex items-center gap-3">
              <span style={{ fontSize: '16px' }}>{getActionIcon(action.type)}</span>
              <div>
                <p style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-primary)' }}>
                  {getActionLabel(action.type)}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
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
