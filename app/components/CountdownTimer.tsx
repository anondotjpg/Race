'use client';

import { useEffect, useRef, useState } from 'react';

interface CountdownTimerProps {
  seconds: number;
  totalPool?: number;
}

export function CountdownTimer({ seconds, totalPool }: CountdownTimerProps) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const [displaySeconds, setDisplaySeconds] = useState(safeSeconds);

  const lastServerSeconds = useRef(safeSeconds);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync from server (unchanged logic)
  useEffect(() => {
    if (safeSeconds > lastServerSeconds.current) {
      setDisplaySeconds(safeSeconds);
    }
    if (safeSeconds < displaySeconds) {
      setDisplaySeconds(safeSeconds);
    }
    lastServerSeconds.current = safeSeconds;
  }, [safeSeconds, displaySeconds]);

  // Single ticking interval
  useEffect(() => {
    if (intervalRef.current) return;

    intervalRef.current = setInterval(() => {
      setDisplaySeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const minutes = Math.floor(displaySeconds / 60);
  const secs = displaySeconds % 60;

  const isLow = displaySeconds <= 60;
  const isCritical = displaySeconds <= 30;

  return (
    <div
      className={`
        relative bg-black border-4 border-[#555]
        font-mono uppercase tracking-tight
      `}
    >
      {/* CRT scanlines */}
      <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[length:100%_4px]" />

      {/* CRITICAL FLASH */}
      {isCritical && (
        <div className="absolute inset-0 bg-red-900/30 animate-pulse pointer-events-none" />
      )}

      <div className="relative p-4 flex items-center justify-between gap-6">
        {/* TIMER */}
        <div>
          <div className="text-[10px] text-[#7CFF7C] mb-1">
            NEXT RACE IN
          </div>

          <div className="flex items-baseline gap-1">
            <span
              className={`
                text-4xl tabular-nums
                ${isCritical ? 'text-red-500 animate-pulse' : isLow ? 'text-yellow-400' : 'text-[#1aff00]'}
              `}
            >
              {String(minutes).padStart(2, '0')}
            </span>

            <span
              className={`
                text-3xl mx-1
                ${isCritical ? 'text-red-400 animate-pulse' : 'text-[#7CFF7C]'}
              `}
            >
              :
            </span>

            <span
              className={`
                text-4xl tabular-nums
                ${isCritical ? 'text-red-500 animate-pulse' : isLow ? 'text-yellow-400' : 'text-[#1aff00]'}
              `}
            >
              {String(secs).padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* POOL */}
        {totalPool !== undefined && (
          <div className="text-right">
            <div className="text-[10px] text-[#7CFF7C] mb-1">
              TOTAL POOL
            </div>
            <div className="text-2xl text-yellow-400 tabular-nums">
              {totalPool.toFixed(2)}
              <span className="text-xs text-yellow-300 ml-1">SOL</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}