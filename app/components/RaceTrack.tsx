// components/RaceTrack.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import type { HorseWithOdds } from '../types';

interface RaceTrackProps {
  horses: HorseWithOdds[];
  isRacing: boolean;
  winningHorseId?: number;
  finalPositions?: number[];
}

export function RaceTrack({ horses, isRacing, winningHorseId, finalPositions }: RaceTrackProps) {
  const [raceStarted, setRaceStarted] = useState(false);
  const [showWinner, setShowWinner] = useState(false);

  // Start race animation when isRacing becomes true
  useEffect(() => {
    if (isRacing && !raceStarted) {
      setRaceStarted(true);
      setShowWinner(false);
    }
  }, [isRacing, raceStarted]);

  // Show winner after race ends
  useEffect(() => {
    if (!isRacing && raceStarted && winningHorseId) {
      // Small delay before showing winner
      const timer = setTimeout(() => {
        setShowWinner(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isRacing, raceStarted, winningHorseId]);

  // Reset when new race starts (no winner, not racing)
  useEffect(() => {
    if (!isRacing && !winningHorseId) {
      setRaceStarted(false);
      setShowWinner(false);
    }
  }, [isRacing, winningHorseId]);

  // Get final position for a horse (0 = winner, 1 = second, etc)
  const getFinalPosition = (horseId: number): number => {
    if (!finalPositions) return 0;
    const pos = finalPositions.indexOf(horseId);
    return pos >= 0 ? pos : horses.length - 1;
  };

  return (
    <div className="relative bg-gradient-to-b from-emerald-900 via-emerald-800 to-emerald-900 rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏇</span>
          <span className="text-white font-medium">Race Track</span>
        </div>
        {isRacing && (
          <div className="flex items-center gap-2 px-2 py-1 bg-red-500/20 rounded-full">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 text-xs font-medium">LIVE</span>
          </div>
        )}
      </div>
      
      {/* Track */}
      <div className="p-4">
        <div className="relative bg-amber-900/30 rounded-xl overflow-hidden">
          {/* Finish line */}
          <div className="absolute right-6 top-0 bottom-0 w-3 flex flex-col">
            {[...Array(16)].map((_, i) => (
              <div key={i} className={`flex-1 ${i % 2 === 0 ? 'bg-white' : 'bg-black'}`} />
            ))}
          </div>
          
          {/* Lanes */}
          <div className="py-2">
            {horses.map((horse, index) => {
              const isWinner = winningHorseId === horse.id;
              const finishPos = getFinalPosition(horse.id);
              
              // Calculate end position (winner at 90%, others slightly behind)
              const endPosition = raceStarted ? 90 - (finishPos * 3) : 0;
              
              return (
                <div key={horse.id} className="relative h-12 flex items-center border-b border-white/5 last:border-0">
                  {/* Lane number */}
                  <div className="w-8 flex-shrink-0 text-center">
                    <span className="text-xs text-white/40">{index + 1}</span>
                  </div>
                  
                  {/* Track lane */}
                  <div className="flex-1 relative h-full">
                    {/* Horse */}
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 transition-all ease-out"
                      style={{ 
                        left: `${endPosition}%`,
                        transitionDuration: raceStarted ? '10s' : '0.3s',
                        transitionTimingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                      }}
                    >
                      <span className={`text-2xl ${raceStarted && isRacing ? 'animate-bounce' : ''}`} 
                            style={{ animationDuration: '0.3s' }}>
                        🏇
                      </span>
                      {isWinner && showWinner && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-sm">👑</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Horse name */}
                  <div className="w-24 flex-shrink-0 text-right pr-8">
                    <span className="text-xs text-white/50">{horse.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Winner overlay */}
      {showWinner && winningHorseId && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl mb-3">🏆</div>
            <p className="text-yellow-400 text-xl font-bold">
              {horses.find(h => h.id === winningHorseId)?.name}
            </p>
            <p className="text-white/60 text-sm mt-1">Winner!</p>
          </div>
        </div>
      )}
    </div>
  );
}