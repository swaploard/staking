'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wallet } from 'lucide-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useEffect, useState } from 'react';

export function Header() {
  const pathname = usePathname();
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();

  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    const getBalance = async () => {
      if (connected && publicKey) {
        try {
          const lamports = await connection.getBalance(publicKey);
          const solBalance = lamports / LAMPORTS_PER_SOL;
          setBalance(solBalance);
        } catch (error) {
          console.error('Error fetching balance:', error);
          setBalance(null);
        }
      } else {
        setBalance(null);
      }
    };

    getBalance();
  }, [connection, publicKey, connected]);

  const navLinkStyle = (isActive: boolean) => ({
    fontSize: '13px',
    fontWeight: isActive ? 560 : 500,
    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
    transition: 'color 0.15s ease',
    padding: '4px 0',
    position: 'relative' as const,
  });

  return (
    <header
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-default)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ padding: '0 24px' }}>
        <div
          className="flex items-center justify-between"
          style={{ height: '48px' }}
        >
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2"
            style={{ textDecoration: 'none' }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                background: 'linear-gradient(135deg, #8b5cf6, #55cdff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                color: '#ffffff',
              }}
            >
              ◎
            </div>
            <span
              style={{
                fontSize: '15px',
                fontWeight: 590,
                letterSpacing: '-0.13px',
                color: 'var(--text-primary)',
              }}
            >
              Solana Stake
            </span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/"
              style={navLinkStyle(pathname === '/')}
              className="hover:!text-[var(--text-primary)]"
            >
              Dashboard
            </Link>
            <Link
              href="/pools"
              style={navLinkStyle(pathname === '/pools' || pathname.startsWith('/pools/'))}
              className="hover:!text-[var(--text-primary)]"
            >
              Pools
            </Link>
          </nav>

          {/* Wallet Info */}
          {connected ? (
            <div
              className="flex items-center gap-3"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-default)',
                borderRadius: '6px',
                padding: '6px 12px',
              }}
            >
              <Wallet style={{ width: '16px', height: '16px', color: 'var(--text-tertiary)' }} />
              <div className="hidden sm:block text-right">
                <p style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                  Balance
                </p>
                <p style={{ fontSize: '14px', fontWeight: 560, color: 'var(--text-primary)' }}>
                  {balance?.toFixed(2) || '0.00'} SOL
                </p>
              </div>
            </div>
          ) : (
            <div className="wallet-header-button flex items-center gap-2">
              <Wallet style={{ width: '16px', height: '16px', color: 'var(--text-tertiary)' }} />
              <WalletMultiButton />
            </div>
          )}
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden flex gap-4" style={{ paddingBottom: '8px' }}>
          <Link
            href="/"
            style={navLinkStyle(pathname === '/')}
            className="hover:!text-[var(--text-primary)]"
          >
            Dashboard
          </Link>
          <Link
            href="/pools"
            style={navLinkStyle(pathname === '/pools' || pathname.startsWith('/pools/'))}
            className="hover:!text-[var(--text-primary)]"
          >
            Pools
          </Link>
        </nav>
      </div>
    </header>
  );
}
