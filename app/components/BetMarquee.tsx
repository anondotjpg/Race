// components/BetMarquee.tsx
'use client';

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
  const formatWallet = (wallet: string) => 
    `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const getHorse = (horseId: number) => horses.find(h => h.id === horseId);

  if (bets.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm h-full flex items-center justify-center min-h-[88px]">
        <div className="text-center">
          <p className="text-gray-400 text-sm">No bets yet</p>
          <p className="text-gray-300 text-xs mt-1">Be the first to bet!</p>
        </div>
      </div>
    );
  }

  const BetCard = ({ bet }: { bet: Bet }) => {
    const horse = getHorse(bet.horse_id);
    if (!horse) return null;
    
    return (
      <div className="inline-flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 mr-3">
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
          style={{ backgroundColor: `${horse.color}20` }}
        >
          {horse.emoji}
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 text-sm whitespace-nowrap">
              {bet.amount.toFixed(2)} SOL
            </span>
            <span className="text-gray-400 text-xs">on</span>
            <span className="font-medium text-sm whitespace-nowrap" style={{ color: horse.color }}>
              {horse.name}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="font-mono">{formatWallet(bet.bettor_wallet)}</span>
            <span>•</span>
            <span className="whitespace-nowrap">{timeAgo(bet.created_at)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden relative min-h-[88px]">
      {/* Header */}
      <div className="absolute top-0 left-0 z-20 bg-white pt-3 pb-1 px-4">
        <p className="text-xs text-gray-500 font-medium flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Live Bets
        </p>
      </div>
      
      {/* Gradient fades */}
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
      
      {/* Marquee */}
      <div className="marquee-container pt-10 pb-4">
        <div className="marquee-content">
          {bets.map((bet, i) => <BetCard key={`a-${i}`} bet={bet} />)}
          {bets.map((bet, i) => <BetCard key={`b-${i}`} bet={bet} />)}
          {bets.map((bet, i) => <BetCard key={`c-${i}`} bet={bet} />)}
          {bets.map((bet, i) => <BetCard key={`d-${i}`} bet={bet} />)}
        </div>
      </div>
      
      <style jsx>{`
        .marquee-container {
          overflow: hidden;
          width: 100%;
        }
        .marquee-content {
          display: inline-flex;
          white-space: nowrap;
          animation: scroll 40s linear infinite;
        }
        .marquee-content:hover {
          animation-play-state: paused;
        }
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}