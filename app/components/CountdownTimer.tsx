'use client';

import { useEffect, useRef, useState } from 'react';

interface CountdownTimerProps {
  seconds: number;
  totalPool?: number;
}

export function CountdownTimer({ seconds, totalPool }: CountdownTimerProps) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const [displaySeconds, setDisplaySeconds] = useState(safeSeconds);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync from server
  useEffect(() => {
    setDisplaySeconds(safeSeconds);
  }, [safeSeconds]);

  // Local ticking
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setDisplaySeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const minutes = Math.floor(displaySeconds / 60);
  const secs = displaySeconds % 60;
  const isCritical = displaySeconds <= 30;

  return (
    /* Changed to h-full and flex flex-col */
    <div className="h-full bg-[#c0c0c0] p-1 border-2 border-t-[#dfdfdf] border-l-[#dfdfdf] border-b-[#404040] border-r-[#404040] font-mono flex flex-col">
      
      {/* Changed to flex-1 and h-full to fill available vertical space */}
      <div className="relative flex-1 bg-black border-2 border-t-[#404040] border-l-[#404040] border-b-[#dfdfdf] border-r-[#dfdfdf] overflow-hidden">

        {/* CRT Scanlines */}
        <div className="absolute inset-0 pointer-events-none opacity-10
          bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)]
          bg-[length:100%_2px]"
        />

        {/* Added h-full and justify-center to center content within the stretched box */}
        <div className="relative z-10 p-3 flex h-full items-center justify-between gap-8">
          {/* TIMER */}
          <div className="flex items-baseline leading-none uppercase">
            <span
              className={`
                text-4xl tabular-nums font-black
                ${isCritical ? 'text-yellow-400' : 'text-[#1aff00]'}
              `}
            >
              {String(minutes).padStart(2, '0')}
            </span>

            <span
              className={`
                text-2xl px-1 font-bold
                ${isCritical ? 'text-yellow-300' : 'text-[#1aff00]'}
              `}
            >
              :
            </span>

            <span
              className={`
                text-4xl tabular-nums font-black
                ${isCritical ? 'text-yellow-400' : 'text-[#1aff00]'}
              `}
            >
              {String(secs).padStart(2, '0')}
            </span>
          </div>

          {/* POOL */}
          {totalPool !== undefined && (
            <div className="text-right uppercase">
              <div className="text-[10px] text-gray-500 font-bold mb-1">
                TOTAL POOL
              </div>
              <div className="text-2xl text-yellow-500 font-black tabular-nums leading-none">
                {totalPool.toFixed(2)}
                <span className="text-xs ml-1 opacity-70">SOL</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Retro Status Bar - Fixed at bottom */}
      <div className="mt-1 flex justify-between text-[10px] text-[#404040] px-1 font-bold uppercase">
        <span>STATUS: {isCritical ? 'APPROACHING' : 'OPEN'}</span>
        <span>
          {new Date().toLocaleTimeString([], { hour12: false })}
        </span>
      </div>
    </div>
  );
}