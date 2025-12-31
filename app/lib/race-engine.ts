// lib/race-engine.ts
import { createServerSupabaseClient } from './supabase';
import { sendPayout, aggregateFunds, getWalletBalance } from './solana';
import type { Bet, RaceResult } from '../types';

const HOUSE_FEE_PERCENT = 7;
const RACE_DURATION_MS = 5 * 60 * 1000; // 5 minutes betting
const MIN_RENT_SOL = 0.001; // Minimum to keep in wallet

// ─────────────────────────────────────────────
// PURE LOGIC
// ─────────────────────────────────────────────

export function determineWinner(
  horseBets: { horseId: number; totalBets: number }[]
): number {
  const total = horseBets.reduce((s, h) => s + h.totalBets, 0);

  if (total === 0) {
    return horseBets[Math.floor(Math.random() * horseBets.length)].horseId;
  }

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
// EXECUTE / FINALIZE RACE (WITH ATOMIC LOCK)
// ─────────────────────────────────────────────

export async function executeRace(
  raceId: string
): Promise<RaceResult | null> {
  const supabase = createServerSupabaseClient();

  // ATOMIC: Try to claim the race by setting status to 'executing'
  // This prevents duplicate execution from Client + Vercel cron
  const { data: claimed, error: claimError } = await supabase
    .from('races')
    .update({ 
      status: 'executing',
      updated_at: new Date().toISOString()
    })
    .eq('id', raceId)
    .eq('status', 'betting')  // Only if still in betting
    .select()
    .single();

  if (claimError || !claimed) {
    // Race already being executed or finished
    console.log('[Race] Already executing/finished, skipping');
    
    // Check if already finished - return cached result
    const { data: race } = await supabase
      .from('races')
      .select('*')
      .eq('id', raceId)
      .single();
      
    if (race?.status === 'finished' && race.winning_horse_id) {
      return {
        raceId,
        winningHorseId: race.winning_horse_id,
        winningHorseName: race.winning_horse_name ?? 'Unknown',
        positions: race.final_positions ?? [],
        payouts: [],
      };
    }
    return null;
  }

  console.log('[Race] Claimed race for execution:', raceId);

  const { data: horses } = await supabase.from('horses').select('*');
  const { data: bets } = await supabase
    .from('bets')
    .select('*')
    .eq('race_id', raceId)
    .eq('status', 'confirmed');

  if (!horses || horses.length === 0) {
    // Rollback status
    await supabase.from('races').update({ status: 'betting' }).eq('id', raceId);
    return null;
  }

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

  // Update race to finished
  const { error: updateError } = await supabase
    .from('races')
    .update({
      status: 'finished',
      winning_horse_id: winnerId,
      winning_horse_name: winningHorse.name,
      final_positions: positions,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', raceId);

  if (updateError) {
    console.error('Failed to update race:', updateError);
    return null;
  }

  // Update bet statuses
  for (const bet of bets ?? []) {
    const payout = payouts.find(p => p.betId === bet.id)?.amount ?? 0;

    await supabase
      .from('bets')
      .update({
        status: bet.horse_id === winnerId ? 'paid' : 'lost',
        payout,
      })
      .eq('id', bet.id);
  }

  // House Wallet Payouts
  const houseWallet = process.env.HOUSE_WALLET_ADDRESS;
  const housePrivateKey = process.env.HOUSE_WALLET_PRIVATE_KEY;

  if (houseWallet && housePrivateKey && payouts.length > 0) {
    try {
      // Get all horse private keys
      const { data: horsesWithKeys } = await supabase
        .from('horses')
        .select('wallet_private_key');

      if (horsesWithKeys) {
        const privateKeys = horsesWithKeys
          .map(h => h.wallet_private_key)
          .filter(Boolean) as string[];

        // Aggregate: Horse Wallets → House Wallet
        const aggregated = await aggregateFunds(privateKeys, houseWallet);
        console.log(`Aggregated ${aggregated} SOL to house wallet`);
      }

      // Check house wallet balance before payouts
      const houseBalance = await getWalletBalance(houseWallet);
      const totalPayouts = payouts.reduce((s, p) => s + p.amount, 0);
      
      console.log(`House balance: ${houseBalance} SOL, Total payouts: ${totalPayouts} SOL`);

      if (houseBalance < totalPayouts + MIN_RENT_SOL) {
        console.error(`Insufficient house balance for payouts!`);
        // Record as pending
        for (const p of payouts) {
          await supabase.from('payouts').insert({
            race_id: raceId,
            bet_id: p.betId,
            recipient_wallet: p.wallet,
            amount: p.amount,
            status: 'pending',
          });
        }
      } else {
        // Send payouts from House Wallet → Winners
        for (const p of payouts) {
          // Check remaining balance before each payout
          const currentBalance = await getWalletBalance(houseWallet);
          if (currentBalance < p.amount + MIN_RENT_SOL) {
            console.error(`Insufficient balance for payout: ${currentBalance} < ${p.amount}`);
            await supabase.from('payouts').insert({
              race_id: raceId,
              bet_id: p.betId,
              recipient_wallet: p.wallet,
              amount: p.amount,
              status: 'pending',
            });
            continue;
          }

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
              console.log(`Payout sent: ${p.amount} SOL to ${p.wallet}`);
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
      }
    } catch (err) {
      console.error('Payout process failed:', err);
    }
  } else if (payouts.length > 0) {
    console.log('No house wallet configured, recording payouts as pending');
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

  // Check for any active race (betting or executing)
  const { data: active } = await supabase
    .from('races')
    .select('id, status')
    .in('status', ['betting', 'executing'])
    .limit(1)
    .maybeSingle();

  if (active) {
    console.log('[startNewRace] Active race exists:', active.id, active.status);
    return null;
  }

  console.log('[startNewRace] Creating new race...');

  const { data, error: insertError } = await supabase
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

  if (insertError) {
    console.error('[startNewRace] Insert error:', insertError);
    return null;
  }

  console.log('[startNewRace] Created race:', data?.id);
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

  const { error } = await supabase.from('bets').insert({
    race_id: raceId,
    horse_id: horseId,
    bettor_wallet: bettorWallet,
    amount,
    tx_signature: txSignature,
    status: 'confirmed',
  });

  if (error) {
    console.error('Failed to insert bet:', error);
    return false;
  }

  return true;
}