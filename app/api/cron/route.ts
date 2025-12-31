// app/api/cron/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';
import { executeRace, startNewRace } from '@/app/lib/race-engine';
import { connection } from '@/app/lib/solana';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s execution (Vercel Pro) or 10s (Hobby)

// Configuration - adjust based on your Vercel plan
const LOOP_ITERATIONS = 5;   // Run 5 times per cron call
const LOOP_DELAY_MS = 10000; // 10 seconds between each = ~50s total

// Helper to sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Monitor horse wallets for direct deposits
async function checkDirectDeposits(supabase: any, raceId: string, bettingEndsAt: string) {
  let recorded = 0;

  try {
    const { data: horses } = await supabase
      .from('horses')
      .select('id, name, wallet_address');

    if (!horses) return 0;

    for (const horse of horses) {
      try {
        const signatures = await connection.getSignaturesForAddress(
          new PublicKey(horse.wallet_address),
          { limit: 10 }
        );

        for (const sigInfo of signatures) {
          // Check if already recorded
          const { data: existing } = await supabase
            .from('bets')
            .select('id')
            .eq('tx_signature', sigInfo.signature)
            .maybeSingle();

          if (existing) continue;

          const tx = await connection.getTransaction(sigInfo.signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
          });

          if (!tx || !tx.meta) continue;

          const accountKeys = tx.transaction.message.staticAccountKeys;
          const horseIndex = accountKeys?.findIndex(
            key => key.toBase58() === horse.wallet_address
          );

          if (horseIndex === undefined || horseIndex === -1) continue;

          const preBalance = tx.meta.preBalances[horseIndex] || 0;
          const postBalance = tx.meta.postBalances[horseIndex] || 0;
          const amount = (postBalance - preBalance) / LAMPORTS_PER_SOL;

          if (amount <= 0) continue;

          const sender = accountKeys?.[0]?.toBase58() || '';
          if (!sender) continue;

          // Check if within betting period
          const txTime = sigInfo.blockTime ? sigInfo.blockTime * 1000 : Date.now();
          const bettingEnds = new Date(bettingEndsAt).getTime();
          
          if (txTime > bettingEnds) continue;

          // Record bet
          const { error } = await supabase.from('bets').insert({
            race_id: raceId,
            horse_id: horse.id,
            bettor_wallet: sender,
            amount,
            tx_signature: sigInfo.signature,
            status: 'confirmed',
          });

          if (!error) {
            recorded++;
            console.log(`[CRON] Direct deposit: ${amount} SOL on ${horse.name} from ${sender.slice(0, 10)}...`);
          }
        }
      } catch (err) {
        // Silent fail per horse
      }
    }
  } catch (err) {
    console.error('[CRON] Monitor error:', err);
  }

  return recorded;
}

// Single iteration of race check
async function runIteration(supabase: any, iteration: number) {
  const nowIso = new Date().toISOString();
  let executed = 0;
  let startedRaceId: string | null = null;
  let directDeposits = 0;

  console.log(`[CRON] ── Iteration ${iteration + 1}/${LOOP_ITERATIONS} @ ${new Date().toISOString()} ──`);

  // 1. Check for expired betting races
  const { data: expiredRaces, error: expiredError } = await supabase
    .from('races')
    .select('id, status, betting_ends_at')
    .eq('status', 'betting')
    .lt('betting_ends_at', nowIso);

  if (expiredError) {
    console.error('[CRON] Query error:', expiredError);
  }

  if (expiredRaces?.length) {
    console.log(`[CRON] Found ${expiredRaces.length} expired race(s)`);
  }

  // Execute expired races (check deposits FIRST!)
  for (const race of expiredRaces ?? []) {
    const depositsFound = await checkDirectDeposits(supabase, race.id, race.betting_ends_at);
    directDeposits += depositsFound;
    
    console.log(`[CRON] Executing race: ${race.id}`);
    const result = await executeRace(race.id);
    if (result) {
      console.log(`[CRON] ✓ Winner: ${result.winningHorseName}`);
      executed++;
    }
  }

  // 2. Check for active betting race
  const { data: activeRace } = await supabase
    .from('races')
    .select('id, status, betting_ends_at')
    .eq('status', 'betting')
    .maybeSingle();

  // Monitor active race for deposits
  if (activeRace) {
    const activeDeposits = await checkDirectDeposits(supabase, activeRace.id, activeRace.betting_ends_at);
    directDeposits += activeDeposits;
    if (activeDeposits > 0) {
      console.log(`[CRON] Recorded ${activeDeposits} deposit(s)`);
    }
  }

  // 3. Start new race if none active
  if (!activeRace) {
    console.log('[CRON] No active race, starting new...');
    startedRaceId = await startNewRace();
    if (startedRaceId) {
      console.log(`[CRON] ✓ Started race: ${startedRaceId}`);
    }
  }

  return { executed, startedRaceId, directDeposits };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🕒 [CRON] Loop started at:', new Date().toISOString());
  console.log(`[CRON] Will run ${LOOP_ITERATIONS} iterations, ${LOOP_DELAY_MS}ms apart`);

  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('[CRON] ❌ Unauthorized');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();

  let totalExecuted = 0;
  let totalDeposits = 0;
  let lastStartedRace: string | null = null;
  let completedIterations = 0;

  try {
    // Run multiple iterations with delays
    for (let i = 0; i < LOOP_ITERATIONS; i++) {
      try {
        const result = await runIteration(supabase, i);
        
        totalExecuted += result.executed;
        totalDeposits += result.directDeposits;
        if (result.startedRaceId) lastStartedRace = result.startedRaceId;
        completedIterations++;

        // Don't sleep after last iteration
        if (i < LOOP_ITERATIONS - 1) {
          await sleep(LOOP_DELAY_MS);
        }
      } catch (iterError) {
        console.error(`[CRON] Iteration ${i + 1} error:`, iterError);
        // Continue to next iteration
      }
    }

    const duration = Date.now() - startTime;
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`[CRON] ✓ Completed ${completedIterations}/${LOOP_ITERATIONS} iterations in ${duration}ms`);
    console.log(`[CRON] Races executed: ${totalExecuted}, Deposits: ${totalDeposits}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return NextResponse.json({
      ok: true,
      iterations: completedIterations,
      executed: totalExecuted,
      startedRaceId: lastStartedRace,
      directDeposits: totalDeposits,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error('[CRON] ❌ Fatal error:', error);
    return NextResponse.json({ error: 'Internal error', details: String(error) }, { status: 500 });
  }
}