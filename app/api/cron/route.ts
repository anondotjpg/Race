// app/api/cron/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';
import { executeRace, startNewRace } from '@/app/lib/race-engine';
import { connection } from '@/app/lib/solana';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Simple in-memory rate limit (resets on cold start)
let lastExecutionTime = 0;
const MIN_EXECUTION_GAP_MS = 5000; // 5 seconds between executions

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

          const txTime = sigInfo.blockTime ? sigInfo.blockTime * 1000 : Date.now();
          const bettingEnds = new Date(bettingEndsAt).getTime();
          
          if (txTime > bettingEnds) continue;

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
            console.log(`[CRON] Deposit: ${amount} SOL on ${horse.name}`);
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

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  // Check if this is from Vercel cron (has auth) or client trigger (no auth)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  
  // Rate limit client triggers (not Vercel cron)
  if (!isVercelCron) {
    const timeSinceLastExec = Date.now() - lastExecutionTime;
    if (timeSinceLastExec < MIN_EXECUTION_GAP_MS) {
      return NextResponse.json({ 
        ok: true, 
        skipped: true, 
        reason: 'rate-limited',
        retryIn: MIN_EXECUTION_GAP_MS - timeSinceLastExec
      });
    }
  }
  
  lastExecutionTime = Date.now();
  console.log(`🕒 [CRON] ${isVercelCron ? 'Vercel' : 'Client'} trigger @ ${new Date().toISOString()}`);

  const supabase = createServerSupabaseClient();
  const nowIso = new Date().toISOString();

  let executed = 0;
  let startedRaceId: string | null = null;
  let deposits = 0;

  try {
    // 1. Execute expired races
    const { data: expiredRaces } = await supabase
      .from('races')
      .select('id, betting_ends_at')
      .eq('status', 'betting')
      .lt('betting_ends_at', nowIso);

    for (const race of expiredRaces ?? []) {
      const d = await checkDirectDeposits(supabase, race.id, race.betting_ends_at);
      deposits += d;
      
      const result = await executeRace(race.id);
      if (result) {
        console.log(`[CRON] ✓ Winner: ${result.winningHorseName}`);
        executed++;
      }
    }

    // 2. Ensure active race exists
    const { data: activeRace } = await supabase
      .from('races')
      .select('id, betting_ends_at')
      .eq('status', 'betting')
      .maybeSingle();

    if (!activeRace) {
      startedRaceId = await startNewRace();
      if (startedRaceId) console.log(`[CRON] ✓ New race: ${startedRaceId.slice(0, 8)}`);
    } else {
      const d = await checkDirectDeposits(supabase, activeRace.id, activeRace.betting_ends_at);
      deposits += d;
    }

    const duration = Date.now() - startTime;
    console.log(`[CRON] ✓ ${executed} executed, ${deposits} deposits, ${duration}ms`);

    return NextResponse.json({
      ok: true,
      executed,
      startedRaceId,
      deposits,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error('[CRON] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}