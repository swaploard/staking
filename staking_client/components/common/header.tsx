'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wallet } from 'lucide-react';
import { useStakingStore } from '@/lib/store';
import { motion } from 'framer-motion';

export function Header() {
  const pathname = usePathname();
  const { userWalletBalance } = useStakingStore();

  return (
    <header className="glass border-b border-purple-500/20 sticky top-0 z-50 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-white hover:text-cyan-300 transition-colors group">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center group-hover:shadow-lg group-hover:shadow-purple-500/50"
              >
                <span className="text-lg">◎</span>
              </motion.div>
              <span className="font-heading">Solana Stake</span>
            </Link>
          </motion.div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <motion.div whileHover={{ y: -2 }}>
              <Link
                href="/"
                className={`transition-all font-medium text-sm tracking-wide ${
                  pathname === '/'
                    ? 'text-cyan-300 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Dashboard
              </Link>
            </motion.div>
            <motion.div whileHover={{ y: -2 }}>
              <Link
                href="/pools"
                className={`transition-all font-medium text-sm tracking-wide ${
                  pathname === '/pools' || pathname.startsWith('/pools/')
                    ? 'text-cyan-300 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Pools
              </Link>
            </motion.div>
          </nav>

          {/* Wallet Info */}
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="flex items-center gap-3 glass border-cyan-500/30 rounded-xl px-4 py-2 hover:border-cyan-400/60 hover:neon-glow transition-all duration-300"
          >
            <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
              <Wallet className="h-5 w-5 text-cyan-400" />
            </motion.div>
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Balance</p>
              <p className="font-semibold text-white text-lg">{userWalletBalance.toFixed(2)} SOL</p>
            </div>
          </motion.div>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden flex gap-4 mt-4">
          <Link
            href="/"
            className={`text-sm font-medium transition-colors ${
              pathname === '/'
                ? 'text-cyan-300 font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Dashboard
          </Link>
          <Link
            href="/pools"
            className={`text-sm font-medium transition-colors ${
              pathname === '/pools' || pathname.startsWith('/pools/')
                ? 'text-cyan-300 font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Pools
          </Link>
        </nav>
      </div>
    </header>
  );
}
