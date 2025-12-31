// components/CountdownTimer.tsx
'use client';

interface CountdownTimerProps {
  seconds: number;
  totalPool: number;
}

export function CountdownTimer({ seconds }: CountdownTimerProps) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const isLow = seconds < 60;
  const isCritical = seconds < 30;

  return (
    <div className={`
      relative overflow-hidden bg-white rounded-2xl border shadow-sm p-5
      ${isCritical ? 'border-red-200 bg-red-50/50' : isLow ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200'}
    `}>
      {/* Animated background pulse when critical */}
      {isCritical && (
        <div className="absolute inset-0 bg-red-100 animate-pulse opacity-30" />
      )}
      
      <div className="relative">
        <p className="text-xs text-gray-500 mb-1">Next Race In</p>
        <div className="flex items-baseline gap-1">
          <span className={`
            text-3xl font-bold tabular-nums
            ${isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-900'}
          `}>
            {String(minutes).padStart(2, '0')}
          </span>
          <span className={`text-xl ${isCritical ? 'text-red-400 animate-pulse' : 'text-gray-400'}`}>:</span>
          <span className={`
            text-3xl font-bold tabular-nums
            ${isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-900'}
          `}>
            {String(secs).padStart(2, '0')}
          </span>
        </div>
        
        {isCritical && (
          <p className="text-xs text-red-500 font-medium mt-2 animate-pulse">Last chance to bet!</p>
        )}
      </div>
    </div>
  );
}