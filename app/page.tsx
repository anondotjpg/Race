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
import toast, { Toaster } from 'react-hot-toast'; // Import Toast

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

  // Define the retro toast style
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
          <img src="/load.gif" alt="Loading" className="w-[30vmin] h-[30vmin] pixelated" style={{ filter: `drop-shadow(0 0 10px rgba(26, 255, 0, 0.9)) drop-shadow(0 0 30px rgba(26, 255, 0, 0.5))` }} />
        </div>
      </div>
    );
  }

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
        id: loadingToast, // Replace loading toast
        style: toastStyle,
        icon: '🐎'
      });

    } catch (error: any) {
      toast.dismiss(loadingToast);
      const msg = error?.message?.includes('User rejected') ? 'Cancelled' : 'Bet Failed';
      toast.error(msg, { style: errorStyle });
    }
  };  

  return (
    <div className="min-h-screen bg-black font-mono uppercase tracking-tight text-[#1aff00]">
      {/* TOAST CONTAINER */}
      <Toaster position="top-right" reverseOrder={false} />

      <div className="fixed inset-0 pointer-events-none opacity-10 z-[5] bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[length:100%_4px]" />

      <header className="sticky top-0 z-40 bg-black border-b-4 border-[#555]">
        <div className="max-w-7xl mx-auto px-4 py-3 grid grid-cols-3 items-center">
          <div className="flex items-center">
            <img src="/load.gif" alt="Logo" className="h-10 w-auto pixelated" style={{ filter: `drop-shadow(0 0 2px rgba(26, 255, 0, 0.6))` }} />
          </div>
          <div className="text-center text-sm drop-shadow-[0_0_5px_rgba(26,255,0,0.5)]">
            {currentRace ? `RACE #${currentRace.race_number}` : 'NO ACTIVE RACE'}
          </div>
          <div className="flex justify-end">
            <WalletConnect />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <CountdownTimer seconds={timeRemaining} totalPool={totalPool} />
          <div className="lg:col-span-2">
            <BetMarquee bets={recentBets} horses={horses} />
          </div>
        </div>

        <RaceTrack
          horses={horses}
          isRacing={isRacing}
          winningHorseId={lastResult?.winningHorseId}
          finalPositions={racePositions}
        />

        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="text-lg text-[#1aff00] drop-shadow-[0_0_8px_rgba(26,255,0,0.4)]">PLACE YOUR BETS</div>
            <div className="text-[10px] text-[#7CFF7C]">{isRacing ? 'RACE IN PROGRESS' : 'BETTING OPEN'}</div>
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