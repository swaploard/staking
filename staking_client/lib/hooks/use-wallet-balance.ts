"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {
  getAccount,
  getAssociatedTokenAddress,
  getMint,
  NATIVE_MINT,
} from "@solana/spl-token";

let globalBalanceTrigger = 0;

function isNativeMintAddress(stakeMintAddress?: string): boolean {
  if (!stakeMintAddress) return false;

  try {
    return new PublicKey(stakeMintAddress).equals(NATIVE_MINT);
  } catch {
    return false;
  }
}

export function useWalletBalance(): number {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState(0);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    const fetchBalance = async () => {
      if (connected && publicKey) {
        try {
          const lamports = await connection.getBalance(publicKey);
          setBalance(lamports / LAMPORTS_PER_SOL);
        } catch (error) {
          console.error("Error fetching balance:", error);
          setBalance(0);
        }
      } else {
        setBalance(0);
      }
    };

    fetchBalance();
  }, [connection, publicKey, connected, trigger]);

  const refresh = useCallback(() => {
    setTrigger((t) => t + 1);
  }, []);

  (window as any).__refreshWalletBalance = refresh;

  return balance;
}

export function refreshWalletBalance() {
  const fn = (window as any).__refreshWalletBalance;
  if (fn) fn();
  window.dispatchEvent(new Event("wallet-balance-refresh"));
}

export interface StakeMintBalance {
  balance: number;
  decimals: number;
  isLoading: boolean;
  symbol: string;
}

export function useStakeMintBalance(
  stakeMintAddress?: string
): StakeMintBalance {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState(0);
  const [decimals, setDecimals] = useState(9);
  const [isLoading, setIsLoading] = useState(false);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    const refresh = () => setTrigger((t) => t + 1);
    window.addEventListener("wallet-balance-refresh", refresh);
    return () => window.removeEventListener("wallet-balance-refresh", refresh);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchBalance = async () => {
      if (!connected || !publicKey || !stakeMintAddress) {
        setBalance(0);
        setDecimals(9);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const stakeMint = new PublicKey(stakeMintAddress);

        if (stakeMint.equals(NATIVE_MINT)) {
          const lamports = await connection.getBalance(publicKey);
          if (!cancelled) {
            setBalance(lamports / LAMPORTS_PER_SOL);
            setDecimals(9);
          }
          return;
        }

        const [mintInfo, userStakeAta] = await Promise.all([
          getMint(connection, stakeMint),
          getAssociatedTokenAddress(stakeMint, publicKey),
        ]);

        let rawAmount = BigInt(0);
        try {
          const tokenAccount = await getAccount(connection, userStakeAta);
          rawAmount = tokenAccount.amount;
        } catch {
          rawAmount = BigInt(0);
        }

        if (!cancelled) {
          setDecimals(mintInfo.decimals);
          setBalance(Number(rawAmount) / 10 ** mintInfo.decimals);
        }
      } catch (error) {
        console.error("Error fetching stake mint balance:", error);
        if (!cancelled) {
          setBalance(0);
          setDecimals(9);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchBalance();

    return () => {
      cancelled = true;
    };
  }, [connection, publicKey, connected, stakeMintAddress, trigger]);

  return {
    balance,
    decimals,
    isLoading,
    symbol: isNativeMintAddress(stakeMintAddress) ? "SOL" : "tokens",
  };
}
