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
  const [progress, setProgress] = useState<Record<number, number>>({});
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  
  const RACE_DURATION = 8000; // 8 seconds race

  useEffect(() => {
    // Initialize progress
    const initial: Record<number, number> = {};
    horses.forEach(h => { initial[h.id] = 0; });
    setProgress(initial);
  }, [horses]);

  useEffect(() => {
    if (!isRacing) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    startTimeRef.current = performance.now();
    
    const animate = (currentTime: number) => {
      if (!startTimeRef.current) return;
      
      const elapsed = currentTime - startTimeRef.current;
      const raceProgress = Math.min(elapsed / RACE_DURATION, 1);
      
      // Calculate each horse's progress with randomness
      const newProgress: Record<number, number> = {};
      
      horses.forEach((horse, index) => {
        // Base progress follows an easing curve
        let baseProgress = easeOutQuart(raceProgress);
        
        // Add some randomness during the race
        if (raceProgress < 0.95) {
          const noise = Math.sin(elapsed * 0.003 + index * 2) * 0.05;
          const extraNoise = Math.random() * 0.02;
          baseProgress = Math.max(0, Math.min(1, baseProgress + noise + extraNoise));
        }
        
        // If we have final positions, converge to them at the end
        if (finalPositions && raceProgress > 0.8) {
          const targetPosition = finalPositions.indexOf(horse.id);
          const targetProgress = 1 - (targetPosition * 0.03); // Winner at 100%, 2nd at 97%, etc.
          const convergence = (raceProgress - 0.8) / 0.2; // 0 to 1 in last 20%
          baseProgress = baseProgress * (1 - convergence) + targetProgress * convergence;
        }
        
        // Winner always finishes first
        if (winningHorseId && horse.id === winningHorseId && raceProgress > 0.9) {
          baseProgress = Math.max(baseProgress, raceProgress);
        }
        
        newProgress[horse.id] = baseProgress * 100;
      });
      
      setProgress(newProgress);
      
      if (raceProgress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRacing, horses, winningHorseId, finalPositions]);

  return (
    <div className="relative w-full rounded-3xl overflow-hidden bg-gradient-to-b from-emerald-950 to-emerald-900 border-4 border-emerald-800">
      {/* Track header */}
      <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-black/50 to-transparent z-10 flex items-center justify-between px-6">
        <span className="text-emerald-400 font-bold uppercase tracking-widest text-sm">
          {isRacing ? '🏇 Race in Progress!' : 'Track Ready'}
        </span>
        {isRacing && (
          <span className="text-yellow-400 animate-pulse font-bold">
            LIVE
          </span>
        )}
      </div>
      
      {/* Finish line */}
      <div className="absolute right-8 top-0 bottom-0 w-1 bg-gradient-to-b from-white via-red-500 to-white opacity-50" />
      <div className="absolute right-12 top-0 bottom-0 w-8">
        {[...Array(20)].map((_, i) => (
          <div 
            key={i} 
            className={`h-[5%] ${i % 2 === 0 ? 'bg-white/30' : 'bg-black/30'}`}
          />
        ))}
      </div>
      
      {/* Track lanes */}
      <div className="pt-12 pb-4 px-4 space-y-2">
        {horses.map((horse, index) => (
          <div key={horse.id} className="relative">
            {/* Lane */}
            <div 
              className="h-16 rounded-xl relative overflow-hidden"
              style={{
                background: `linear-gradient(90deg, ${horse.color}20 0%, ${horse.color}05 100%)`,
                borderTop: `1px solid ${horse.color}30`,
                borderBottom: `1px solid ${horse.color}30`
              }}
            >
              {/* Lane number */}
              <div 
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ 
                  backgroundColor: horse.color,
                  color: getContrastColor(horse.color)
                }}
              >
                {index + 1}
              </div>
              
              {/* Track markings */}
              <div className="absolute inset-0 opacity-10">
                {[...Array(20)].map((_, i) => (
                  <div 
                    key={i}
                    className="absolute top-1/2 w-px h-4 -translate-y-1/2 bg-white"
                    style={{ left: `${(i + 1) * 5}%` }}
                  />
                ))}
              </div>
              
              {/* Horse */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 transition-all duration-100 ease-linear"
                style={{ 
                  left: `calc(${Math.min(progress[horse.id] || 0, 90)}% + 40px)`,
                }}
              >
                <div 
                  className={`
                    relative text-4xl transform -scale-x-100
                    ${isRacing ? 'animate-bounce' : ''}
                    ${winningHorseId === horse.id ? 'scale-110' : ''}
                  `}
                  style={{
                    filter: `drop-shadow(0 0 10px ${horse.color})`,
                    animationDuration: '0.15s'
                  }}
                >
                  🏇
                  {/* Dust trail when racing */}
                  {isRacing && (
                    <div className="absolute -right-8 top-1/2 -translate-y-1/2 flex gap-1 opacity-50">
                      <span className="text-xl animate-ping">💨</span>
                    </div>
                  )}
                </div>
                
                {/* Horse name tag */}
                <div 
                  className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-bold px-2 py-0.5 rounded"
                  style={{ 
                    backgroundColor: horse.color,
                    color: getContrastColor(horse.color)
                  }}
                >
                  {horse.emoji} {horse.name.split(' ')[0]}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Winner celebration overlay */}
      {winningHorseId && !isRacing && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20 animate-fadeIn">
          <div className="text-center">
            <div className="text-8xl mb-4 animate-bounce">🏆</div>
            <div className="text-4xl font-black text-yellow-400 uppercase tracking-wider mb-2">
              Winner!
            </div>
            <div className="text-2xl text-white font-bold">
              {horses.find(h => h.id === winningHorseId)?.emoji}{' '}
              {horses.find(h => h.id === winningHorseId)?.name}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Easing function for smoother animation
function easeOutQuart(x: number): number {
  return 1 - Math.pow(1 - x, 4);
}

// Get contrasting text color for background
function getContrastColor(hexColor: string): string {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}