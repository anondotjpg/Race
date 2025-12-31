import { createServerSupabaseClient } from './supabase';
import type { Bet, RaceResult } from '../types';

const HOUSE_FEE_PERCENT = 5;
const RACE_DURATION_MS = 5 * 60 * 1000;

// ─────────────────────────────────────────────
// PURE WINNER LOGIC (DETERMINISTIC PER EXECUTION)
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
// EXECUTE / FINALIZE RACE (IDEMPOTENT + SAFE)
// ─────────────────────────────────────────────

export async function executeRace(
  raceId: string
): Promise<RaceResult | null> {
  const supabase = createServerSupabaseClient();

  // 1️⃣ Load race
  const { data: race } = await supabase
    .from('races')
    .select('*')
    .eq('id', raceId)
    .single();

  if (!race) return null;

  // 2️⃣ If already finished → return immutable result
  if (race.status === 'finished' && race.winning_horse_id) {
    return {
      raceId,
      winningHorseId: race.winning_horse_id,
      winningHorseName: race.winning_horse_name ?? 'Unknown',
      positions: race.final_positions ?? [],
      payouts: [],
    };
  }

  // 3️⃣ LOCK PHASE (only from betting)
  if (race.status === 'betting') {
    const { data: locked } = await supabase
      .from('races')
      .update({
        status: 'racing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', raceId)
      .eq('status', 'betting')
      .select('id')
      .maybeSingle();

    // Another cron locked it
    if (!locked) return null;
  }

  // ⛔ If not racing at this point, do nothing
  if (race.status !== 'racing' && race.status !== 'betting') {
    return null;
  }

  // 4️⃣ Fetch horses + bets AFTER lock
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

  // 5️⃣ COMPUTE WINNER (EXACTLY ONCE)
  const winnerId = determineWinner(horseTotals);
  const winningHorse = horses.find(h => h.id === winnerId)!;

  const positions = generateRacePositions(
    winnerId,
    horses.map(h => h.id)
  );

  const payouts = calculatePayouts(winnerId, bets ?? []);

  // 6️⃣ FINALIZE RACE (IMMUTABLE)
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

  // 7️⃣ Update bets
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

  // 8️⃣ Record payouts (idempotent-safe)
  for (const p of payouts) {
    await supabase.from('payouts').insert({
      race_id: raceId,
      bet_id: p.betId,
      recipient_wallet: p.wallet,
      amount: p.amount,
      status: 'pending',
    });
  }

  // 9️⃣ Return stable result
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
// START NEW RACE (HARD 5-MIN GUARANTEE)
// ─────────────────────────────────────────────

export async function startNewRace(): Promise<string | null> {
  const supabase = createServerSupabaseClient();
  const now = Date.now();

  const { data: recent } = await supabase
    .from('races')
    .select('id')
    .gte('started_at', new Date(now - RACE_DURATION_MS).toISOString())
    .limit(1)
    .maybeSingle();

  if (recent) return null;

  const { data } = await supabase
    .from('races')
    .insert({
      status: 'betting',
      started_at: new Date(now).toISOString(),
      betting_ends_at: new Date(now + RACE_DURATION_MS).toISOString(),
      total_pool: 0,
    })
    .select('id')
    .single();

  return data?.id ?? null;
}
