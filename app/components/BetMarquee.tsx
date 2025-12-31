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
  const animationRef = useRef<number | null>(null);

  const formatWallet = (wallet: string) =>
    `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'JUST NOW';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}M AGO`;
    return `${Math.floor(seconds / 3600)}H AGO`;
  };

  const getHorse = useCallback(
    (horseId: number) => horses.find(h => h.id === horseId),
    [horses]
  );

  useEffect(() => {
    const track = trackRef.current;
    if (!track || bets.length === 0) return;

    const measure = () => {
      const cards = track.querySelectorAll('.bet-card');
      const numCards = cards.length / 4;
      if (cards[0]) {
        const cardWidth =
          (cards[0] as HTMLElement).offsetWidth + 12;
        contentWidthRef.current = cardWidth * numCards;
      }
    };

    requestAnimationFrame(measure);

    let lastTime = performance.now();
    const speed = 40;

    const animate = (now: number) => {
      if (!isPausedRef.current && contentWidthRef.current > 0) {
        const delta = now - lastTime;
        offsetRef.current += (speed * delta) / 1000;

        if (offsetRef.current >= contentWidthRef.current) {
          offsetRef.current -= contentWidthRef.current;
        }

        track.style.transform = `translate3d(-${offsetRef.current}px,0,0)`;
      }

      lastTime = now;
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [bets.length]);

  const BetCard = ({ bet }: { bet: Bet }) => {
    const horse = getHorse(bet.horse_id);
    if (!horse) return null;

    return (
      <div
        className="
          bet-card flex-shrink-0
          border-2 border-[#333]
          bg-black px-4 py-3
          flex items-center gap-3
          font-mono uppercase
        "
      >
        <div
          className="w-10 h-10 border-2 border-[#333] flex items-center justify-center text-lg"
          style={{ color: horse.color }}
        >
          {horse.emoji}
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-yellow-400 tabular-nums">
              {bet.amount.toFixed(2)} SOL
            </span>
            <span className="text-[#7CFF7C]">ON</span>
            <span
              className="text-[#1aff00] whitespace-nowrap"
            >
              {horse.name}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-[#7CFF7C] opacity-70">
            <span className="font-mono">
              {formatWallet(bet.bettor_wallet)}
            </span>
            <span>•</span>
            <span>{timeAgo(bet.created_at)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="
        relative bg-black border-4 border-[#555]
        font-mono uppercase tracking-tight
        overflow-hidden h-[126px]
      "
    >
      {/* CRT scanlines */}
      <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[length:100%_4px]" />

      {/* HEADER */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-black px-4 py-2 border-b-2 border-[#333]">
        <div className="flex items-center gap-2 text-[10px] text-[#7CFF7C]">
          <span
            className={`w-2 h-2 rounded-full ${
              bets.length > 0
                ? 'bg-red-500 animate-pulse'
                : 'bg-[#333]'
            }`}
          />
          LIVE BET FEED
        </div>
      </div>

      {bets.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full pt-6 text-[#7CFF7C]">
          <div className="text-sm">NO BETS YET</div>
          <div className="text-[10px] opacity-70">
            PLACE THE FIRST BET
          </div>
        </div>
      ) : (
        <>
          {/* Edge fade */}
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />

          <div
            className="pt-10 pb-3 overflow-hidden"
            onMouseEnter={() => (isPausedRef.current = true)}
            onMouseLeave={() => (isPausedRef.current = false)}
          >
            <div
              ref={trackRef}
              className="flex gap-3 will-change-transform"
              style={{ width: 'max-content' }}
            >
              {[...Array(6)].map((_, groupIdx) =>
                bets.map((bet, i) => (
                  <BetCard
                    key={`${groupIdx}-${bet.id}-${i}`}
                    bet={bet}
                  />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}