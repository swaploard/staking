'use client';

import type { StakingAction } from '@/lib/types';
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Clock,
  Gift,
  RotateCcw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActionHistoryProps {
  actions: StakingAction[];
  error?: Error | null;
  isLoading?: boolean;
  walletConnected?: boolean;
}

export function ActionHistory({
  actions,
  error = null,
  isLoading = false,
  walletConnected = true,
}: ActionHistoryProps) {
  const renderStatus = (message: string) => {
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
          {message}
        </p>
      </div>
    );
  };

  if (!walletConnected) {
    return renderStatus('Connect your wallet to view activity');
  }

  if (isLoading) {
    return renderStatus('Loading recent actions...');
  }

  if (error) {
    return renderStatus('Unable to load recent actions');
  }

  if (actions.length === 0) {
    return renderStatus('No recent actions');
  }

  const getActionIcon = (type: StakingAction['type']) => {
    const icons = {
      stake: <ArrowUpFromLine style={{ width: '15px', height: '15px' }} />,
      unstake: <RotateCcw style={{ width: '15px', height: '15px' }} />,
      claim: <Gift style={{ width: '15px', height: '15px' }} />,
      withdraw: <ArrowDownToLine style={{ width: '15px', height: '15px' }} />,
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
              <span style={{ color: 'var(--text-secondary)' }}>{getActionIcon(action.type)}</span>
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
