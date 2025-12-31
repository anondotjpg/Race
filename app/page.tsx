'use client';

import { useState, useEffect, useRef } from 'react';
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
    loading,
  } = useGameState();

  const { wallet } = useWallet();

  const [showResults, setShowResults] = useState(false);
  const [betError, setBetError] = useState<string | null>(null);
  const [betSuccess, setBetSuccess] = useState<string | null>(null);

  const resultShownForRace = useRef<string | null>(null);

  // ─────────────────────────────────────────────
  // BET HANDLER (SAFE + GUARDED)
  // ─────────────────────────────────────────────

  const handleBet = async (horseId: number, amount: number) => {
    const phantom = (window as any)?.phantom?.solana;

    if (!phantom?.isConnected || !phantom?.publicKey) {
      setBetError('Connect your wallet first');
      setTimeout(() => setBetError(null), 3000);
      return;
    }

    if (!currentRace || isRacing || timeRemaining <= 0) {
      setBetError('Betting is closed');
      setTimeout(() => setBetError(null), 3000);
      return;
    }

    const horse = horses.find(h => h.id === horseId);
    if (!horse) return;

    try {
      const {
        PublicKey,
        Transaction,
        SystemProgram,
        Connection,
        LAMPORTS_PER_SOL,
      } = await import('@solana/web3.js');

      const from = phantom.publicKey;
      const to = new PublicKey(horse.wallet_address);
      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

      const rpc =
        process.env.NEXT_PUBLIC_SOLANA_RPC ??
        'https://api.mainnet-beta.solana.com';

      const connection = new Connection(rpc, 'confirmed');
      const { blockhash } = await connection.getLatestBlockhash();

      const tx = new Transaction({
        feePayer: from,
        recentBlockhash: blockhash,
      }).add(
        SystemProgram.transfer({
          fromPubkey: from,
          toPubkey: to,
          lamports,
        })
      );

      const { signature } = await phantom.signAndSendTransaction(tx);

      if (!signature) throw new Error('Transaction cancelled');

      const res = await fetch('/api/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raceId: currentRace.id,
          horseId,
          bettorWallet: from.toBase58(),
          txSignature: signature,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Bet failed');

      setBetSuccess(`${amount} SOL on ${horse.name}`);
      setTimeout(() => setBetSuccess(null), 4000);
    } catch (err: any) {
      setBetError(err?.message ?? 'Bet failed');
      setTimeout(() => setBetError(null), 4000);
    }
  };

  // ─────────────────────────────────────────────
  // SHOW RESULTS ONCE PER RACE
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (!lastResult || isRacing) return;

    if (resultShownForRace.current === lastResult.raceId) return;

    resultShownForRace.current = lastResult.raceId;

    const t = setTimeout(() => setShowResults(true), 900);
    return () => clearTimeout(t);
  }, [lastResult, isRacing]);

  // ─────────────────────────────────────────────
  // RESET RESULTS WHEN NEW RACE STARTS
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (currentRace?.id !== resultShownForRace.current) {
      setShowResults(false);
    }
  }, [currentRace?.id]);

  // ─────────────────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-gray-300 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  const bettingClosed = isRacing || timeRemaining <= 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
              🏇
            </div>
            <div>
              <h1 className="font-bold">Solana Derby</h1>
              {currentRace && (
                <p className="text-xs text-gray-500">
                  Race #{currentRace.race_number}
                </p>
              )}
            </div>
          </div>
          <WalletConnect />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* ALERTS */}
        {betError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            ⚠️ {betError}
          </div>
        )}

        {betSuccess && (
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            ✓ Bet placed: {betSuccess}
          </div>
        )}

        {/* TIMER */}
        <CountdownTimer seconds={timeRemaining} totalPool={totalPool} />

        {/* TRACK */}
        <RaceTrack
          horses={horses}
          isRacing={isRacing}
          winningHorseId={lastResult?.winningHorseId}
          finalPositions={racePositions}
        />

        {/* BETTING */}
        <div>
          <h2 className="font-semibold mb-2">Place Your Bets</h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {horses.map(h => (
              <HorseCard
                key={h.id}
                horse={h}
                onBet={handleBet}
                disabled={bettingClosed}
                isWinner={lastResult?.winningHorseId === h.id}
              />
            ))}
          </div>
        </div>

        <footer className="text-center text-sm text-gray-400 py-6">
          Races every 5 minutes • Powered by Solana
        </footer>
      </main>

      {/* RESULTS */}
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
