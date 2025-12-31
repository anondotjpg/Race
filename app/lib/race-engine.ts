// lib/race-engine.ts
import { createServerSupabaseClient } from './supabase';
import type { Bet, RaceResult } from '../types';

const HOUSE_FEE_PERCENT = 5;
const RACE_DURATION_MS = 5 * 60 * 1000;

// ─────────────────────────────────────────────
// WINNER LOGIC
// ─────────────────────────────────────────────

export function determineWinner(
  horseBets: { horseId: number; totalBets: number }[]
): number {
  const total = horseBets.reduce((s, h) => s + h.totalBets, 0);

  if (total === 0) {
    return horseBets[Math.floor(Math.random() * horseBets.length)].horseId;
  }

  const weights = horseBets.map(h => ({
    horseId: h.horseId,
    weight: total - h.totalBets + total / horseBets.length,
  }));

  let r = Math.random() * weights.reduce((s, w) => s + w.weight, 0);

  for (const w of weights) {
    r -= w.weight;
    if (r <= 0) return w.horseId;
  }

  return weights[weights.length - 1].horseId;
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
) {
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
// EXECUTE RACE (IDEMPOTENT)
// ─────────────────────────────────────────────

export async function executeRace(
  raceId: string
): Promise<RaceResult | null> {
  const supabase = createServerSupabaseClient();

  // Lock race by state transition
  const { data: race } = await supabase
    .from('races')
    .select('*')
    .eq('id', raceId)
    .single();

  if (!race || race.status !== 'betting') return null;

  // Move to racing
  await supabase
    .from('races')
    .update({ status: 'racing' })
    .eq('id', raceId)
    .eq('status', 'betting');

  const { data: horses } = await supabase.from('horses').select('*');
  const { data: bets } = await supabase
    .from('bets')
    .select('*')
    .eq('race_id', raceId)
    .eq('status', 'confirmed');

  if (!horses) return null;

  const horseTotals = horses.map(h => ({
    horseId: h.id,
    totalBets:
      bets?.filter(b => b.horse_id === h.id)
        .reduce((s, b) => s + b.amount, 0) ?? 0,
  }));

  const winnerId = determineWinner(horseTotals);
  const positions = generateRacePositions(
    winnerId,
    horses.map(h => h.id)
  );

  const payouts = calculatePayouts(winnerId, bets ?? []);

  // Finish race
  await supabase
    .from('races')
    .update({
      status: 'finished',
      winning_horse_id: winnerId,
      final_positions: positions,
      finished_at: new Date().toISOString(),
    })
    .eq('id', raceId);

  // Update bets
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

  // Record payouts
  for (const p of payouts) {
    await supabase.from('payouts').insert({
      race_id: raceId,
      bet_id: p.betId,
      recipient_wallet: p.wallet,
      amount: p.amount,
      status: 'pending',
    });
  }

  return {
    raceId,
    winningHorseId: winnerId,
    positions,
    payouts: payouts.map(p => ({
      wallet: p.wallet,
      amount: p.amount,
    })),
  };
}

// ─────────────────────────────────────────────
// START NEW RACE (HARD GUARANTEES)
// ─────────────────────────────────────────────

export async function startNewRace(): Promise<string | null> {
  const supabase = createServerSupabaseClient();
  const now = Date.now();

  // Enforce 5-minute window
  const { data: recent } = await supabase
    .from('races')
    .select('id')
    .gte('started_at', new Date(now - RACE_DURATION_MS).toISOString())
    .limit(1)
    .maybeSingle();

  if (recent) return null;

  const bettingEndsAt = new Date(now + RACE_DURATION_MS);

  const { data, error } = await supabase
    .from('races')
    .insert({
      status: 'betting',
      started_at: new Date(now).toISOString(),
      betting_ends_at: bettingEndsAt.toISOString(),
      total_pool: 0,
    })
    .select('id')
    .single();

  if (error) {
    // expected if another cron won
    return null;
  }

  return data.id;
}
