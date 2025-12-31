'use client';

import { useEffect, useRef, useState } from 'react';

interface CountdownTimerProps {
  seconds: number;
  totalPool?: number;
}

export function CountdownTimer({ seconds }: CountdownTimerProps) {
  // Clamp incoming value (server truth)
  const safeSeconds = Math.max(0, Math.floor(seconds));

  // Local visual timer (smooth)
  const [displaySeconds, setDisplaySeconds] = useState(safeSeconds);
  const lastServerSeconds = useRef(safeSeconds);

  // ─────────────────────────────────────────────
  // Smooth sync to server time
  // ─────────────────────────────────────────────
  useEffect(() => {
    // If server jumps forward (new race), snap immediately
    if (safeSeconds > lastServerSeconds.current) {
      setDisplaySeconds(safeSeconds);
    }

    lastServerSeconds.current = safeSeconds;
  }, [safeSeconds]);

  // ─────────────────────────────────────────────
  // Local ticking (smooth 1s decrement)
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (displaySeconds <= 0) return;

    const id = setInterval(() => {
      setDisplaySeconds(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(id);
  }, [displaySeconds]);

  const minutes = Math.floor(displaySeconds / 60);
  const secs = displaySeconds % 60;

  const isLow = displaySeconds <= 60;
  const isCritical = displaySeconds <= 30;

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl border p-5 shadow-sm
        transition-colors duration-500
        ${
          isCritical
            ? 'border-red-200 bg-red-50/60'
            : isLow
            ? 'border-amber-200 bg-amber-50/60'
            : 'border-gray-200 bg-white'
        }
      `}
    >
      {/* Critical pulse overlay */}
      {isCritical && (
        <div className="absolute inset-0 bg-red-100/40 animate-pulse pointer-events-none" />
      )}

      <div className="relative">
        <p className="text-xs text-gray-500 mb-1">Next Race In</p>

        <div className="flex items-baseline gap-1">
          <span
            className={`
              text-3xl font-bold tabular-nums transition-colors
              ${
                isCritical
                  ? 'text-red-600'
                  : isLow
                  ? 'text-amber-600'
                  : 'text-gray-900'
              }
            `}
          >
            {String(minutes).padStart(2, '0')}
          </span>

          <span
            className={`
              text-xl transition-colors
              ${isCritical ? 'text-red-400 animate-pulse' : 'text-gray-400'}
            `}
          >
            :
          </span>

          <span
            className={`
              text-3xl font-bold tabular-nums transition-colors
              ${
                isCritical
                  ? 'text-red-600'
                  : isLow
                  ? 'text-amber-600'
                  : 'text-gray-900'
              }
            `}
          >
            {String(secs).padStart(2, '0')}
          </span>
        </div>

        {isCritical && displaySeconds > 0 && (
          <p className="mt-2 text-xs font-medium text-red-500 animate-pulse">
            Last chance to bet!
          </p>
        )}
      </div>
    </div>
  );
}
