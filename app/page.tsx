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
import toast, { Toaster } from 'react-hot-toast';

export default function Home() {
  const { 
    currentRace, horses, timeRemaining, isRacing, 
    lastResult, totalPool, racePositions, recentBets, loading 
  } = useGameState();
  
  const { wallet } = useWallet();
  const [showResults, setShowResults] = useState(false);
  const [lastShownResultId, setLastShownResultId] = useState<string | null>(null);

  // Retro UI Toast Styles
  const toastStyle = {
    borderRadius: '0px',
    background: '#000',
    color: '#1aff00',
    border: '4px solid #1aff00',
    fontFamily: 'monospace',
    textTransform: 'uppercase' as const,
    fontSize: '12px',
    boxShadow: '0 0 15px rgba(26,255,0,0.2)',
  };

  const errorStyle = {
    ...toastStyle,
    color: '#ff4444',
    border: '4px solid #ff4444',
    boxShadow: '0 0 15px rgba(239,68,68,0.2)',
  };

  /**
   * TRIGGER RESULTS MODAL
   * Waits 8.5 seconds (Animation = 8s + 0.5s pause).
   * This ensures horses cross the finish line before the modal pops up.
   */
  useEffect(() => {
    if (lastResult && !isRacing && lastResult.raceId !== lastShownResultId) {
      const t = setTimeout(() => {
        setShowResults(true);
        setLastShownResultId(lastResult.raceId);
      }, 8500); 
      return () => clearTimeout(t);
    }
  }, [lastResult, isRacing, lastShownResultId]);

  /**
   * AUTO-HIDE MODAL & CLEANUP
   * Closes the results window when the next betting round officially starts.
   */
  useEffect(() => {
    if (timeRemaining > 0 && showResults) {
      setShowResults(false);
    }
  }, [timeRemaining, showResults]);

  /**
   * TRANSACTION HANDLER
   */
  const handleBet = async (horseId: number, amount: number) => {
    const win = window as any;
    const phantom = win.phantom?.solana || win.solana;
  
    if (!phantom?.isConnected || !phantom?.publicKey) {
      toast.error('Connect Wallet First', { style: errorStyle });
      return;
    }
  
    const horse = horses.find(h => h.id === horseId);
    const loadingToast = toast.loading('Processing Transaction...', { style: toastStyle });
  
    try {
      const { PublicKey, Transaction, SystemProgram, Connection, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
  
      const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
      const connection = new Connection(rpcUrl, 'confirmed');
      const fromPubkey = new PublicKey(phantom.publicKey.toBase58());
      const toPubkey = new PublicKey(horse!.wallet_address);
      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
  
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      const transaction = new Transaction().add(SystemProgram.transfer({ fromPubkey, toPubkey, lamports }));
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;
  
      const { signature } = await phantom.signAndSendTransaction(transaction);
  
      const res = await fetch('/api/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raceId: currentRace?.id,
          horseId,
          txSignature: signature,
          bettorWallet: phantom.publicKey.toBase58(),
        }),
      });
  
      if (!res.ok) throw new Error('Failed to record bet');

      toast.success(`Bet Placed: ${amount} SOL on ${horse?.name}`, { 
        id: loadingToast, 
        style: toastStyle,
        icon: '🐎'
      });

    } catch (error: any) {
      toast.dismiss(loadingToast);
      const msg = error?.message?.includes('User rejected') ? 'Cancelled' : 'Bet Failed';
      toast.error(msg, { style: errorStyle });
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
        <img src="/load.gif" alt="Loading" className="w-[20vmin] pixelated" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black font-mono uppercase tracking-tight text-[#1aff00]">
      <Toaster position="top-right" reverseOrder={false} />

      {/* CRT Scanline Effect */}
      <div className="fixed inset-0 pointer-events-none opacity-10 z-[5] bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[length:100%_4px]" />

      <header className="sticky top-0 z-40 bg-black border-b-4 border-[#555] px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <img src="/load.gif" alt="Logo" className="h-8 pixelated" />
          <div className="text-xs sm:text-sm font-bold">
            {currentRace ? `RACE #${currentRace.race_number}` : 'INITIALIZING...'}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <a href="https://twitter.com" target="_blank" rel="noreferrer" className="hover:scale-110 transition-transform">
             <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#1aff00]"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg>
          </a>
          <WalletConnect />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <CountdownTimer seconds={timeRemaining} totalPool={totalPool} />
          <div className="lg:col-span-2">
            <BetMarquee horses={horses} bets={recentBets} />
          </div>
        </div>

        {/* The Track with synchronized Reset Logic */}
        <RaceTrack
          horses={horses}
          isRacing={isRacing}
          winningHorseId={lastResult?.winningHorseId}
          finalPositions={racePositions}
          timeRemaining={timeRemaining}
        />

        <div className="space-y-4">
          <div className="text-lg drop-shadow-[0_0_8px_rgba(26,255,0,0.4)]">
            {isRacing ? "RACE IN PROGRESS..." : "SELECT YOUR CHAMPION"}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {horses.map(horse => (
              <HorseCard
                key={horse.id}
                horse={horse}
                onBet={handleBet}
                disabled={isRacing || timeRemaining === 0}
                isWinner={lastResult?.winningHorseId === horse.id && !isRacing}
              />
            ))}
          </div>
        </div>
      </main>

      <footer className="text-center py-8 border-t-4 border-[#555] text-[10px] opacity-60">
        NETWORK: SOLANA MAINNET • PROVABLY FAIR RACES
      </footer>

      {/* WINNER MODAL */}
      {showResults && lastResult && (
        <ResultsModal
          result={lastResult}
          horses={horses}
          userWallet={wallet?.toString()}
          onClose={() => setShowResults(false)}
        />
      )}
    </div>
  );
}