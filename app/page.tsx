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
      const timer = setTimeout(() => {
        setShowResults(true);
        setLastShownResultId(lastResult.raceId);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [lastResult, isRacing, lastShownResultId]);

  useEffect(() => {
    if (currentRace?.status === 'betting' && showResults) {
      setShowResults(false);
    }
  }, [currentRace?.status, showResults]);

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
      const { PublicKey, Transaction, SystemProgram, Connection, LAMPORTS_PER_SOL } =
        await import('@solana/web3.js');

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
          bettorWallet: currentWallet
        })
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

  /* ─────────────────────────────────────────────────────────────
     FLASHBANG / PEOPLE-DO LOADER
     ───────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-white overflow-hidden">
        <style>{`
          @keyframes flash-load {
            0% {
              transform: translate(-50%, -50%) scale(0.1);
              opacity: 0;
            }
            10% {
              transform: translate(-50%, -50%) scale(1);
              opacity: 1;
            }
            40% {
              transform: translate(-50%, -50%) scale(1.2);
              opacity: 1;
            }
            100% {
              transform: translate(-50%, -50%) scale(15);
              opacity: 0;
            }
          }

          .flash-loader {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 30vmin;
            height: 30vmin;
            animation: flash-load 2.2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
            pointer-events: none;
            will-change: transform, opacity;
          }
        `}</style>

        <img
          src="/load.gif"
          alt="Loading"
          className="flash-loader"
        />
      </div>
    );
  }

  /* ───────────────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Solana Derby
              </h1>
              {currentRace && (
                <p className="text-xs text-gray-500">
                  Race #{currentRace.race_number}
                </p>
              )}
            </div>
            <WalletConnect />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {betError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3">
            <span className="text-red-500">⚠️</span>
            <p className="text-red-700 text-sm font-medium">
              {betError}
            </p>
          </div>
        )}

        {betSuccess && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex gap-3">
            <span className="text-green-500">✓</span>
            <p className="text-green-700 text-sm font-medium">
              Bet placed: {betSuccess}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <CountdownTimer
            seconds={timeRemaining}
            totalPool={totalPool}
          />
          <div className="lg:col-span-2">
            <BetMarquee
              bets={recentBets}
              horses={horses}
            />
          </div>
        </div>

        <RaceTrack
          horses={horses}
          isRacing={isRacing}
          winningHorseId={lastResult?.winningHorseId}
          finalPositions={racePositions}
        />

        <div>
          <div className="flex justify-between mb-4">
            <h2 className="text-lg font-semibold">
              Place Your Bets
            </h2>
            <p className="text-sm text-gray-500">
              {isRacing
                ? 'Race in progress...'
                : 'Select a horse to bet'}
            </p>
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

        <footer className="text-center py-8 border-t border-gray-200">
          <p className="text-sm text-gray-400">
            Built on Solana • Races every 5 minutes
          </p>
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