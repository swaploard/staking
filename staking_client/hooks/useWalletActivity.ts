"use client";

import { useEffect, useState } from "react";
import type { StakingAction } from "@/lib/types";

interface WalletActivityItem {
  id: string;
  signature: string;
  blockTime: string | null;
  eventType: string;
  poolId: string | null;
  amount: string | null;
  timestamp: string | null;
  status: string;
}

interface WalletActivityResponse {
  activity: WalletActivityItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface UseWalletActivityOptions {
  days?: number;
  enabled?: boolean;
  limit?: number;
}

interface UseWalletActivityResult {
  actions: StakingAction[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const EVENT_TYPE_TO_ACTION: Record<string, StakingAction["type"]> = {
  Staked: "stake",
  Stake: "stake",
  UnstakeRequested: "unstake",
  Unstake: "unstake",
  Withdrawn: "withdraw",
  Withdraw: "withdraw",
  RewardsClaimed: "claim",
  Claim: "claim",
  EmergencyWithdrawn: "withdraw",
};

const STATUS_TO_ACTION: Record<string, StakingAction["status"]> = {
  confirmed: "confirmed",
  pending: "pending",
  failed: "failed",
};

function toSolAmount(amount: string | null): number {
  if (!amount) return 0;
  return Number(amount) / 1_000_000_000;
}

function toTimestamp(activity: WalletActivityItem): number {
  if (activity.blockTime) {
    return new Date(activity.blockTime).getTime();
  }

  if (activity.timestamp) {
    return Number(activity.timestamp) * 1000;
  }

  return Date.now();
}

function toStakingAction(activity: WalletActivityItem): StakingAction | null {
  const type = EVENT_TYPE_TO_ACTION[activity.eventType];

  if (!type || !activity.poolId) {
    return null;
  }

  return {
    id: activity.id,
    type,
    poolId: activity.poolId,
    amount: toSolAmount(activity.amount),
    timestamp: toTimestamp(activity),
    status: STATUS_TO_ACTION[activity.status] ?? "confirmed",
    transactionHash: activity.signature,
  };
}

export function useWalletActivity(
  pubkey: string | undefined,
  options: UseWalletActivityOptions = {},
): UseWalletActivityResult {
  const { days = 30, enabled = true, limit = 5 } = options;
  const [actions, setActions] = useState<StakingAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchActivity = async () => {
    if (!pubkey || !enabled) {
      setActions([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        days: days.toString(),
        limit: limit.toString(),
      });

      const response = await fetch(
        `/api/wallet/${encodeURIComponent(pubkey)}/activity?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch activity: ${response.statusText}`);
      }

      const data: WalletActivityResponse = await response.json();
      setActions(
        data.activity
          .map(toStakingAction)
          .filter((action): action is StakingAction => Boolean(action)),
      );
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchActivity();
  }, [pubkey, days, enabled, limit]);

  return {
    actions,
    loading,
    error,
    refetch: fetchActivity,
  };
}
