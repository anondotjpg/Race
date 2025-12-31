// lib/race-engine.ts
import { createServerSupabaseClient } from './supabase';
import { sendPayout, aggregateFunds } from './solana';
import type { Bet, RaceResult } from '@/types';

const HOUSE_FEE_PERCENT = 5;
const RACE_DURATION_MS = 5 * 60 * 1000; // 5 minutes betting

// ─────────────────────────────────────────────
// PURE LOGIC
// ─────────────────────────────────────────────

export function determineWinner(
  horseBets: { horseId: number; totalBets: number }[]
): number {
  const total = horseBets.reduce((s, h) => s + h.totalBets, 0);

  // If no bets, random winner (equal chance)
  if (total === 0) {
    return horseBets[Math.floor(Math.random() * horseBets.length)].horseId;
  }

  // Direct proportional: more bets = higher chance to win
  // 75% of bets on Horse 1 = 75% chance to win
  let r = Math.random() * total;

  for (const h of horseBets) {
    r -= h.totalBets;
    if (r <= 0) return h.horseId;
  }

  return horseBets[horseBets.length - 1].horseId;
}

export function generateRacePositions(
  winnerId: number,
  horseIds: number[]
): number[] {
  const rest = horseIds.filter(id => id !== winnerId);

  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }

  return [winnerId, ...rest];
}

export function calculatePayouts(
  winnerId: number,
  bets: Bet[]
): { betId: string; wallet: string; amount: number }[] {
  const winners = bets.filter(b => b.horse_id === winnerId);
  const losers = bets.filter(b => b.horse_id !== winnerId);

  if (!winners.length) return [];

  const loserPool = losers.reduce((s, b) => s + b.amount, 0);
  const houseFee = loserPool * (HOUSE_FEE_PERCENT / 100);
  const distributable = loserPool - houseFee;

  const totalWinnerStake = winners.reduce((s, b) => s + b.amount, 0);

  return winners.map(b => ({
    betId: b.id,
    wallet: b.bettor_wallet,
    amount: b.amount + (b.amount / totalWinnerStake) * distributable,
  }));
}

// ─────────────────────────────────────────────
// EXECUTE / FINALIZE RACE
// ─────────────────────────────────────────────

export async function executeRace(
  raceId: string
): Promise<RaceResult | null> {
  const supabase = createServerSupabaseClient();

  const { data: race } = await supabase
    .from('races')
    .select('*')
    .eq('id', raceId)
    .single();

  if (!race) return null;

  // Already finished - return cached result
  if (race.status === 'finished') {
    return {
      raceId,
      winningHorseId: race.winning_horse_id,
      winningHorseName: race.winning_horse_name ?? 'Unknown',
      positions: race.final_positions ?? [],
      payouts: [],
    };
  }

  // Lock race to 'racing' status
  const { data: locked } = await supabase
    .from('races')
    .update({
      status: 'racing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', raceId)
    .in('status', ['betting', 'racing'])
    .select('status')
    .maybeSingle();

  if (!locked) return null;

  const { data: horses } = await supabase.from('horses').select('*');
  const { data: bets } = await supabase
    .from('bets')
    .select('*')
    .eq('race_id', raceId)
    .eq('status', 'confirmed');

  if (!horses || horses.length === 0) return null;

  const horseTotals = horses.map(h => ({
    horseId: h.id,
    totalBets:
      bets?.filter(b => b.horse_id === h.id)
        .reduce((s, b) => s + b.amount, 0) ?? 0,
  }));

  const winnerId = determineWinner(horseTotals);
  const winningHorse = horses.find(h => h.id === winnerId)!;

  const positions = generateRacePositions(
    winnerId,
    horses.map(h => h.id)
  );

  const payouts = calculatePayouts(winnerId, bets ?? []);

  // Update race as finished
  await supabase
    .from('races')
    .update({
      status: 'finished',
      winning_horse_id: winnerId,
      winning_horse_name: winningHorse.name,
      final_positions: positions,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', raceId)
    .eq('status', 'racing');

  // Update bet statuses
  for (const bet of bets ?? []) {
    const payout = payouts.find(p => p.betId === bet.id)?.amount ?? 0;

    await supabase
      .from('bets')
      .update({
        status: bet.horse_id === winnerId ? 'paid' : 'lost',
        payout,
      })
      .eq('id', bet.id)
      .eq('status', 'confirmed');
  }

  // Process actual payouts - aggregate funds to house wallet first
  const houseWallet = process.env.HOUSE_WALLET_ADDRESS;
  const housePrivateKey = process.env.HOUSE_WALLET_PRIVATE_KEY;
  
  if (houseWallet && housePrivateKey && payouts.length > 0) {
    // Get horse private keys for aggregation
    const { data: horsesWithKeys } = await supabase
      .from('horses')
      .select('wallet_private_key');
    
    if (horsesWithKeys) {
      const privateKeys = horsesWithKeys
        .map(h => h.wallet_private_key)
        .filter(Boolean) as string[];
      
      // Aggregate all horse wallet funds to house wallet
      await aggregateFunds(privateKeys, houseWallet);
    }
    
    // Send payouts from house wallet
    for (const p of payouts) {
      try {
        const txSignature = await sendPayout(housePrivateKey, p.wallet, p.amount);
        
        await supabase.from('payouts').insert({
          race_id: raceId,
          bet_id: p.betId,
          recipient_wallet: p.wallet,
          amount: p.amount,
          tx_signature: txSignature,
          status: txSignature ? 'sent' : 'failed',
        });
        
        if (txSignature) {
          console.log(`Payout sent: ${p.amount} SOL to ${p.wallet} - ${txSignature}`);
        }
      } catch (err) {
        console.error(`Payout failed for ${p.wallet}:`, err);
        
        await supabase.from('payouts').insert({
          race_id: raceId,
          bet_id: p.betId,
          recipient_wallet: p.wallet,
          amount: p.amount,
          status: 'failed',
        });
      }
    }
  } else {
    // No house wallet configured - just record pending payouts
    for (const p of payouts) {
      await supabase.from('payouts').insert({
        race_id: raceId,
        bet_id: p.betId,
        recipient_wallet: p.wallet,
        amount: p.amount,
        status: 'pending',
      });
    }
  }

  return {
    raceId,
    winningHorseId: winnerId,
    winningHorseName: winningHorse.name,
    positions,
    payouts: payouts.map(p => ({
      wallet: p.wallet,
      amount: p.amount,
    })),
  };
}

// ─────────────────────────────────────────────
// START NEW RACE
// ─────────────────────────────────────────────

export async function startNewRace(): Promise<string | null> {
  const supabase = createServerSupabaseClient();
  const now = Date.now();

  // Check no active race
  const { data: active } = await supabase
    .from('races')
    .select('id')
    .in('status', ['betting', 'racing'])
    .limit(1)
    .maybeSingle();

  if (active) return null;

  const { data } = await supabase
    .from('races')
    .insert({
      status: 'betting',
      started_at: new Date(now).toISOString(),
      betting_ends_at: new Date(now + RACE_DURATION_MS).toISOString(),
      total_pool: 0,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  return data?.id ?? null;
}

// ─────────────────────────────────────────────
// RECORD BET
// ─────────────────────────────────────────────

export async function recordBet(
  raceId: string,
  horseId: number,
  bettorWallet: string,
  amount: number,
  txSignature: string
): Promise<boolean> {
  const supabase = createServerSupabaseClient();

  const { data: race } = await supabase
    .from('races')
    .select('status, betting_ends_at')
    .eq('id', raceId)
    .single();

  if (!race || race.status !== 'betting') return false;
  if (new Date(race.betting_ends_at) <= new Date()) return false;

  // Check for duplicate
  const { data: existing } = await supabase
    .from('bets')
    .select('id')
    .eq('tx_signature', txSignature)
    .maybeSingle();

  if (existing) return true;

  await supabase.from('bets').insert({
    race_id: raceId,
    horse_id: horseId,
    bettor_wallet: bettorWallet,
    amount,
    tx_signature: txSignature,
    status: 'confirmed',
  });

  // Increment pool (you need this SQL function in Supabase)
  await supabase.rpc('increment_race_pool', {
    race_id_input: raceId,
    amount_input: amount,
  });

  return true;
}