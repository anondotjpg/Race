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

const RACE_DURATION = 10000; // 10 seconds

export function RaceTrack({ horses, isRacing, winningHorseId, finalPositions }: RaceTrackProps) {
  const [progress, setProgress] = useState<Record<number, number>>({});
  const [racePhase, setRacePhase] = useState<'idle' | 'racing' | 'finished'>('idle');
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const hasStartedRef = useRef(false);

  // Initialize horse positions
  useEffect(() => {
    const initial: Record<number, number> = {};
    horses.forEach(h => { initial[h.id] = 0; });
    setProgress(initial);
  }, [horses]);

  // Handle race start/stop
  useEffect(() => {
    // Race just started
    if (isRacing && !hasStartedRef.current) {
      hasStartedRef.current = true;
      startTimeRef.current = performance.now();
      setRacePhase('racing');
      
      // Reset positions
      const initial: Record<number, number> = {};
      horses.forEach(h => { initial[h.id] = 0; });
      setProgress(initial);
      
      // Start animation loop
      const animate = (currentTime: number) => {
        if (!startTimeRef.current) return;
        
        const elapsed = currentTime - startTimeRef.current;
        const raceProgress = Math.min(elapsed / RACE_DURATION, 1);
        
        const newProgress: Record<number, number> = {};
        
        horses.forEach((horse, index) => {
          // Base progress with easing
          let horseProgress = easeOutQuart(raceProgress);
          
          // Add unique variation per horse
          const seed = horse.id * 1000;
          const wobble = Math.sin(elapsed * 0.005 + seed) * 0.02;
          const micro = Math.sin(elapsed * 0.012 + seed * 2) * 0.01;
          
          horseProgress += wobble + micro;
          
          // In final 25%, converge to final positions
          if (finalPositions && finalPositions.length > 0 && raceProgress > 0.75) {
            const posIndex = finalPositions.indexOf(horse.id);
            const targetProgress = posIndex >= 0 
              ? 0.98 - (posIndex * 0.012) 
              : 0.85;
            const blend = easeInOutCubic((raceProgress - 0.75) / 0.25);
            horseProgress = horseProgress * (1 - blend) + targetProgress * blend;
          }
          
          // Clamp
          horseProgress = Math.max(0, Math.min(0.98, horseProgress));
          newProgress[horse.id] = horseProgress * 100;
        });
        
        setProgress(newProgress);
        
        if (raceProgress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setRacePhase('finished');
        }
      };
      
      animationRef.current = requestAnimationFrame(animate);
    }
    
    // Race ended
    if (!isRacing && hasStartedRef.current) {
      hasStartedRef.current = false;
      setRacePhase('finished');
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRacing, horses, finalPositions]);

  // Reset when no winner (new race)
  useEffect(() => {
    if (!winningHorseId && !isRacing) {
      setRacePhase('idle');
      const initial: Record<number, number> = {};
      horses.forEach(h => { initial[h.id] = 0; });
      setProgress(initial);
    }
  }, [winningHorseId, isRacing, horses]);

  // Sort horses by current progress
  const sortedByProgress = [...horses].sort((a, b) => 
    (progress[b.id] || 0) - (progress[a.id] || 0)
  );

  const showWinner = winningHorseId && racePhase === 'finished' && !isRacing;

  return (
    <div className="relative bg-gradient-to-b from-emerald-900 via-emerald-800 to-emerald-900 rounded-3xl overflow-hidden shadow-2xl">
      {/* Sky */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-transparent to-transparent" />
      
      {/* Header */}
      <div className="relative px-6 py-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏟️</span>
          <div>
            <h3 className="text-white font-semibold">Derby Track</h3>
            <p className="text-emerald-300/60 text-xs">
              {racePhase === 'racing' ? 'Race in progress...' : 
               racePhase === 'finished' ? 'Race complete' : 'Awaiting start'}
            </p>
          </div>
        </div>
        {racePhase === 'racing' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 rounded-full">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 text-xs font-medium uppercase tracking-wider">Live</span>
          </div>
        )}
      </div>
      
      {/* Track */}
      <div className="relative p-4">
        <div className="relative bg-gradient-to-b from-amber-800/40 to-amber-900/40 rounded-2xl overflow-hidden">
          {/* Track texture */}
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)`
          }} />
          
          {/* Distance markers */}
          <div className="absolute inset-0 flex">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex-1 border-r border-white/5 relative">
                <span className="absolute bottom-1 right-1 text-[10px] text-white/20 font-mono">
                  {(i + 1) * 200}m
                </span>
              </div>
            ))}
          </div>
          
          {/* Finish line */}
          <div className="absolute right-4 top-0 bottom-0 w-4 flex flex-col">
            {[...Array(20)].map((_, i) => (
              <div key={i} className={`flex-1 ${i % 2 === 0 ? 'bg-white' : 'bg-black'}`} />
            ))}
          </div>
          
          {/* Lanes */}
          <div className="relative py-3 space-y-1">
            {horses.map((horse, index) => {
              const horseProgress = progress[horse.id] || 0;
              const isWinner = winningHorseId === horse.id;
              const position = sortedByProgress.findIndex(h => h.id === horse.id) + 1;
              
              // Galloping animation
              const bobAmount = racePhase === 'racing' ? Math.sin(Date.now() * 0.02 + index) * 3 : 0;
              
              return (
                <div key={horse.id} className="relative h-14">
                  {/* Lane background */}
                  <div className={`absolute inset-0 rounded-lg transition-colors duration-500 ${
                    isWinner && showWinner ? 'bg-yellow-500/20' : 'bg-white/5'
                  }`} />
                  
                  {/* Lane divider */}
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-white/10" />
                  
                  {/* Lane number */}
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-white/60">{index + 1}</span>
                  </div>
                  
                  {/* Horse name */}
                  <div className="absolute left-10 top-1/2 -translate-y-1/2">
                    <span className="text-xs font-medium text-white/40">{horse.name}</span>
                  </div>
                  
                  {/* Position indicator during race */}
                  {racePhase === 'racing' && (
                    <div className="absolute right-10 top-1/2 -translate-y-1/2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        position === 1 ? 'bg-yellow-500/30 text-yellow-300' : 
                        position === 2 ? 'bg-gray-400/30 text-gray-300' :
                        position === 3 ? 'bg-amber-600/30 text-amber-400' :
                        'bg-white/10 text-white/40'
                      }`}>
                        {position === 1 ? '1st' : position === 2 ? '2nd' : position === 3 ? '3rd' : `${position}th`}
                      </span>
                    </div>
                  )}
                  
                  {/* Horse */}
                  <div 
                    className="absolute top-1/2"
                    style={{ 
                      left: `calc(${Math.min(horseProgress, 92)}% + 30px)`,
                      transform: `translateY(calc(-50% + ${bobAmount}px))`,
                      transition: racePhase === 'racing' ? 'none' : 'left 0.3s ease-out'
                    }}
                  >
                    {/* Shadow */}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-black/30 rounded-full blur-sm" />
                    
                    {/* Horse emoji */}
                    <div className={`text-3xl scale-x-[-1] ${isWinner && showWinner ? 'scale-110' : ''}`}>
                      🏇
                      {/* Dust when racing */}
                      {racePhase === 'racing' && horseProgress > 5 && (
                        <span className="absolute -right-3 top-1/2 -translate-y-1/2 text-xs opacity-40">💨</span>
                      )}
                      {/* Crown for winner */}
                      {isWinner && showWinner && (
                        <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-lg animate-bounce">👑</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Winner overlay */}
      {showWinner && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="text-center animate-fadeIn">
            <div className="text-6xl mb-4 animate-bounce">🏆</div>
            <p className="text-yellow-400 text-2xl font-bold mb-2">
              {horses.find(h => h.id === winningHorseId)?.name}
            </p>
            <p className="text-white/60 text-sm">wins the race!</p>
          </div>
        </div>
      )}
      
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

function easeOutQuart(x: number): number {
  return 1 - Math.pow(1 - x, 4);
}

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}