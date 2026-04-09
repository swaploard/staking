'use client';

import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  subtext?: string;
  variant?: 'default' | 'primary' | 'success';
  index?: number;
}

export function StatCard({ label, value, icon: Icon, subtext, variant = 'default', index = 0 }: StatCardProps) {
  const variantClasses = {
    default: 'glass border-purple-500/30 hover:border-purple-500/60 hover:bg-purple-500/5',
    primary: 'glass border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-500/5',
    success: 'glass border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/5',
  };

  const variantGlow = {
    default: 'neon-glow-purple',
    primary: 'neon-glow',
    success: 'neon-glow',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -5, scale: 1.02 }}
      className={`relative rounded-2xl border p-6 transition-all duration-300 ${variantClasses[variant]} group`}
    >
      {/* Animated gradient background */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-900 group-hover:text-slate-300 transition-colors">{label}</p>
          <p className="mt-3 text-4xl font-bold text-black font-heading">{value}</p>
          {subtext && <p className="mt-2 text-xs text-slate-900 group-hover:text-slate-300 transition-colors">{subtext}</p>}
        </div>
        <motion.div
          whileHover={{ rotate: 10, scale: 1.1 }}
          className={`rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-purple-500/30 p-3 ${variantGlow}`}
        >
          <Icon className="h-6 w-6 text-purple-300" />
        </motion.div>
      </div>
    </motion.div>
  );
}
