// components/CountdownTimer.tsx
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

  const lastServerSeconds = useRef(safeSeconds);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const triggeredRef = useRef(false);

  // Sync from server
  useEffect(() => {
    // New race started (seconds went back up) - reset trigger
    if (safeSeconds > lastServerSeconds.current + 10) {
      triggeredRef.current = false;
    }
    
    // New race or server jump forward → snap
    if (safeSeconds > lastServerSeconds.current) {
      setDisplaySeconds(safeSeconds);
    }
    // Server correction backward → clamp
    if (safeSeconds < displaySeconds) {
      setDisplaySeconds(safeSeconds);
    }
    lastServerSeconds.current = safeSeconds;
  }, [safeSeconds, displaySeconds]);

  // Single ticking interval
  useEffect(() => {
    if (intervalRef.current) return;

    intervalRef.current = setInterval(() => {
      setDisplaySeconds(prev => {
        const next = prev > 0 ? prev - 1 : 0;
        
        // Trigger cron when hitting 0 (only once per race)
        if (next === 0 && prev > 0 && !triggeredRef.current) {
          triggeredRef.current = true;
          
          // Hit cron to execute race, then refresh state
          fetch('/api/cron', { cache: 'no-store' })
            .finally(() => {
              // Small delay to let DB update, then refresh
              setTimeout(() => onRaceEnd?.(), 500);
            });
          
          console.log('[Timer] Triggered cron at 0');
        }
        
        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [onRaceEnd]);

  const minutes = Math.floor(displaySeconds / 60);
  const secs = displaySeconds % 60;

  const isLow = displaySeconds <= 60;
  const isCritical = displaySeconds <= 30;

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-colors duration-500
        ${isCritical ? 'border-red-200 bg-red-50/60' : isLow ? 'border-amber-200 bg-amber-50/60' : 'border-gray-200 bg-white'}
      `}
    >
      {isCritical && (
        <div className="absolute inset-0 bg-red-100/40 animate-pulse pointer-events-none" />
      )}

      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-1">Next Race In</p>
          <div className="flex items-baseline gap-1">
            <span className={`text-3xl font-bold tabular-nums transition-colors ${isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-900'}`}>
              {String(minutes).padStart(2, '0')}
            </span>
            <span className={`text-xl transition-colors ${isCritical ? 'text-red-400 animate-pulse' : 'text-gray-400'}`}>:</span>
            <span className={`text-3xl font-bold tabular-nums transition-colors ${isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-900'}`}>
              {String(secs).padStart(2, '0')}
            </span>
          </div>
          {isCritical && displaySeconds > 0 && (
            <p className="mt-2 text-xs font-medium text-red-500 animate-pulse">
              Last chance to bet!
            </p>
          )}
        </div>

        {totalPool !== undefined && (
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-1">Total Pool</p>
            <p className="text-2xl font-bold text-gray-900">
              {totalPool.toFixed(2)} <span className="text-sm text-gray-400">SOL</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}