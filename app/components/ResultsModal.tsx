'use client';

import type { RaceResult, HorseWithOdds } from '../types';

interface ResultsModalProps {
  result: RaceResult;
  horses: HorseWithOdds[];
  userWallet?: string;
  onClose: () => void;
}

export function ResultsModal({
  result,
  horses,
  userWallet,
  onClose,
}: ResultsModalProps) {
  const winningHorse = horses.find(h => h.id === result.winningHorseId);

  const userPayout = userWallet
    ? result.payouts.find(p => p.wallet === userWallet)
    : null;

  const positions =
    result.positions?.length > 0
      ? result.positions
      : [
          result.winningHorseId,
          ...horses
            .filter(h => h.id !== result.winningHorseId)
            .map(h => h.id),
        ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-mono uppercase">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-black border border-[#1aff00]/40 shadow-[0_0_24px_rgba(26,255,0,0.12)] animate-modalIn">
        {/* Header */}
        <div className="px-4 py-2 flex justify-between items-center text-[10px] text-[#1aff00]/80">
          <span className="tracking-widest">RESULT</span>
          <button
            onClick={onClose}
            className="hover:text-black hover:bg-[#1aff00] px-1 transition-colors"
          >
            CLOSE
          </button>
        </div>

        {/* Winner */}
        <div className="px-6 py-6 text-center">
          <div className="text-4xl mb-2">{winningHorse?.emoji || '🏇'}</div>
          <div className="text-[10px] text-[#7CFF7C]/60 mb-1">
            WINNER
          </div>
          <h2 className="text-lg font-bold text-[#1aff00] tracking-tight">
            {winningHorse?.name || result.winningHorseName}
          </h2>
        </div>

        {/* Divider */}
        <div className="mx-6 h-px bg-[#1aff00]/15" />

        {/* Placements */}
        <div className="px-6 py-4 space-y-1">
          {positions.slice(0, 5).map((horseId, index) => {
            const horse = horses.find(h => h.id === horseId);
            if (!horse) return null;

            const isWinner = index === 0;

            return (
              <div
                key={horseId}
                className={`flex justify-between text-xs ${
                  isWinner
                    ? 'text-[#1aff00]'
                    : 'text-[#7CFF7C]/50'
                }`}
              >
                <span>
                  <span className="inline-block w-4 opacity-40">
                    {index + 1}
                  </span>
                  {horse.name}
                </span>
              </div>
            );
          })}
        </div>

        {/* User payout */}
        {userPayout && (
          <div className="mx-6 mb-4 px-4 py-2 bg-[#1aff00]/5 text-[#1aff00] text-xs flex justify-between">
            <span className="opacity-70">WINNINGS</span>
            <span className="font-bold">
              +{userPayout.amount.toFixed(4)} SOL
            </span>
          </div>
        )}

        {/* Action */}
        <div className="p-4">
          <button
            onClick={onClose}
            className="w-full py-2 text-xs border border-[#1aff00]/50 text-[#1aff00] hover:bg-[#1aff00] hover:text-black transition-colors"
          >
            RETURN
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes modalIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-modalIn {
          animation: modalIn 0.28s ease-out forwards;
        }
      `}</style>
    </div>
  );
}