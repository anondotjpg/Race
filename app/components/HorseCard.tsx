'use client';

import { useState, useEffect } from 'react';
import type { HorseWithOdds } from '../types';

interface HorseCardProps {
  horse: HorseWithOdds;
  onBet: (horseId: number, amount: number) => Promise<void>;
  disabled?: boolean;
  isWinner?: boolean;
}

const COLORS: Record<
  string,
  { bg: string; text: string; accent: string; glow: string }
> = {
  '#FFD700': {
    bg: 'from-amber-500/10 to-yellow-500/5',
    text: 'text-amber-600',
    accent: 'bg-amber-500',
    glow: 'shadow-amber-500/20',
  },
  '#8B5CF6': {
    bg: 'from-violet-500/10 to-purple-500/5',
    text: 'text-violet-600',
    accent: 'bg-violet-500',
    glow: 'shadow-violet-500/20',
  },
  '#EF4444': {
    bg: 'from-red-500/10 to-rose-500/5',
    text: 'text-red-600',
    accent: 'bg-red-500',
    glow: 'shadow-red-500/20',
  },
  '#06B6D4': {
    bg: 'from-cyan-500/10 to-teal-500/5',
    text: 'text-cyan-600',
    accent: 'bg-cyan-500',
    glow: 'shadow-cyan-500/20',
  },
  '#10B981': {
    bg: 'from-emerald-500/10 to-green-500/5',
    text: 'text-emerald-600',
    accent: 'bg-emerald-500',
    glow: 'shadow-emerald-500/20',
  },
};

const QUICK_AMOUNTS = [0.05, 0.1, 0.25, 0.5, 1];

export function HorseCard({
  horse,
  onBet,
  disabled = false,
  isWinner = false,
}: HorseCardProps) {
  const colors = COLORS[horse.color] || COLORS['#8B5CF6'];

  const [amount, setAmount] = useState('0.1');
  const [betting, setBetting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reset betting state safely if parent disables mid-flight
  useEffect(() => {
    if (disabled) setBetting(false);
  }, [disabled]);

  // ─────────────────────────────────────────────
  // BET HANDLER (GUARDED + SERIALIZED)
  // ─────────────────────────────────────────────

  const handleBet = async () => {
    if (betting || disabled) return;

    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    setBetting(true);
    try {
      await onBet(horse.id, parsed);
    } finally {
      setBetting(false);
    }
  };

  // ─────────────────────────────────────────────
  // CLIPBOARD (SAFE)
  // ─────────────────────────────────────────────

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(horse.wallet_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // silently ignore (Safari private mode etc.)
    }
  };

  // ─────────────────────────────────────────────
  // INPUT SANITIZATION
  // ─────────────────────────────────────────────

  const handleAmountChange = (v: string) => {
    // Prevent scientific notation / negatives
    if (!/^\d*\.?\d{0,3}$/.test(v)) return;
    setAmount(v);
  };

  return (
    <div
      className={`
        relative overflow-visible rounded-2xl transition-all duration-300
        ${
          isWinner
            ? `rounded-2xl shadow-lg ${colors.glow}`
            : 'shadow-sm hover:shadow-md'
        }
        ${disabled ? 'opacity-60 pointer-events-none' : ''}
      `}
    >
      <div className="absolute inset-0 bg-white/80 rounded-2xl" />

      {/* Winner badge */}
      {isWinner && (
        <div className="absolute -top-5 -right-5 z-10 flex items-center gap-1 px-2 py-1 rounded-full">
          <span className="text-3xl">👑</span>
        </div>
      )}

      <div className="relative p-5">
        {/* HEADER */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex gap-3">
            <div
              className={`w-12 h-12 rounded-xl ${colors.accent} flex items-center justify-center shadow-lg ${colors.glow}`}
            >
              <span className="text-2xl">{horse.emoji}</span>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900">
                {horse.name}
              </h3>
            </div>
          </div>

          <div className="text-right">
            <div className={`text-2xl font-bold ${colors.text}`}>
              {horse.odds || '—'}
              <span className="text-sm font-normal text-gray-400">
                x
              </span>
            </div>
            <p className="text-xs text-gray-400">odds</p>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">
              Total Bets
            </p>
            <p className="font-semibold text-gray-900">
              {horse.totalBets?.toFixed(3) ?? '0.000'}{' '}
              <span className="text-gray-400 font-normal">
                SOL
              </span>
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">
              Pool Share
            </p>
            <p className="font-semibold text-gray-900">
              {(horse as any).percentage ?? '0'}
              <span className="text-gray-400 font-normal">
                %
              </span>
            </p>
          </div>
        </div>

        {/* WALLET */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2">
            Deposit Address
          </p>
          <button
            onClick={copyAddress}
            type="button"
            className="w-full flex items-center justify-between gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors group"
          >
            <code className="text-xs text-gray-600 font-mono truncate">
              {horse.wallet_address}
            </code>
            <span
              className={`text-xs font-medium ${
                copied
                  ? 'text-green-600'
                  : 'text-gray-400 group-hover:text-gray-600'
              }`}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </span>
          </button>
        </div>

        {/* QUICK AMOUNTS */}
        <div className="flex gap-1.5 mb-3">
          {QUICK_AMOUNTS.map(amt => {
            const active = amount === amt.toString();
            return (
              <button
                key={amt}
                type="button"
                onClick={() => setAmount(amt.toString())}
                className={`
                  flex-1 py-2 rounded-lg text-xs font-medium transition-all
                  ${
                    active
                      ? `${colors.accent} text-white shadow-sm`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }
                `}
              >
                {amt}
              </button>
            );
          })}
        </div>

        {/* BET INPUT */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={e => handleAmountChange(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-3 pr-14 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-gray-900 transition"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">
              SOL
            </span>
          </div>

          <button
            onClick={handleBet}
            disabled={betting || disabled}
            className={`
              px-6 py-3 rounded-xl font-semibold text-white transition-all
              ${colors.accent}
              hover:opacity-90 active:scale-95
              disabled:opacity-50 disabled:cursor-not-allowed
              shadow-lg ${colors.glow}
            `}
          >
            {betting ? (
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              'Bet'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
