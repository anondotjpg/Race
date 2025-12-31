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
  const [positions, setPositions] = useState<Record<number, number>>({});
  const [showWinner, setShowWinner] = useState(false);

  const requestRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const raceTokenRef = useRef(0);

  const horseStatsRef = useRef<
    Record<number, { base: number; kick: number; freq: number }>
  >({});

  const RACE_DURATION = 8000;

  const startRace = () => {
    raceTokenRef.current += 1;
    const token = raceTokenRef.current;

    startTimeRef.current = null;
    setShowWinner(false);

    // Generate per-race stats (locked)
    horseStatsRef.current = Object.fromEntries(
      horses.map((h, i) => {
        const rank = finalPositions?.indexOf(h.id) ?? i;
        return [
          h.id,
          {
            base: 0.9 + Math.random() * 0.2,
            kick: (5 - rank) * (0.9 + Math.random() * 0.3),
            freq: 90 + Math.random() * 120,
          },
        ];
      })
    );

    setPositions(Object.fromEntries(horses.map(h => [h.id, 0])));

    const animate = (time: number) => {
      if (token !== raceTokenRef.current) return;

      if (!startTimeRef.current) startTimeRef.current = time;
      const elapsed = time - startTimeRef.current;
      const t = Math.min(elapsed / RACE_DURATION, 1);

      // Race pacing curve
      let phase = 0;
      if (t < 0.15) phase = (t / 0.15) * 0.25;
      else if (t < 0.6) phase = 0.25 + ((t - 0.15) / 0.45) * 0.4;
      else if (t < 0.9) phase = 0.65 + ((t - 0.6) / 0.3) * 0.25;
      else phase = 0.9 + ((t - 0.9) / 0.1) * 0.1;

      setPositions(() => {
        const next: Record<number, number> = {};

        horses.forEach(h => {
          const s = horseStatsRef.current[h.id];
          const rank = finalPositions?.indexOf(h.id) ?? 5;
          const finish = (5 - rank) * 2.5;

          const jitter =
            Math.sin(time / s.freq + h.id) * (t > 0.85 ? 0.3 : 0.8);

          let pos =
            phase * (82 + finish + s.kick * Math.max(0, t - 0.6)) * s.base +
            jitter;

          if (t >= 1) pos = 85 + finish;

          next[h.id] = Math.max(0, pos);
        });

        return next;
      });

      if (t < 1) {
        requestRef.current = requestAnimationFrame(animate);
      } else {
        setTimeout(() => {
          if (token === raceTokenRef.current) {
            setShowWinner(true);
          }
        }, 600);
      }
    };

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (isRacing) {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      startRace();
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);

      if (!winningHorseId) {
        setPositions(Object.fromEntries(horses.map(h => [h.id, 0])));
        setShowWinner(false);
      }
    }

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isRacing]);

  return (
    <div className="relative bg-black p-2 border-4 border-[#555] font-mono uppercase tracking-tighter">
      {/* CRT scanlines */}
      <div className="absolute inset-0 pointer-events-none z-50 opacity-10 bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[length:100%_4px]" />

      {/* Track */}
      <div className="bg-[#222] p-1 border-2 border-[#444]">
        <div className="relative bg-emerald-800 border-y-2 border-emerald-600">
          {/* Finish line */}
          <div
            className="absolute right-12 inset-y-0 w-4 z-10"
            style={{
              backgroundImage:
                'repeating-conic-gradient(#000 0 25%, #fff 0 50%)',
              backgroundSize: '8px 8px',
            }}
          />

          {horses.map((horse, index) => (
            <div
              key={horse.id}
              className="relative h-15 border-b border-emerald-700/50 flex items-center"
            >
              <div className="w-4 bg-black/40 text-[10px] text-yellow-500 flex items-center justify-center border-r border-emerald-600">
                {index + 1}
              </div>

              <div className="flex-1 relative h-full">
                <div
                  className="absolute top-1/2"
                  style={{
                    left: `${positions[horse.id] ?? 0}%`,
                    transform: 'translateY(-50%)',
                  }}
                >
                  <div className="flex flex-col items-center">
                    <span className="text-2xl animate-[gallop_0.5s_linear_infinite]">
                      🏇
                    </span>
                    <div className="bg-black/80 px-1 text-[8px] text-white border border-white/20">
                      {horse.name.substring(0, 16)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Winner overlay */}
      {showWinner && winningHorseId && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/80">
          <div className="border-4 border-double border-yellow-500 bg-blue-900 p-6 text-center">
            <h2 className="text-yellow-400 text-2xl font-black italic animate-bounce">
              WINNER!
            </h2>
            <div className="text-white text-xl mt-2">
              {horses.find(h => h.id === winningHorseId)?.name}
            </div>
          </div>
        </div>
      )}

      {/* Gallop animation */}
      <style jsx>{`
        @keyframes gallop {
          0% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-2px);
          }
          100% {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}