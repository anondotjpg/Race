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
  const [lastShownResultId, setLastShownResultId] = useState<string | null>(null);
  const [isVisualizing, setIsVisualizing] = useState(false);

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

  useEffect(() => {
    if (isRacing) setIsVisualizing(true);
  }, [isRacing]);

  useEffect(() => {
    if (lastResult && !isRacing && lastResult.raceId !== lastShownResultId) {
      const t = setTimeout(() => {
        setShowResults(true);
        setLastShownResultId(lastResult.raceId);
        setIsVisualizing(false); 
      }, 8500); 
      return () => clearTimeout(t);
    }
  }, [lastResult, isRacing, lastShownResultId]);

  useEffect(() => {
    if (isRacing && showResults) setShowResults(false);
  }, [isRacing, showResults]);

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
      <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden">
        {/* Subtle, soft glow for main loader */}
        <img 
          src="/load.gif" 
          alt="Loading" 
          className="w-[30vmin] pixelated drop-shadow-[0_0_12px_rgba(26,255,0,0.3)] opacity-90" 
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black font-mono uppercase tracking-tight text-[#1aff00]">
      <Toaster position="top-right" reverseOrder={false} />
      <div className="fixed inset-0 pointer-events-none opacity-10 z-[5] bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[length:100%_4px]" />

      <header className="sticky top-0 z-40 bg-black">
        <div className="max-w-7xl mx-auto px-4 py-3 grid grid-cols-3 items-center">
          <div className="flex items-center">
            {/* Very subtle glow for logo */}
            <img 
              src="/load.gif" 
              alt="Logo" 
              className="h-12 w-auto pixelated drop-shadow-[0_0_8px_rgba(26,255,0,0.4)]" 
            />
          </div>
          <div className="text-center text-sm drop-shadow-[0_0_5px_rgba(26,255,0,0.2)] font-semibold invisible md:visible">
            {currentRace ? `RACE #${currentRace.race_number}` : 'NO ACTIVE RACE'}
          </div>
          <div className="flex justify-end items-center gap-6">
            <a href="https://x.com/derbydegen" target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity">
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#1aff00]">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
              </svg>
            </a>
            <WalletConnect />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6 relative z-10">
        
        <div className="flex flex-col lg:flex-row gap-4 items-stretch">
          <div className={`lg:w-1/3 flex ${isVisualizing ? "opacity-20 grayscale pointer-events-none transition-all" : "transition-all"}`}>
            <div className="w-full flex flex-col h-32 md:h-full">
               <CountdownTimer seconds={timeRemaining} totalPool={totalPool} />
            </div>
          </div>
          
          <div className="lg:w-2/3 flex">
            <div className="w-full flex flex-col h-full">
              <BetMarquee bets={recentBets} horses={horses} />
            </div>
          </div>
        </div>

        <RaceTrack
          horses={horses}
          isRacing={isRacing}
          winningHorseId={lastResult?.winningHorseId}
          finalPositions={racePositions} 
          timeRemaining={timeRemaining}
        />

        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="text-lg text-[#1aff00] drop-shadow-[0_0_8px_rgba(26,255,0,0.4)]">
              {isVisualizing ? "RACE IN PROGRESS" : "PLACE YOUR BETS"}
            </div>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 transition-all ${isVisualizing ? "opacity-40 grayscale pointer-events-none" : ""}`}>
            {horses.map(horse => (
              <HorseCard
                key={horse.id}
                horse={horse}
                onBet={handleBet}
                disabled={isVisualizing || isRacing || timeRemaining === 0}
                isWinner={lastResult?.winningHorseId === horse.id && !isVisualizing}
              />
            ))}
          </div>
        </div>

        <footer className="text-center py-6 text-[10px] text-[#7CFF7C]">
          BUILT ON SOLANA • ON-CHAIN HORSE RACES
        </footer>
      </main>

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