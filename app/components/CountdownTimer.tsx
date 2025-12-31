// components/CountdownTimer.tsx
'use client';

interface CountdownTimerProps {
  seconds: number;
  totalPool: number;
}

export function CountdownTimer({ seconds, totalPool }: CountdownTimerProps) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  
  const isUrgent = seconds < 30;
  const isCritical = seconds < 10;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black/50 border border-white/10 p-6">
      {/* Animated background for urgency */}
      {isUrgent && (
        <div 
          className={`absolute inset-0 ${isCritical ? 'bg-red-500/20 animate-pulse' : 'bg-yellow-500/10'}`}
        />
      )}
      
      <div className="relative z-10">
        <div className="text-center mb-4">
          <span className="text-xs text-white/40 uppercase tracking-widest">
            Betting Closes In
          </span>
        </div>
        
        <div className="flex items-center justify-center gap-2">
          {/* Minutes */}
          <div className="relative">
            <div 
              className={`
                text-7xl font-black tabular-nums tracking-tighter
                ${isCritical ? 'text-red-500' : isUrgent ? 'text-yellow-400' : 'text-white'}
              `}
              style={{
                textShadow: isCritical 
                  ? '0 0 30px rgba(239,68,68,0.5)' 
                  : isUrgent 
                    ? '0 0 30px rgba(250,204,21,0.3)'
                    : 'none'
              }}
            >
              {String(minutes).padStart(2, '0')}
            </div>
            <div className="text-xs text-white/30 text-center uppercase tracking-wider">
              min
            </div>
          </div>
          
          <div className={`text-5xl font-bold ${isUrgent ? 'animate-pulse' : ''} ${isCritical ? 'text-red-500' : 'text-white/50'}`}>
            :
          </div>
          
          {/* Seconds */}
          <div className="relative">
            <div 
              className={`
                text-7xl font-black tabular-nums tracking-tighter
                ${isCritical ? 'text-red-500' : isUrgent ? 'text-yellow-400' : 'text-white'}
              `}
              style={{
                textShadow: isCritical 
                  ? '0 0 30px rgba(239,68,68,0.5)' 
                  : isUrgent 
                    ? '0 0 30px rgba(250,204,21,0.3)'
                    : 'none'
              }}
            >
              {String(secs).padStart(2, '0')}
            </div>
            <div className="text-xs text-white/30 text-center uppercase tracking-wider">
              sec
            </div>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="mt-6 h-2 rounded-full bg-white/10 overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ${
              isCritical ? 'bg-red-500' : isUrgent ? 'bg-yellow-400' : 'bg-emerald-500'
            }`}
            style={{ width: `${(seconds / 300) * 100}%` }}
          />
        </div>
        
        {/* Pool info */}
        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/40 uppercase tracking-wider">
              Total Pool
            </span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-emerald-400">
                {totalPool.toFixed(3)}
              </span>
              <span className="text-sm text-white/40">SOL</span>
            </div>
          </div>
        </div>
        
        {/* Warning message */}
        {isUrgent && (
          <div className={`mt-4 text-center text-sm font-bold uppercase tracking-wider ${isCritical ? 'text-red-400 animate-pulse' : 'text-yellow-400'}`}>
            {isCritical ? '⚠️ Last chance to bet!' : 'Hurry! Time running out'}
          </div>
        )}
      </div>
    </div>
  );
}