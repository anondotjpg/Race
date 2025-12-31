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

  const RACE_DURATION = 8000; 

  const startRace = () => {
    // 1. CLEAR previous positions for the new race start
    setPositions(Object.fromEntries(horses.map(h => [h.id, 0])));
    
    setInternalRacing(true);
    raceTokenRef.current += 1;
    const token = raceTokenRef.current;
    startTimeRef.current = null;

    horseStatsRef.current = Object.fromEntries(
      horses.map((h) => {
        const rank = finalPositions?.indexOf(h.id) ?? 2; 
        return [
          h.id,
          {
            base: 0.85 + Math.random() * 0.1,
            kick: (4 - rank) * 1.5,
            freq: 80 + Math.random() * 100,
          },
        ];
      })
    );

    const animate = (time: number) => {
      if (token !== raceTokenRef.current) return;
      if (!startTimeRef.current) startTimeRef.current = time;
      
      const elapsed = time - startTimeRef.current;
      const t = Math.min(elapsed / RACE_DURATION, 1);

      let phase = t < 0.2 ? (t / 0.2) * 0.2 :
                  t < 0.7 ? 0.2 + ((t - 0.2) / 0.5) * 0.5 :
                  0.7 + ((t - 0.7) / 0.3) * 0.3;

      setPositions(() => {
        const next: Record<number, number> = {};
        horses.forEach(h => {
          const s = horseStatsRef.current[h.id];
          const rank = finalPositions?.indexOf(h.id) ?? 4;
          const finishOffset = (4 - rank) * 3; 
          const baseDistance = 78 + finishOffset; 
          
          const jitter = Math.sin(time / s.freq + h.id) * (t > 0.9 ? 0.1 : 0.7);
          let pos = phase * baseDistance * s.base + jitter;
          
          if (t >= 1) pos = 80 + finishOffset; // LOCK POSITION

          next[h.id] = Math.max(0, pos);
        });
        return next;
      });

      if (t < 1) {
        requestRef.current = requestAnimationFrame(animate);
      } else {
        setInternalRacing(false);
      }
    };

    requestRef.current = requestAnimationFrame(animate);
  };

  // Triggered ONLY when isRacing becomes true (New Race Start)
  useEffect(() => {
    if (isRacing) {
      startRace();
    }
  }, [isRacing]);

  return (
    <div className="relative bg-black p-2 border-4 border-[#555] font-mono shadow-[0_0_20px_rgba(0,0,0,0.4)]">
      <div className="bg-[#222] p-1 border-2 border-[#444]">
        <div className="relative bg-emerald-900 border-y-2 border-emerald-700 overflow-hidden h-64">
          <div className="absolute right-12 inset-y-0 w-4 z-10" 
               style={{ backgroundImage: 'repeating-conic-gradient(#000 0 25%, #fff 0 50%)', backgroundSize: '8px 8px' }} />

          {horses.map((horse, index) => {
            const isWinner = horse.id === winningHorseId && !internalRacing && !isRacing && (positions[horse.id] > 50);
            return (
              <div key={horse.id} className="relative h-12 border-b border-emerald-800/50 flex items-center">
                <div className="w-8 bg-black/80 text-[10px] text-[#1aff00] flex items-center justify-center border-r border-emerald-700 h-full z-20">
                  {index + 1}
                </div>
                <div className="flex-1 relative h-full">
                  <div
                    className="absolute top-1/2"
                    style={{
                      left: `${positions[horse.id] ?? 0}%`,
                      transform: 'translateY(-50%)',
                      // No transition during race; smooth slide ONLY if we manually reset
                      transition: internalRacing ? 'none' : 'left 1s ease-in-out'
                    }}
                  >
                    <div className="flex flex-col items-center">
                      <span className={`text-3xl ${internalRacing ? 'animate-gallop' : ''} ${isWinner ? 'drop-shadow-[0_0_10px_#fff]' : ''}`}>
                        🏇
                      </span>
                      <div className={`text-[9px] px-1 border mt-[-4px] whitespace-nowrap ${isWinner ? 'bg-[#1aff00] text-black border-white animate-pulse' : 'bg-black text-[#1aff00] border-[#1aff00]/30'}`}>
                        {horse.name} {isWinner ? '★ WINNER' : ''}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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