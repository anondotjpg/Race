'use client';

import { useEffect, useRef, useState } from 'react';
import type { HorseWithOdds } from '../types';

interface RaceTrackProps {
  horses: HorseWithOdds[];
  isRacing: boolean;
  winningHorseId?: number;
  finalPositions?: number[];
}

export function RaceTrack({
  horses,
  isRacing,
  winningHorseId,
  finalPositions,
}: RaceTrackProps) {
  const [raceStarted, setRaceStarted] = useState(false);
  const [showWinner, setShowWinner] = useState(false);
  const lastWinnerRef = useRef<number | null>(null);

  // Start race animation ONCE per race
  useEffect(() => {
    if (isRacing && !raceStarted) {
      setRaceStarted(true);
      setShowWinner(false);
    }
  }, [isRacing, raceStarted]);

  // Show winner ONCE after race finishes
  useEffect(() => {
    if (
      !isRacing &&
      raceStarted &&
      winningHorseId &&
      lastWinnerRef.current !== winningHorseId
    ) {
      lastWinnerRef.current = winningHorseId;
      const t = setTimeout(() => setShowWinner(true), 600);
      return () => clearTimeout(t);
    }
  }, [isRacing, raceStarted, winningHorseId]);

  // Reset when NEW race appears
  useEffect(() => {
    if (!isRacing && !winningHorseId) {
      setRaceStarted(false);
      setShowWinner(false);
      lastWinnerRef.current = null;
    }
  }, [isRacing, winningHorseId]);

  const getFinalPosition = (horseId: number) => {
    if (!finalPositions?.length) return 0;
    const i = finalPositions.indexOf(horseId);
    return i === -1 ? finalPositions.length - 1 : i;
  };

  return (
    <div className="relative bg-gradient-to-b from-emerald-900 via-emerald-800 to-emerald-900 rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="px-4 py-3 flex justify-between items-center border-b border-white/10">
        <div className="flex items-center gap-2 text-white">
          <span className="text-xl">🏇</span>
          <span className="font-medium">Race Track</span>
        </div>

        {isRacing && (
          <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-red-500/20">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-red-400">LIVE</span>
          </div>
        )}
      </div>

      {/* Track */}
      <div className="p-4">
        <div className="relative bg-amber-900/30 rounded-xl overflow-hidden">
          {/* Finish line */}
          <div className="absolute right-6 inset-y-0 w-3 flex flex-col">
            {Array.from({ length: 16 }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 ${i % 2 ? 'bg-black' : 'bg-white'}`}
              />
            ))}
          </div>

          {/* Lanes */}
          <div className="py-2">
            {horses.map((horse, index) => {
              const isWinner = horse.id === winningHorseId;
              const pos = getFinalPosition(horse.id);
              const end = raceStarted ? 90 - pos * 3 : 0;

              return (
                <div
                  key={horse.id}
                  className="relative h-12 flex items-center border-b border-white/5 last:border-none"
                >
                  <div className="w-8 text-center text-xs text-white/40">
                    {index + 1}
                  </div>

                  <div className="relative flex-1 h-full">
                    <div
                      className="absolute top-1/2 -translate-y-1/2 will-change-transform"
                      style={{
                        left: `${end}%`,
                        transitionProperty: 'left',
                        transitionDuration: raceStarted ? '10s' : '0.25s',
                        transitionTimingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                      }}
                    >
                      <span
                        className={`text-2xl ${isRacing ? 'animate-bounce' : ''}`}
                        style={{ animationDuration: '0.35s' }}
                      >
                        🏇
                      </span>

                      {isWinner && showWinner && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2">
                          👑
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="w-24 pr-8 text-right text-xs text-white/50">
                    {horse.name}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Winner overlay */}
      {showWinner && winningHorseId && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20">
          <div className="text-center">
            <div className="text-5xl mb-3">🏆</div>
            <p className="text-xl font-bold text-yellow-400">
              {horses.find(h => h.id === winningHorseId)?.name}
            </p>
            <p className="text-sm text-white/60 mt-1">Winner!</p>
          </div>
        </div>
      )}
    </div>
  );
}