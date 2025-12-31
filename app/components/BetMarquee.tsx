// components/BetMarquee.tsx
'use client';

import { useEffect, useRef, useCallback } from 'react';
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
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const isPausedRef = useRef(false);
  const contentWidthRef = useRef(0);
  const animationRef = useRef<number | null>(null); // ✅ FIX

  const formatWallet = (wallet: string) =>
    `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const getHorse = useCallback(
    (horseId: number) => horses.find(h => h.id === horseId),
    [horses]
  );

  useEffect(() => {
    const track = trackRef.current;
    if (!track || bets.length === 0) return;

    const measureContent = () => {
      const cards = track.querySelectorAll('.bet-card');
      const numCards = cards.length / 2;
      if (numCards > 0 && cards[0]) {
        const cardWidth =
          (cards[0] as HTMLElement).offsetWidth + 12;
        contentWidthRef.current = cardWidth * numCards;
      }
    };

    requestAnimationFrame(measureContent);

    let lastTime = performance.now();
    const speed = 50;

    const animate = (currentTime: number) => {
      if (!isPausedRef.current && contentWidthRef.current > 0) {
        const delta = currentTime - lastTime;
        offsetRef.current += (speed * delta) / 1000;

        if (offsetRef.current >= contentWidthRef.current) {
          offsetRef.current -= contentWidthRef.current;
        }

        track.style.transform = `translate3d(-${offsetRef.current}px, 0, 0)`;
      }

      lastTime = currentTime;
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [bets.length]);

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
      <div className="bet-card flex-shrink-0 inline-flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
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
            <span
              className="font-medium text-sm whitespace-nowrap"
              style={{ color: horse.color }}
            >
              {horse.name}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="font-mono">
              {formatWallet(bet.bettor_wallet)}
            </span>
            <span>•</span>
            <span className="whitespace-nowrap">
              {timeAgo(bet.created_at)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden relative min-h-[88px]">
      <div className="absolute top-0 left-0 z-20 bg-white pt-3 pb-1 px-4">
        <p className="text-xs text-gray-500 font-medium flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Live Bets
        </p>
      </div>

      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

      <div
        className="pt-10 pb-4 overflow-hidden"
        onMouseEnter={() => {
          isPausedRef.current = true;
        }}
        onMouseLeave={() => {
          isPausedRef.current = false;
        }}
      >
        <div
          ref={trackRef}
          className="flex gap-3 will-change-transform"
          style={{ width: 'max-content' }}
        >
          {bets.map((bet, i) => (
            <BetCard key={`a-${bet.id}-${i}`} bet={bet} />
          ))}
          {bets.map((bet, i) => (
            <BetCard key={`b-${bet.id}-${i}`} bet={bet} />
          ))}
        </div>
      </div>
    </div>
  );
}
