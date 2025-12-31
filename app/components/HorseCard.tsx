// components/HorseCard.tsx
'use client';

import { useState } from 'react';
import type { HorseWithOdds } from '../types';

interface HorseCardProps {
  horse: HorseWithOdds;
  onBet: (horseId: number, amount: number) => Promise<void>;
  disabled?: boolean;
  isWinner?: boolean;
}

export function HorseCard({ horse, onBet, disabled, isWinner }: HorseCardProps) {
  const [amount, setAmount] = useState('0.1');
  const [betting, setBetting] = useState(false);

  const handleBet = async () => {
    const betAmount = parseFloat(amount);
    if (isNaN(betAmount) || betAmount <= 0) return;
    
    setBetting(true);
    try {
      await onBet(horse.id, betAmount);
    } finally {
      setBetting(false);
    }
  };

  const quickAmounts = [0.05, 0.1, 0.25, 0.5, 1];

  return (
    <div 
      className={`
        relative overflow-hidden rounded-2xl border-2 transition-all duration-300
        ${isWinner 
          ? 'border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.5)] scale-105' 
          : 'border-white/10 hover:border-white/20'
        }
        ${disabled ? 'opacity-60' : ''}
      `}
      style={{
        background: `linear-gradient(135deg, ${horse.color}15 0%, transparent 50%)`
      }}
    >
      {/* Winner badge */}
      {isWinner && (
        <div className="absolute top-0 right-0 bg-yellow-400 text-black px-4 py-1 text-xs font-bold uppercase tracking-wider rounded-bl-xl">
          Winner!
        </div>
      )}
      
      {/* Horse info */}
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span 
              className="text-5xl filter drop-shadow-lg"
              style={{ textShadow: `0 0 20px ${horse.color}` }}
            >
              {horse.emoji}
            </span>
            <div>
              <h3 
                className="text-xl font-black uppercase tracking-tight"
                style={{ color: horse.color }}
              >
                {horse.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-white/40 font-mono">
                  #{horse.id}
                </span>
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: horse.color }}
                />
              </div>
            </div>
          </div>
          
          {/* Odds display */}
          <div className="text-right">
            <div className="text-3xl font-black" style={{ color: horse.color }}>
              {horse.odds || '—'}x
            </div>
            <div className="text-xs text-white/40 uppercase tracking-wider">
              odds
            </div>
          </div>
        </div>
        
        {/* Pool info */}
        <div className="grid grid-cols-2 gap-4 mb-4 p-3 rounded-xl bg-black/30">
          <div>
            <div className="text-xs text-white/40 uppercase tracking-wider mb-1">
              Total Bets
            </div>
            <div className="font-mono text-lg">
              {horse.totalBets?.toFixed(3) || '0.000'} SOL
            </div>
          </div>
          <div>
            <div className="text-xs text-white/40 uppercase tracking-wider mb-1">
              Pool %
            </div>
            <div className="font-mono text-lg">
              {(horse as any).percentage || '0'}%
            </div>
          </div>
        </div>
        
        {/* Wallet address */}
        <div className="mb-4">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-1">
            Send SOL to bet:
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-black/50 border border-white/10">
            <code className="text-xs text-white/70 font-mono flex-1 truncate">
              {horse.wallet_address}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(horse.wallet_address)}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              title="Copy address"
            >
              <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Quick bet buttons */}
        {!disabled && (
          <div className="space-y-3">
            <div className="flex gap-2">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmount(amt.toString())}
                  className={`
                    flex-1 py-1.5 rounded-lg text-xs font-bold uppercase transition-all
                    ${amount === amt.toString()
                      ? 'bg-white/20 text-white'
                      : 'bg-white/5 text-white/50 hover:bg-white/10'
                    }
                  `}
                >
                  {amt}
                </button>
              ))}
            </div>
            
            <div className="flex gap-2">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0.001"
                step="0.01"
                className="flex-1 px-4 py-3 rounded-xl bg-black/50 border border-white/10 
                         text-white font-mono focus:outline-none focus:border-white/30
                         placeholder:text-white/30"
                placeholder="Amount in SOL"
              />
              <button
                onClick={handleBet}
                disabled={betting || disabled}
                className="px-6 py-3 rounded-xl font-black uppercase tracking-wider transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: `linear-gradient(135deg, ${horse.color} 0%, ${horse.color}99 100%)`,
                  boxShadow: `0 4px 20px ${horse.color}40`
                }}
              >
                {betting ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  'Bet'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}