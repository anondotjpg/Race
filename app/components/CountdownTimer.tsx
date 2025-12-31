'use client';

import { useEffect, useRef, useState } from 'react';

interface CountdownTimerProps {
  seconds: number;
  totalPool?: number;
  onRaceEnd?: () => void;
}

export function CountdownTimer({ seconds, totalPool, onRaceEnd }: CountdownTimerProps) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const [displaySeconds, setDisplaySeconds] = useState(safeSeconds);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const triggeredRef = useRef(false);

  // Sync from server
  useEffect(() => {
    setDisplaySeconds(safeSeconds);
    if (safeSeconds > 10) {
      triggeredRef.current = false;
    }
  }, [safeSeconds]);

  // Local ticking
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setDisplaySeconds(prev => {
        const next = prev > 0 ? prev - 1 : 0;
        
        if (next === 0 && prev > 0 && !triggeredRef.current) {
          triggeredRef.current = true;
          
          // Wait 2 seconds then trigger cron
          setTimeout(() => {
            fetch('/api/cron', { cache: 'no-store' })
              .finally(() => onRaceEnd?.());
          }, 2000);
        }
        
        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [onRaceEnd]);

  const minutes = Math.floor(displaySeconds / 60);
  const secs = displaySeconds % 60;
  const isCritical = displaySeconds <= 30;

  return (
    <div className="h-full bg-[#c0c0c0] p-1 border-2 border-t-[#dfdfdf] border-l-[#dfdfdf] border-b-[#404040] border-r-[#404040] font-mono flex flex-col">
      <div className="relative flex-1 bg-black border-2 border-t-[#404040] border-l-[#404040] border-b-[#dfdfdf] border-r-[#dfdfdf] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_2px]" />
        <div className="relative z-10 h-full p-3">
          <div className="absolute top-2 left-2 flex items-baseline leading-none uppercase">
            <span className={`text-5xl tabular-nums font-black ${isCritical ? 'text-yellow-400' : 'text-[#1aff00]'}`}>
              {String(minutes).padStart(2, '0')}
            </span>
            <span className={`text-2xl px-1 font-bold ${isCritical ? 'text-yellow-300' : 'text-[#1aff00]'}`}>:</span>
            <span className={`text-4xl tabular-nums font-black ${isCritical ? 'text-yellow-400' : 'text-[#1aff00]'}`}>
              {String(secs).padStart(2, '0')}
            </span>
          </div>
          {totalPool !== undefined && (
            <div className="absolute top-2 right-2 text-right uppercase">
              <div className="text-[10px] text-gray-500 font-bold mb-1">TOTAL POOL</div>
              <div className="text-2xl text-yellow-500 font-black tabular-nums leading-none">
                {totalPool.toFixed(2)}<span className="text-xs ml-1 opacity-70">SOL</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-[#404040] px-1 font-bold uppercase">
        <span>STATUS: {isCritical ? 'APPROACHING' : 'OPEN'}</span>
        <span>{new Date().toLocaleTimeString([], { hour12: false })}</span>
      </div>
    </div>
  );
}