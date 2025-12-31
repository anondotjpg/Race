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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-modalIn">
        {/* Confetti for winners */}
        {userPayout && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full animate-confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  backgroundColor: ['#fbbf24', '#f87171', '#34d399', '#60a5fa', '#a78bfa'][i % 5],
                  animationDelay: `${Math.random() * 1}s`,
                }}
              />
            ))}
          </div>
        )}
        
        {/* Winner section */}
        <div className="relative bg-gradient-to-b from-amber-50 to-white px-6 pt-8 pb-6 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30 rotate-3">
            <span className="text-4xl">🏆</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Race Complete!</h2>
          <p className="text-gray-500">And the winner is...</p>
          
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-100 rounded-full">
            <span className="text-2xl">{winningHorse?.emoji}</span>
            <span className="font-bold text-amber-900">{winningHorse?.name}</span>
          </div>
        </div>
        
        {/* Results */}
        <div className="px-6 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Final Standings</p>
          <div className="space-y-2">
            {result.positions.slice(0, 5).map((horseId, index) => {
              const horse = horses.find(h => h.id === horseId);
              if (!horse) return null;
              
              const medals = ['🥇', '🥈', '🥉'];
              
              return (
                <div 
                  key={horseId}
                  className={`
                    flex items-center gap-3 p-2 rounded-xl transition-colors
                    ${index === 0 ? 'bg-amber-50' : ''}
                  `}
                >
                  <span className="w-8 text-center">
                    {index < 3 ? (
                      <span className="text-lg">{medals[index]}</span>
                    ) : (
                      <span className="text-sm text-gray-400 font-medium">{index + 1}</span>
                    )}
                  </span>
                  <span className="text-xl">{horse.emoji}</span>
                  <span className={`font-medium ${index === 0 ? 'text-amber-900' : 'text-gray-700'}`}>
                    {horse.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* User payout */}
        {userPayout && (
          <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-t border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">🎉 You won!</p>
                <p className="text-xs text-green-500/70">Payout sent to your wallet</p>
              </div>
              <p className="text-2xl font-bold text-green-600">
                +{userPayout.amount.toFixed(4)} <span className="text-base font-normal">SOL</span>
              </p>
            </div>
          </div>
        )}
        
        {/* Action */}
        <div className="p-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-xl transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes modalIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-modalIn {
          animation: modalIn 0.3s ease-out;
        }
        @keyframes confetti {
          0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(400px) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti 2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}