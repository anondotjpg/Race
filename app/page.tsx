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
  
  const { wallet, connected } = useWallet();
  
  const [showResults, setShowResults] = useState(false);
  const [betError, setBetError] = useState<string | null>(null);
  const [betSuccess, setBetSuccess] = useState<string | null>(null);

  const handleBet = async (horseId: number, amount: number) => {
    console.log('handleBet called:', { horseId, amount });
    
    // Get Phantom directly from window
    const win = window as any;
    const phantom = win.phantom?.solana || win.solana;
    
    console.log('Phantom check:', { 
      hasPhantom: !!phantom, 
      isConnected: phantom?.isConnected, 
      hasPublicKey: !!phantom?.publicKey 
    });
    
    if (!phantom?.isConnected || !phantom?.publicKey) {
      console.log('Not connected, showing error');
      setBetError('Please connect your wallet first');
      setTimeout(() => setBetError(null), 3000);
      return;
    }
    
    console.log('Wallet connected, checking race...');

    if (!currentRace) {
      console.log('No current race');
      setBetError('No active race');
      setTimeout(() => setBetError(null), 3000);
      return;
    }

    const horse = horses.find(h => h.id === horseId);
    if (!horse) {
      console.log('Horse not found');
      setBetError('Horse not found');
      setTimeout(() => setBetError(null), 3000);
      return;
    }

    console.log('Placing bet for horse:', horse.name, 'wallet:', horse.wallet_address);
    
    setBetError(null);
    setBetSuccess(null);

    try {
      // Import required classes
      const { PublicKey, Transaction, SystemProgram, Connection, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
      
      const currentWallet = phantom.publicKey.toBase58();
      const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
      
      console.log('Creating transaction...', { from: currentWallet, to: horse.wallet_address, amount });
      
      const connection = new Connection(rpcUrl, 'confirmed');
      const fromPubkey = new PublicKey(currentWallet);
      const toPubkey = new PublicKey(horse.wallet_address);
      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
      
      console.log('Getting blockhash...');
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      console.log('Got blockhash:', blockhash);
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports,
        })
      );
      
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;
      
      console.log('Requesting Phantom signature...');
      const { signature } = await phantom.signAndSendTransaction(transaction);
      console.log('Transaction sent:', signature);
      
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
      console.error('Bet error:', error);
      if (error?.message?.includes('User rejected')) {
        setBetError('Transaction cancelled');
      } else {
        const msg = error?.message || 'Bet failed';
        setBetError(msg.length > 50 ? msg.slice(0, 50) + '...' : msg);
      }
      setTimeout(() => setBetError(null), 5000);
    }
  };

  useEffect(() => {
    if (lastResult && !isRacing) {
      const timer = setTimeout(() => setShowResults(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [lastResult, isRacing]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading race...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <span className="text-xl">🏇</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Solana Derby</h1>
                {currentRace && (
                  <p className="text-xs text-gray-500">Race #{currentRace.race_number}</p>
                )}
              </div>
            </div>
            <WalletConnect />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Alerts */}
        {betError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <span className="text-red-500">⚠️</span>
            <p className="text-red-700 text-sm font-medium">{betError}</p>
          </div>
        )}
        
        {betSuccess && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
            <span className="text-green-500">✓</span>
            <p className="text-green-700 text-sm font-medium">Bet placed: {betSuccess}</p>
          </div>
        )}

        {/* Timer & Stats Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <CountdownTimer seconds={timeRemaining} totalPool={totalPool} />
          
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">Total Pool</p>
            <p className="text-2xl font-bold text-gray-900">{totalPool.toFixed(3)} <span className="text-base font-normal text-gray-400">SOL</span></p>
          </div>
          
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">Horses</p>
            <p className="text-2xl font-bold text-gray-900">{horses.length} <span className="text-base font-normal text-gray-400">competing</span></p>
          </div>
        </div>

        {/* Race Track */}
        <RaceTrack 
          horses={horses} 
          isRacing={isRacing}
          winningHorseId={lastResult?.winningHorseId}
          finalPositions={racePositions}
        />

        {/* Horses Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Place Your Bets</h2>
            <p className="text-sm text-gray-500">
              {isRacing ? 'Race in progress...' : 'Select a horse to bet'}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

        {/* Footer */}
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