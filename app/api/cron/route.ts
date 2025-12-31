// app/api/cron/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';
import { executeRace, startNewRace } from '@/app/lib/race-engine';
import { connection } from '@/app/lib/solana';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  
  // Check source (for logging only - both are allowed)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  
  console.log(`🕒 [CRON] ${isVercelCron ? 'Vercel' : 'Client'} @ ${new Date().toISOString()}`);

  const supabase = createServerSupabaseClient();
  const nowIso = new Date().toISOString();

  let executed = 0;
  let startedRaceId: string | null = null;
  let deposits = 0;

  try {
    // 1. Check for expired races (status='betting' AND betting_ends_at < now)
    // This is the ONLY way a race gets executed - database is source of truth
    const { data: expiredRaces } = await supabase
      .from('races')
      .select('id, betting_ends_at')
      .eq('status', 'betting')
      .lt('betting_ends_at', nowIso);

    // If no expired races, nothing to do (client spam has no effect)
    if (!expiredRaces?.length) {
      // Just check if we need to start a race
      const { data: activeRace } = await supabase
        .from('races')
        .select('id, betting_ends_at')
        .eq('status', 'betting')
        .maybeSingle();

      if (!activeRace) {
        startedRaceId = await startNewRace();
        if (startedRaceId) console.log(`[CRON] ✓ Started: ${startedRaceId.slice(0, 8)}`);
      }

      return NextResponse.json({
        ok: true,
        executed: 0,
        startedRaceId,
        deposits: 0,
        duration: `${Date.now() - startTime}ms`,
      });
    }

    // 2. Execute expired races
    for (const race of expiredRaces) {
      // Get last-minute deposits
      const d = await checkDirectDeposits(supabase, race.id, race.betting_ends_at);
      deposits += d;
      
      // Execute race (this changes status from 'betting' to 'finished')
      // If another request tries to execute same race, it will fail/noop
      const result = await executeRace(race.id);
      if (result) {
        console.log(`[CRON] ✓ Winner: ${result.winningHorseName}`);
        executed++;
      }
    }

    // 3. Start new race
    const { data: activeRace } = await supabase
      .from('races')
      .select('id')
      .eq('status', 'betting')
      .maybeSingle();

    if (!activeRace) {
      startedRaceId = await startNewRace();
      if (startedRaceId) console.log(`[CRON] ✓ New race: ${startedRaceId.slice(0, 8)}`);
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