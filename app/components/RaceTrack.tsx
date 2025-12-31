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
  const [bobOffset, setBobOffset] = useState<Record<number, number>>({});
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  
  const RACE_DURATION = 10000;

  useEffect(() => {
    const initial: Record<number, number> = {};
    const initialBob: Record<number, number> = {};
    horses.forEach(h => { 
      initial[h.id] = 0;
      initialBob[h.id] = 0;
    });
    setProgress(initial);
    setBobOffset(initialBob);
  }, [horses]);

  useEffect(() => {
    if (!isRacing) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      // Reset to start if not racing and no winner
      if (!winningHorseId) {
        const initial: Record<number, number> = {};
        horses.forEach(h => { initial[h.id] = 0; });
        setProgress(initial);
      }
      return;
    }

    startTimeRef.current = performance.now();
    
    const animate = (currentTime: number) => {
      if (!startTimeRef.current) return;
      
      const elapsed = currentTime - startTimeRef.current;
      const raceProgress = Math.min(elapsed / RACE_DURATION, 1);
      
      const newProgress: Record<number, number> = {};
      const newBob: Record<number, number> = {};
      
      horses.forEach((horse, index) => {
        // Smooth easing with individual variation
        const baseEase = easeOutQuart(raceProgress);
        
        // Each horse has unique "personality" in their run
        const seed = horse.id * 1000;
        const variation = Math.sin(elapsed * 0.004 + seed) * 0.03;
        const microVariation = Math.sin(elapsed * 0.01 + seed * 2) * 0.01;
        
        let horseProgress = baseEase + variation + microVariation;
        
        // Clamp progress
        horseProgress = Math.max(0, Math.min(0.98, horseProgress));
        
        // Final stretch - converge to final positions
        if (finalPositions && raceProgress > 0.75) {
          const targetPosition = finalPositions.indexOf(horse.id);
          const targetProgress = 0.98 - (targetPosition * 0.015);
          const convergence = easeInOutCubic((raceProgress - 0.75) / 0.25);
          horseProgress = horseProgress * (1 - convergence) + targetProgress * convergence;
        }
        
        // Winner surge at the end
        if (winningHorseId && horse.id === winningHorseId && raceProgress > 0.85) {
          horseProgress = Math.max(horseProgress, 0.98);
        }
        
        newProgress[horse.id] = horseProgress * 100;
        
        // Galloping bob animation
        const gallop = Math.sin(elapsed * 0.025 + index) * 3;
        newBob[horse.id] = isRacing ? gallop : 0;
      });
      
      setProgress(newProgress);
      setBobOffset(newBob);
      
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

  // Sort horses by progress for display order during race
  const sortedHorses = [...horses].sort((a, b) => 
    (progress[b.id] || 0) - (progress[a.id] || 0)
  );

  return (
    <div className="relative bg-gradient-to-b from-emerald-900 via-emerald-800 to-emerald-900 rounded-3xl overflow-hidden shadow-2xl">
      {/* Sky gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-transparent to-transparent" />
      
      {/* Header */}
      <div className="relative px-6 py-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏟️</span>
          <div>
            <h3 className="text-white font-semibold">Derby Track</h3>
            <p className="text-emerald-300/60 text-xs">
              {isRacing ? 'Race in progress...' : winningHorseId ? 'Race complete' : 'Awaiting start'}
            </p>
          </div>
        </div>
        {isRacing && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 rounded-full">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 text-xs font-medium uppercase tracking-wider">Live</span>
          </div>
        )}
      </div>
      
      {/* Track */}
      <div className="relative p-4">
        {/* Track surface with lanes */}
        <div className="relative bg-gradient-to-b from-amber-800/40 to-amber-900/40 rounded-2xl overflow-hidden">
          {/* Track texture */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0" style={{
              backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)`
            }} />
          </div>
          
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
          <div className="absolute right-8 top-0 bottom-0 w-px bg-white/30" />
          
          {/* Lanes */}
          <div className="relative py-3 space-y-1">
            {horses.map((horse, index) => {
              const horseProgress = progress[horse.id] || 0;
              const bob = bobOffset[horse.id] || 0;
              const isWinner = winningHorseId === horse.id;
              const position = sortedHorses.findIndex(h => h.id === horse.id) + 1;
              
              return (
                <div 
                  key={horse.id} 
                  className="relative h-14 group"
                >
                  {/* Lane background */}
                  <div className={`
                    absolute inset-0 rounded-lg transition-all duration-300
                    ${isWinner && !isRacing ? 'bg-yellow-500/20' : 'bg-white/5'}
                  `} />
                  
                  {/* Lane divider */}
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-white/10" />
                  
                  {/* Lane number */}
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-white/60">{index + 1}</span>
                  </div>
                  
                  {/* Horse name (left side) */}
                  <div className="absolute left-10 top-1/2 -translate-y-1/2">
                    <span className="text-xs font-medium text-white/40">{horse.name}</span>
                  </div>
                  
                  {/* Position indicator */}
                  {isRacing && (
                    <div className="absolute right-10 top-1/2 -translate-y-1/2">
                      <span className={`
                        text-xs font-bold px-2 py-0.5 rounded-full
                        ${position === 1 ? 'bg-yellow-500/30 text-yellow-300' : 
                          position === 2 ? 'bg-gray-400/30 text-gray-300' :
                          position === 3 ? 'bg-amber-600/30 text-amber-400' :
                          'bg-white/10 text-white/40'}
                      `}>
                        {position === 1 ? '1st' : position === 2 ? '2nd' : position === 3 ? '3rd' : `${position}th`}
                      </span>
                    </div>
                  )}
                  
                  {/* Horse + Jockey */}
                  <div 
                    className="absolute top-1/2 transition-all ease-out"
                    style={{ 
                      left: `calc(${Math.min(horseProgress, 92)}% + 30px)`,
                      transform: `translateY(calc(-50% + ${bob}px))`,
                      transitionDuration: isRacing ? '50ms' : '300ms'
                    }}
                  >
                    {/* Shadow */}
                    <div 
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-black/30 rounded-full blur-sm"
                      style={{ transform: `translateX(-50%) scaleY(${0.5 + Math.abs(bob) * 0.05})` }}
                    />
                    
                    {/* Horse emoji with effects */}
                    <div className={`
                      relative text-3xl transition-transform
                      ${isRacing ? 'scale-x-[-1]' : 'scale-x-[-1]'}
                      ${isWinner && !isRacing ? 'scale-110' : ''}
                    `}>
                      🏇
                      
                      {/* Dust particles when racing */}
                      {isRacing && horseProgress > 5 && (
                        <div className="absolute -right-4 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-40">
                          <span className="text-xs animate-ping" style={{ animationDuration: '0.5s' }}>💨</span>
                        </div>
                      )}
                      
                      {/* Winner crown */}
                      {isWinner && !isRacing && (
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
      
      {/* Winner announcement overlay */}
      {winningHorseId && !isRacing && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fadeIn">
          <div className="text-center">
            <div className="text-6xl mb-4 animate-bounce">🏆</div>
            <p className="text-yellow-400 text-2xl font-bold mb-2">
              {horses.find(h => h.id === winningHorseId)?.name}
            </p>
            <p className="text-white/60 text-sm">wins the race!</p>
          </div>
        </div>
      )}
      
      {/* CSS for animations */}
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 20s linear infinite;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
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