// components/BetMarquee.tsx
'use client';

import { useEffect, useRef } from 'react';
import type { HorseWithOdds } from '../types';

interface Bet {
  id: string;
  bettor_wallet: string;
  amount: number;
  horse_id: number;
  created_at: string;
}

interface BetMarqueeProps {
  bets: Bet[];
  horses: HorseWithOdds[];
}

export function BetMarquee({ bets, horses }: BetMarqueeProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Format wallet address
  const formatWallet = (wallet: string) => {
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
  };

  // Format time ago
  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  // Get horse info
  const getHorse = (horseId: number) => {
    return horses.find(h => h.id === horseId);
  };

  // Duplicate bets for seamless loop
  const displayBets = bets.length > 0 
    ? [...bets, ...bets, ...bets] 
    : [];

  // If no bets, show placeholder
  if (bets.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-sm">No bets yet</p>
          <p className="text-gray-300 text-xs mt-1">Be the first to bet!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm h-full overflow-hidden relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-white via-white to-transparent pb-4 pt-3 px-4">
        <p className="text-xs text-gray-500 font-medium">Live Bets</p>
      </div>
      
      {/* Gradient overlays for smooth fade */}
      <div className="absolute top-12 left-0 right-0 h-8 bg-gradient-to-b from-white to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent z-10 pointer-events-none" />
      
      {/* Scrolling container */}
      <div 
        ref={scrollRef}
        className="flex gap-3 px-4 pt-12 pb-4 animate-marquee"
        style={{
          width: 'max-content',
        }}
      >
        {displayBets.map((bet, index) => {
          const horse = getHorse(bet.horse_id);
          if (!horse) return null;
          
          return (
            <div
              key={`${bet.id}-${index}`}
              className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-all hover:shadow-sm"
            >
              {/* Horse emoji */}
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                style={{ backgroundColor: `${horse.color}20` }}
              >
                {horse.emoji}
              </div>
              
              {/* Bet info */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 text-sm">
                    {bet.amount.toFixed(2)} SOL
                  </span>
                  <span className="text-gray-400 text-xs">on</span>
                  <span 
                    className="font-medium text-sm"
                    style={{ color: horse.color }}
                  >
                    {horse.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="font-mono">{formatWallet(bet.bettor_wallet)}</span>
                  <span>•</span>
                  <span>{timeAgo(bet.created_at)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-33.33%);
          }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}