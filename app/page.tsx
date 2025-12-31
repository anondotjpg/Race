'use client';

import { useState, useCallback, useEffect } from 'react';
import { useGameState } from './hooks/useGameState';
import { useWallet } from './hooks/useWallet';
import { RaceTrack } from './components/RaceTrack';
import { HorseCard } from './components/HorseCard';
import { CountdownTimer } from './components/CountdownTimer';
import { WalletConnect } from './components/WalletConnect';
import { ResultsModal } from './components/ResultsModal';

export default function Home() {
  const { 
    currentRace, 
    horses, 
    timeRemaining, 
    isRacing, 
    lastResult, 
    totalPool,
    racePositions,
    loading 
  } = useGameState();
  
  const { wallet, connected, sendBet } = useWallet();
  const [showResults, setShowResults] = useState(false);
  const [betError, setBetError] = useState<string | null>(null);
  const [betSuccess, setBetSuccess] = useState<string | null>(null);

  const handleBet = useCallback(async (horseId: number, amount: number) => {
    if (!connected || !wallet) {
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
      const signature = await sendBet(horse.wallet_address, amount);
      
      if (!signature) {
        setBetError('Transaction failed or cancelled');
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
          bettorWallet: wallet
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setBetError(data.error || 'Failed to record bet');
        setTimeout(() => setBetError(null), 3000);
        return;
      }

      setBetSuccess(`Bet placed! ${amount} SOL on ${horse.name}`);
      setTimeout(() => setBetSuccess(null), 5000);
    } catch (error: any) {
      setBetError(error.message || 'Bet failed');
      setTimeout(() => setBetError(null), 3000);
    }
  }, [connected, wallet, currentRace, horses, sendBet]);

  useEffect(() => {
    if (lastResult && !isRacing) {
      const timer = setTimeout(() => setShowResults(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [lastResult, isRacing]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl animate-bounce mb-4">🏇</div>
          <div className="text-xl font-bold text-white/50 animate-pulse">
            Loading Race...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950/20 to-gray-950 text-white">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <header className="relative z-10 border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🏇</span>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                Solana Derby
              </h1>
              <p className="text-xs text-white/40 uppercase tracking-widest">
                Race Every 5 Minutes
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {currentRace && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                <span className="text-xs text-white/40">Race</span>
                <span className="font-mono font-bold">#{currentRace.race_number}</span>
              </div>
            )}
            <WalletConnect />
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {betError && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-center font-bold animate-shake">
            {betError}
          </div>
        )}
        
        {betSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-center font-bold">
            ✓ {betSuccess}
          </div>
        )}

        <div className="mb-8">
          <RaceTrack 
            horses={horses} 
            isRacing={isRacing}
            winningHorseId={lastResult?.winningHorseId}
            finalPositions={racePositions}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <div className="lg:col-span-1">
            <CountdownTimer 
              seconds={timeRemaining} 
              totalPool={totalPool}
            />
            
            <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
              <h3 className="text-sm font-bold text-white/40 uppercase tracking-wider mb-3">
                How to Play
              </h3>
              <ol className="space-y-2 text-sm text-white/60">
                <li className="flex gap-2">
                  <span className="text-yellow-400 font-bold">1.</span>
                  Connect your Phantom wallet
                </li>
                <li className="flex gap-2">
                  <span className="text-yellow-400 font-bold">2.</span>
                  Choose a horse and bet amount
                </li>
                <li className="flex gap-2">
                  <span className="text-yellow-400 font-bold">3.</span>
                  Send SOL to the horse's wallet
                </li>
                <li className="flex gap-2">
                  <span className="text-yellow-400 font-bold">4.</span>
                  Watch the race & collect winnings!
                </li>
              </ol>
            </div>

            <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
              <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider mb-2">
                Payout Structure
              </h3>
              <p className="text-xs text-white/50 mb-2">
                Winners split the losing pool proportionally based on bet size.
              </p>
              <div className="text-xs text-white/40">
                <span className="text-purple-400">5%</span> house fee on winnings
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black uppercase tracking-wider">
                {isRacing ? '🏁 Race in Progress!' : 'Place Your Bets'}
              </h2>
              {!isRacing && (
                <span className="text-sm text-white/40">
                  Click a horse to bet
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {horses.map((horse) => (
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
        </div>

        <footer className="text-center py-8 border-t border-white/10">
          <p className="text-white/30 text-sm">
            Powered by Solana • Wallets via{' '}
            <a 
              href="https://pumpportal.fun" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              PumpPortal
            </a>
          </p>
          <p className="text-white/20 text-xs mt-2">
            Please gamble responsibly. 18+ only.
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