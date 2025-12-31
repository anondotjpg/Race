// components/BetMarquee.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  const formatWallet = (wallet: string) => 
    `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const getHorse = (horseId: number) => horses.find(h => h.id === horseId);

  // Measure widths
  useEffect(() => {
    if (containerRef.current && bets.length > 0) {
      setContainerWidth(containerRef.current.offsetWidth);
      const firstChild = containerRef.current.querySelector('.bet-card');
      if (firstChild) {
        const cardWidth = (firstChild as HTMLElement).offsetWidth + 12; // + gap
        setContentWidth(cardWidth * bets.length);
      }
    }
  }, [bets]);

  // Animation loop
  useEffect(() => {
    if (bets.length === 0 || contentWidth === 0) return;

    let animationId: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      if (!isPaused) {
        const delta = currentTime - lastTime;
        const speed = 50; // pixels per second
        const movement = (speed * delta) / 1000;
        
        setOffset(prev => {
          const newOffset = prev + movement;
          // Reset when one full set has scrolled
          if (newOffset >= contentWidth) {
            return newOffset - contentWidth;
          }
          return newOffset;
        });
      }
      lastTime = currentTime;
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [isPaused, contentWidth, bets.length]);

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

  // Calculate how many copies needed to fill screen + buffer
  const copies = Math.max(3, Math.ceil((containerWidth * 2) / (contentWidth || 1)) + 1);

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
      <div 
        className="pt-10 pb-4 overflow-hidden"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div 
          ref={containerRef}
          className="flex gap-3"
          style={{ 
            transform: `translateX(-${offset}px)`,
            width: 'max-content'
          }}
        >
          {Array.from({ length: copies }).map((_, copyIndex) => (
            bets.map((bet, betIndex) => (
              <BetCard key={`${copyIndex}-${betIndex}`} bet={bet} />
            ))
          )).flat()}
        </div>
      </div>
    </div>
  );
}