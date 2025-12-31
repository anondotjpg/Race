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
      {/* Dimmer backdrop without blur to keep it "lo-fi" */}
      <div 
        className="absolute inset-0 bg-black/70" 
        onClick={onClose} 
      />
      
      {/* Modal - Cleaner Retro Style */}
      <div className="relative w-full max-w-sm bg-black border-2 border-[#1aff00] shadow-[8px_8px_0px_0px_rgba(26,255,0,0.2)] overflow-hidden animate-modalIn">
        
        {/* Header bar - Simple */}
        <div className="border-b-2 border-[#1aff00] px-4 py-2 flex justify-between items-center bg-[#1aff00]/5">
          <span className="text-[#1aff00] text-xs font-bold tracking-widest">RESULT</span>
          <button
            onClick={onClose}
            className="text-[#1aff00] hover:bg-[#1aff00] hover:text-black px-1 text-xs transition-colors"
          >
            [CLOSE]
          </button>
        </div>

        {/* Winner display - Static and clean */}
        <div className="p-6 text-center border-b border-[#1aff00]/20">
          <div className="text-4xl mb-3">{winningHorse?.emoji || '🏇'}</div>
          <div className="text-[#7CFF7C] text-xs mb-1 opacity-60">Winner</div>
          <h2 className="text-xl font-bold text-[#1aff00] tracking-tight">
            {winningHorse?.name || result.winningHorseName}
          </h2>
        </div>
        
        {/* Results List */}
        <div className="px-6 py-4 space-y-2">
          {positions.slice(0, 5).map((horseId, index) => {
            const horse = horses.find(h => h.id === horseId);
            if (!horse) return null;
            
            return (
              <div 
                key={horseId}
                className={`flex items-center justify-between text-xs ${index === 0 ? 'text-[#1aff00]' : 'text-[#7CFF7C] opacity-70'}`}
              >
                <div className="flex gap-3">
                  <span className="w-6 opacity-50">{index + 1}.</span>
                  <span>{horse.name}</span>
                </div>
                <span>{index === 0 ? '[1ST]' : ''}</span>
              </div>
            );
          })}
        </div>
        
        {/* User payout - Subdued but clear */}
        {userPayout && (
          <div className="mx-4 mb-4 p-3 border border-[#1aff00] bg-[#1aff00]/10">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-[#1aff00] font-bold">WINNINGS_RECIEVED:</span>
              <span className="text-[#1aff00] font-bold">
                +{userPayout.amount.toFixed(4)} SOL
              </span>
            </div>
          </div>
        )}
        
        {/* Action Button - Minimalist */}
        <div className="p-4">
          <button
            onClick={onClose}
            className="w-full py-2 border-2 border-[#1aff00] text-[#1aff00] text-xs font-bold hover:bg-[#1aff00] hover:text-black transition-all"
          >
            CONFIRM & RETURN
          </button>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes modalIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-modalIn {
          animation: modalIn 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}