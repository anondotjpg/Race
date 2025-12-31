'use client';

import { useEffect, useRef, useState } from 'react';
import type { HorseWithOdds } from '../types';

interface RaceTrackProps {
  horses: HorseWithOdds[];
  isRacing: boolean;
  winningHorseId?: number;
  finalPositions?: number[];
  timeRemaining: number;
}

export function RaceTrack({
  horses,
  isRacing,
  winningHorseId,
  finalPositions,
  timeRemaining,
}: RaceTrackProps) {
  const [positions, setPositions] = useState<Record<number, number>>({});
  const [internalRacing, setInternalRacing] = useState(false);
  
  const requestRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const raceTokenRef = useRef(0);
  const horseStatsRef = useRef<Record<number, { base: number; kick: number; freq: number }>>({});

  const RACE_DURATION = 8000; // Fixed 8-second animation

  const startRace = () => {
    setInternalRacing(true);
    raceTokenRef.current += 1;
    const token = raceTokenRef.current;
    startTimeRef.current = null;

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

    const animate = (time: number) => {
      if (token !== raceTokenRef.current) return;

      if (!startTimeRef.current) startTimeRef.current = time;
      const elapsed = time - startTimeRef.current;
      const t = Math.min(elapsed / RACE_DURATION, 1);

      // Pacing Curve
      let phase = t < 0.15 ? (t / 0.15) * 0.25 :
                  t < 0.6 ? 0.25 + ((t - 0.15) / 0.45) * 0.4 :
                  t < 0.9 ? 0.65 + ((t - 0.6) / 0.3) * 0.25 : 
                  0.9 + ((t - 0.9) / 0.1) * 0.1;

      setPositions(() => {
        const next: Record<number, number> = {};
        horses.forEach(h => {
          const s = horseStatsRef.current[h.id];
          const rank = finalPositions?.indexOf(h.id) ?? 5;
          const finish = (5 - rank) * 2.5;
          const jitter = Math.sin(time / s.freq + h.id) * (t > 0.85 ? 0.3 : 0.8);

          let pos = phase * (82 + finish + s.kick * Math.max(0, t - 0.6)) * s.base + jitter;
          if (t >= 1) pos = 85 + finish; // Snap to finish line
          next[h.id] = Math.max(0, pos);
        });
        return next;
      });

      if (t < 1) {
        requestRef.current = requestAnimationFrame(animate);
      } else {
        setInternalRacing(false); // Only stop gallop animation at 8s
      }
    };

    requestRef.current = requestAnimationFrame(animate);
  };

  // Start animation when isRacing flips to true
  useEffect(() => {
    if (isRacing && !internalRacing) {
      startRace();
    }
  }, [isRacing]);

  // RESET positions only when betting phase starts (timeRemaining > 0)
  useEffect(() => {
    if (!isRacing && !internalRacing && timeRemaining > 0) {
      setPositions(Object.fromEntries(horses.map(h => [h.id, 0])));
    }
  }, [timeRemaining, isRacing, internalRacing]);

  return (
    <div className="relative bg-black p-2 border-4 border-[#555] font-mono shadow-[0_0_20px_rgba(0,0,0,0.5)]">
      <div className="bg-[#222] p-1 border-2 border-[#444]">
        <div className="relative bg-emerald-900 border-y-2 border-emerald-700 overflow-hidden h-64">
          <div className="absolute right-12 inset-y-0 w-4 z-10" style={{ backgroundImage: 'repeating-conic-gradient(#000 0 25%, #fff 0 50%)', backgroundSize: '8px 8px' }} />

          {horses.map((horse, index) => (
            <div key={horse.id} className="relative h-12 border-b border-emerald-800/50 flex items-center">
              <div className="w-6 bg-black text-[10px] text-[#1aff00] flex items-center justify-center border-r border-emerald-700 h-full z-20">{index + 1}</div>
              <div className="flex-1 relative h-full">
                <div
                  className="absolute top-1/2"
                  style={{
                    left: `${positions[horse.id] ?? 0}%`,
                    transform: 'translateY(-50%)',
                    transition: internalRacing ? 'none' : 'left 0.5s ease-out'
                  }}
                >
                  <div className="flex flex-col items-center">
                    <span className={`text-3xl ${internalRacing ? 'animate-gallop' : ''}`}>🏇</span>
                    <div className="bg-black text-[9px] text-[#1aff00] border border-[#1aff00]/30 px-1 mt-[-4px]">{horse.name}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <style jsx>{`
        @keyframes gallop {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-3px) rotate(-2deg); }
          75% { transform: translateY(-1px) rotate(2deg); }
        }
        .animate-gallop { animation: gallop 0.4s linear infinite; }
      `}</style>
    </div>
  );
}