"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

let globalBalanceTrigger = 0;

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
}