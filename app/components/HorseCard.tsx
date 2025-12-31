'use client';

import { useState, useEffect } from 'react';
import type { HorseWithOdds } from '../types';

interface HorseCardProps {
  horse: HorseWithOdds;
  onBet: (horseId: number, amount: number) => Promise<void>;
  disabled?: boolean;
  isWinner?: boolean;
}

const QUICK_AMOUNTS = [0.05, 0.1, 0.25, 0.5];

export function HorseCard({
  horse,
  onBet,
  disabled = false,
  isWinner = false,
}: HorseCardProps) {
  const [amount, setAmount] = useState('0.1');
  const [betting, setBetting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (disabled) setBetting(false);
  }, [disabled]);

  const handleBet = async () => {
    if (betting || disabled) return;
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    setBetting(true);
    try {
      await onBet(horse.id, parsed);
    } finally {
      setBetting(false);
    }
  };

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(horse.wallet_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  const handleAmountChange = (v: string) => {
    if (!/^\d*\.?\d{0,3}$/.test(v)) return;
    setAmount(v);
  };

  const hasValidOdds = horse.odds && Number(horse.odds) > 0;

  return (
    <div
      className={`
        relative font-mono uppercase tracking-tight
        bg-[#c0c0c0] p-1
        border-2 border-t-[#dfdfdf] border-l-[#dfdfdf]
        border-b-[#404040] border-r-[#404040]
        ${disabled ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      <div
        className="
          relative bg-black p-3
          border-2 border-t-[#404040] border-l-[#404040]
          border-b-[#dfdfdf] border-r-[#dfdfdf]
        "
      >
        {/* CRT scanlines */}
        <div
          className="
            absolute inset-0 pointer-events-none opacity-10
            bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)]
            bg-[length:100%_2px]
          "
        />

        {/* WINNER BADGE */}
        {isWinner && (
          <div
            className="
              absolute -top-4 -right-4 z-10
              bg-yellow-400 text-black
              px-2 py-1 text-[10px] font-bold
              border-2 border-black
            "
          >
            WINNER
          </div>
        )}

        <div className="relative z-10 space-y-3">
          {/* HEADER */}
          <div className="flex justify-between items-start">
            <div className="pr-2">
                <div
                className="
                    text-[#1aff00] text-3xl leading-tight break-all
                    [font-family:var(--font-vt323),var(--font-mono),monospace]
                "
                >
                    {horse.name}
                </div>
            </div>

            <div
              className={`text-right ${!hasValidOdds ? 'invisible' : ''}`}
              aria-hidden={!hasValidOdds}
            >
              <div className="text-yellow-400 text-xl leading-none font-black">
                {horse.odds}x
              </div>
              <div className="text-[10px] text-yellow-300 opacity-70">
                ODDS
              </div>
            </div>
          </div>

          {/* STATS */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="border-2 border-[#333] p-2 bg-black">
              <div className="text-[#7CFF7C] opacity-70">TOTAL</div>
              <div className="text-[#1aff00]">
                {horse.totalBets?.toFixed(3) ?? '0.000'}
              </div>
            </div>

            <div className="border-2 border-[#333] p-2 bg-black">
              <div className="text-[#7CFF7C] opacity-70">POOL</div>
              <div className="text-[#1aff00]">
                {(horse as any).percentage ?? '0'}%
              </div>
            </div>
          </div>

          {/* WALLET */}
          <div>
            <div className="text-[10px] text-[#7CFF7C] mb-1">
              DEPOSIT ADDRESS
            </div>
            <button
              onClick={copyAddress}
              className="
                w-full border-2 border-[#333] bg-black
                p-2 flex justify-between items-center
                hover:bg-[#050505]
              "
            >
              <code className="text-[10px] text-[#1aff00] truncate mr-2">
                {horse.wallet_address}
              </code>
              <span className="text-[10px] text-yellow-400">
                {copied ? 'COPIED' : 'COPY'}
              </span>
            </button>
          </div>

          {/* QUICK BETS */}
          <div className="flex gap-1">
            {QUICK_AMOUNTS.map(amt => {
              const active = amount === amt.toString();
              return (
                <button
                  key={amt}
                  onClick={() => setAmount(amt.toString())}
                  className={`
                    flex-1 py-2 text-xs font-bold
                    border-2 transition-colors
                    ${
                      active
                        ? 'bg-[#1aff00] text-black border-black'
                        : 'bg-black text-[#7CFF7C] border-[#333] hover:bg-[#050505]'
                    }
                  `}
                >
                  {amt}
                </button>
              );
            })}
          </div>

          {/* BET INPUT */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={e => handleAmountChange(e.target.value)}
                className="
                  w-full bg-black border-2 border-[#333]
                  px-3 py-2 text-[#1aff00] text-sm
                  focus:outline-none focus:border-[#1aff00]
                "
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#7CFF7C]">
                SOL
              </span>
            </div>

            <button
              onClick={handleBet}
              disabled={betting || disabled}
              className="
                px-4 font-black
                border-2 border-yellow-400
                bg-yellow-500 text-black
                hover:bg-yellow-400
                active:scale-95
                disabled:opacity-50 disabled:active:scale-100
                transition-all
              "
            >
              {betting ? '...' : 'BET'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}