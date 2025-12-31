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

  const positions = result.positions?.length > 0 
    ? result.positions 
    : [result.winningHorseId, ...horses.filter(h => h.id !== result.winningHorseId).map(h => h.id)];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-mono uppercase">
      {/* Backdrop with scanline effect */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
        onClick={onClose} 
      />
      
      {/* Modal - Retro Styled */}
      <div className="relative w-full max-w-md bg-black border-4 border-[#1aff00] shadow-[0_0_20px_rgba(26,255,0,0.3)] overflow-hidden animate-modalIn">
        
        {/* Header bar */}
        <div className="bg-[#1aff00] px-4 py-1 flex justify-between items-center">
          <span className="text-black font-bold text-sm">RACE_RESULTS.EXE</span>
          <button
            onClick={onClose}
            className="text-black font-bold hover:bg-black hover:text-[#1aff00] px-2 transition-colors"
          >
            [X]
          </button>
        </div>

        {/* Winner section */}
        <div className="relative p-6 text-center border-b-4 border-[#555]">
          <div className="mb-4 inline-block animate-pulse">
            <span className="text-6xl filter drop-shadow-[0_0_10px_rgba(26,255,0,0.8)]">
              {winningHorse?.emoji || '🐴'}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-[#1aff00] mb-1 tracking-tighter">WINNER DECLARED</h2>
          
          <div className="mt-4 p-3 border-2 border-dashed border-[#1aff00] inline-block">
            <span className="text-xl font-bold text-[#1aff00]">
              {winningHorse?.name || result.winningHorseName}
            </span>
          </div>
        </div>
        
        {/* Results List */}
        <div className="px-6 py-4 bg-[#0a0a0a]">
          <p className="text-xs text-[#7CFF7C] mb-3 opacity-70 italic underline">Final Standings</p>
          <div className="space-y-1">
            {positions.slice(0, 5).map((horseId, index) => {
              const horse = horses.find(h => h.id === horseId);
              if (!horse) return null;
              
              return (
                <div 
                  key={horseId}
                  className={`flex items-center gap-4 p-1 ${index === 0 ? 'text-[#1aff00] bg-[#1aff00]/10' : 'text-[#7CFF7C]'}`}
                >
                  <span className="w-10 font-bold">
                    {index === 0 ? 'WIN' : `${index + 1}ST`}
                  </span>
                  <span className="text-lg">{horse.emoji}</span>
                  <span className="flex-1 truncate">{horse.name}</span>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* User payout - Neon Alert style */}
        {userPayout && (
          <div className="mx-4 mb-4 p-4 bg-[#1aff00] text-black border-2 border-white animate-bounce-short">
            <div className="flex flex-col items-center justify-center text-center">
              <p className="font-black text-lg leading-none">!!! YOU WON !!!</p>
              <p className="text-2xl font-black mt-2">
                +{userPayout.amount.toFixed(4)} SOL
              </p>
              <p className="text-[10px] font-bold opacity-80 mt-1">TRANSACTION BROADCASTED</p>
            </div>
          </div>
        )}
        
        {/* Action Button */}
        <div className="p-4 border-t-4 border-[#555]">
          <button
            onClick={onClose}
            className="w-full py-3 bg-[#1aff00] text-black font-black hover:bg-white transition-colors active:translate-y-1"
          >
            RETURN TO TRACK
          </button>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes modalIn {
          from {
            opacity: 0;
            transform: scale(0.8) rotate(-2deg);
          }
          to {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }
        @keyframes bounce-short {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-modalIn {
          animation: modalIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        .animate-bounce-short {
          animation: bounce-short 0.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}