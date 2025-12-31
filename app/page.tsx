'use client';

import { useState, useEffect } from 'react';
import { useGameState } from './hooks/useGameState';
import { useWallet } from './hooks/useWallet';
import { RaceTrack } from './components/RaceTrack';
import { HorseCard } from './components/HorseCard';
import { CountdownTimer } from './components/CountdownTimer';
import { WalletConnect } from './components/WalletConnect';
import { ResultsModal } from './components/ResultsModal';
import { BetMarquee } from './components/BetMarquee';

export default function Home() {
  const { 
    currentRace, 
    horses, 
    timeRemaining, 
    isRacing, 
    lastResult, 
    totalPool,
    racePositions,
    recentBets,
    loading 
  } = useGameState();
  
  const { wallet } = useWallet();
  
  const [showResults, setShowResults] = useState(false);
  const [betError, setBetError] = useState<string | null>(null);
  const [betSuccess, setBetSuccess] = useState<string | null>(null);
  const [lastShownResultId, setLastShownResultId] = useState<string | null>(null);

  useEffect(() => {
    if (lastResult && !isRacing && lastResult.raceId !== lastShownResultId) {
      const t = setTimeout(() => {
        setShowResults(true);
        setLastShownResultId(lastResult.raceId);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [lastResult, isRacing, lastShownResultId]);

  useEffect(() => {
    if (currentRace?.status === 'betting' && showResults) {
      setShowResults(false);
    }
  }, [currentRace?.status, showResults]);

  /* ─────────────────────────────────────────────────────────────
     LOADER (INTENSE BLOOM)
     ───────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden">
        <style>{`
          @keyframes flash-expand {
            0% { transform: scale(0.1); opacity: 0; filter: brightness(2); }
            10% { transform: scale(1); opacity: 1; filter: brightness(1); }
            80% { transform: scale(1.1); opacity: 1; filter: brightness(1.2); }
            100% { transform: scale(20); opacity: 0; filter: brightness(5) blur(10px); }
          }
          .flash-container {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: flash-expand 2.2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
          }
        `}</style>

        <div className="flash-container">
          <img
            src="/load.gif"
            alt="Loading"
            className="w-[30vmin] h-[30vmin] pixelated"
            style={{
              /* Heavy atmospheric glow that follows image transparency */
              filter: `
                drop-shadow(0 0 10px rgba(26, 255, 0, 0.9)) 
                drop-shadow(0 0 30px rgba(26, 255, 0, 0.5)) 
                drop-shadow(0 0 60px rgba(26, 255, 0, 0.2))
              `
            }}
          />
        </div>
      </div>
    );
  }

  const handleBet = async (horseId: number, amount: number) => {
    const win = window as any;
    const phantom = win.phantom?.solana || win.solana;
  
    if (!phantom?.isConnected || !phantom?.publicKey) {
      setBetError('Please connect your wallet first');
      setTimeout(() => setBetError(null), 3000);
      return;
    }
  
    if (!currentRace) {
      setBetError('No active race');
      setTimeout(() => setBetError(null), 3000);
      return;
    }
  
    const horse = horses.find(h => h.id === horseId);
    if (!horse) {
      setBetError('Horse not found');
      setTimeout(() => setBetError(null), 3000);
      return;
    }
  
    setBetError(null);
    setBetSuccess(null);
  
    try {
      const {
        PublicKey,
        Transaction,
        SystemProgram,
        Connection,
        LAMPORTS_PER_SOL,
      } = await import('@solana/web3.js');
  
      const currentWallet = phantom.publicKey.toBase58();
      const rpcUrl =
        process.env.NEXT_PUBLIC_SOLANA_RPC ||
        'https://api.mainnet-beta.solana.com';
  
      const connection = new Connection(rpcUrl, 'confirmed');
      const fromPubkey = new PublicKey(currentWallet);
      const toPubkey = new PublicKey(horse.wallet_address);
      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
  
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
  
      const transaction = new Transaction().add(
        SystemProgram.transfer({ fromPubkey, toPubkey, lamports })
      );
  
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;
  
      const { signature } = await phantom.signAndSendTransaction(transaction);
  
      if (!signature) {
        setBetError('Transaction cancelled');
        setTimeout(() => setBetError(null), 3000);
        return;
      }
  
      const res = await fetch('/api/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raceId: currentRace.id,
          horseId,
          txSignature: signature,
          bettorWallet: currentWallet,
        }),
      });
  
      const data = await res.json();
  
      if (!res.ok) {
        setBetError(data.error || 'Failed to record bet');
        setTimeout(() => setBetError(null), 3000);
        return;
      }
  
      setBetSuccess(`${amount} SOL on ${horse.name}`);
      setTimeout(() => setBetSuccess(null), 5000);
    } catch (error: any) {
      if (error?.message?.includes('User rejected')) {
        setBetError('Transaction cancelled');
      } else {
        const msg = error?.message || 'Bet failed';
        setBetError(msg.length > 50 ? msg.slice(0, 50) + '...' : msg);
      }
      setTimeout(() => setBetError(null), 5000);
    }
  };  

  return (
    <div className="min-h-screen bg-black font-mono uppercase tracking-tight text-[#1aff00]">
      {/* GLOBAL CRT SCANLINES */}
      <div
        className="
          fixed inset-0 pointer-events-none opacity-10 z-[5]
          bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.35)_50%)]
          bg-[length:100%_4px]
        "
      />

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-black border-b-4 border-[#555]">
        <div className="max-w-7xl mx-auto px-4 py-3 grid grid-cols-3 items-center">
          
          {/* LEFT: LOGO WITH PIXEL-PERFECT GLOW (NO SQUARE BOX) */}
          <div className="flex items-center">
            <img
              src="/load.gif"
              alt="Logo"
              className="h-10 w-auto pixelated"
              style={{
                /* drop-shadow wraps pixels, box-shadow/backgrounds make squares */
                filter: `
                  drop-shadow(0 0 2px rgba(26, 255, 0, 0.8)) 
                  drop-shadow(0 0 8px rgba(26, 255, 0, 0.4))
                `
              }}
            />
          </div>

          {/* CENTER: RACE NUMBER */}
          <div className="text-center">
            {currentRace ? (
              <div className="text-sm text-[#1aff00] drop-shadow-[0_0_5px_rgba(26,255,0,0.5)]">
                RACE #{currentRace.race_number}
              </div>
            ) : (
              <div className="text-sm text-[#7CFF7C]">
                NO ACTIVE RACE
              </div>
            )}
          </div>

          {/* RIGHT: WALLET */}
          <div className="flex justify-end">
            <WalletConnect />
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6 relative z-10">
        {/* ERRORS / SUCCESS */}
        {betError && (
          <div className="border-4 border-red-500 bg-black p-4 flex gap-3 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <span className="text-red-500">⚠</span>
            <p className="text-red-400 text-sm">{betError}</p>
          </div>
        )}

        {betSuccess && (
          <div className="border-4 border-[#1aff00] bg-black p-4 flex gap-3 shadow-[0_0_15px_rgba(26,255,0,0.2)]">
            <span className="text-[#1aff00]">✓</span>
            <p className="text-[#7CFF7C] text-sm">BET PLACED: {betSuccess}</p>
          </div>
        )}

        {/* TOP STRIP */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <CountdownTimer seconds={timeRemaining} totalPool={totalPool} />
          <div className="lg:col-span-2">
            <BetMarquee bets={recentBets} horses={horses} />
          </div>
        </div>

        {/* RACE */}
        <RaceTrack
          horses={horses}
          isRacing={isRacing}
          winningHorseId={lastResult?.winningHorseId}
          finalPositions={racePositions}
        />

        {/* BETTING */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="text-lg text-[#1aff00] drop-shadow-[0_0_8px_rgba(26,255,0,0.4)]">
              PLACE YOUR BETS
            </div>
            <div className="text-[10px] text-[#7CFF7C]">
              {isRacing ? 'RACE IN PROGRESS' : 'BETTING OPEN'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {horses.map(horse => (
              <HorseCard
                key={horse.id}
                horse={horse}
                onBet={handleBet}
                disabled={isRacing || timeRemaining === 0}
                isWinner={lastResult?.winningHorseId === horse.id}
              />
            ))}
          </div>
        </div>

        {/* FOOTER */}
        <footer className="text-center py-6 border-t-4 border-[#555] text-[10px] text-[#7CFF7C]">
          BUILT ON SOLANA • RACES EVERY 1 MINUTE(S)
        </footer>
      </main>

      {showResults && lastResult && (
        <ResultsModal
          result={lastResult}
          horses={horses}
          userWallet={wallet || undefined}
          onClose={() => setShowResults(false)}
        />
      )}
    </div>
  );
}