// components/ResultsModal.tsx
'use client';

import type { RaceResult, HorseWithOdds } from '../types';

interface ResultsModalProps {
  result: RaceResult;
  horses: HorseWithOdds[];
  userWallet?: string;
  onClose: () => void;
}

export function ResultsModal({ result, horses, userWallet, onClose }: ResultsModalProps) {
  const winningHorse = horses.find(h => h.id === result.winningHorseId);
  const userPayout = userWallet 
    ? result.payouts.find(p => p.wallet === userWallet)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-3xl overflow-hidden bg-gradient-to-b from-gray-900 to-black border border-white/20">
        {/* Confetti effect for winners */}
        {userPayout && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 animate-confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'][Math.floor(Math.random() * 5)],
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${2 + Math.random() * 2}s`
                }}
              />
            ))}
          </div>
        )}
        
        {/* Header */}
        <div className="relative p-6 text-center border-b border-white/10">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="text-3xl font-black text-yellow-400 uppercase tracking-wider">
            Race Complete!
          </h2>
        </div>
        
        {/* Winner info */}
        <div className="p-6 text-center border-b border-white/10">
          <div className="text-sm text-white/40 uppercase tracking-wider mb-2">
            Winner
          </div>
          <div className="flex items-center justify-center gap-3">
            <span 
              className="text-5xl"
              style={{ textShadow: `0 0 20px ${winningHorse?.color}` }}
            >
              {winningHorse?.emoji}
            </span>
            <span 
              className="text-2xl font-black"
              style={{ color: winningHorse?.color }}
            >
              {winningHorse?.name}
            </span>
          </div>
        </div>
        
        {/* Final standings */}
        <div className="p-6 border-b border-white/10">
          <div className="text-sm text-white/40 uppercase tracking-wider mb-4 text-center">
            Final Standings
          </div>
          <div className="space-y-2">
            {result.positions.map((horseId, index) => {
              const horse = horses.find(h => h.id === horseId);
              if (!horse) return null;
              
              const medals = ['🥇', '🥈', '🥉', '4th', '5th'];
              
              return (
                <div 
                  key={horseId}
                  className={`
                    flex items-center gap-3 p-3 rounded-xl
                    ${index === 0 ? 'bg-yellow-500/20 border border-yellow-500/30' : 'bg-white/5'}
                  `}
                >
                  <span className="text-2xl w-10 text-center">{medals[index]}</span>
                  <span className="text-xl">{horse.emoji}</span>
                  <span className="font-bold flex-1" style={{ color: horse.color }}>
                    {horse.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* User payout (if any) */}
        {userPayout && (
          <div className="p-6 bg-emerald-500/20 border-b border-emerald-500/30">
            <div className="text-center">
              <div className="text-sm text-emerald-400 uppercase tracking-wider mb-2">
                🎉 You Won!
              </div>
              <div className="text-4xl font-black text-emerald-400">
                {userPayout.amount.toFixed(4)} SOL
              </div>
              <div className="text-sm text-white/40 mt-2">
                Payout will be sent to your wallet
              </div>
            </div>
          </div>
        )}
        
        {/* Close button */}
        <div className="p-6">
          <button
            onClick={onClose}
            className="w-full py-4 rounded-xl bg-white/10 hover:bg-white/20 transition-colors font-bold uppercase tracking-wider"
          >
            Next Race Starting Soon...
          </button>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(-100vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti linear infinite;
        }
      `}</style>
    </div>
  );
}