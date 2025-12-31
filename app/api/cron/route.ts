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

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🕒 [CRON] Started at:', new Date().toISOString());

  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('[CRON] ❌ Unauthorized');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();
  const nowIso = new Date().toISOString();

  let executed = 0;
  let startedRaceId: string | null = null;
  let directDeposits = 0;

  try {
    // 0. Check active race for direct deposits first
    const { data: activeForMonitor } = await supabase
      .from('races')
      .select('id, betting_ends_at')
      .eq('status', 'betting')
      .maybeSingle();

    if (activeForMonitor) {
      console.log('[CRON] Step 0: Checking for direct deposits...');
      directDeposits = await checkDirectDeposits(supabase, activeForMonitor.id, activeForMonitor.betting_ends_at);
      console.log(`[CRON] Direct deposits recorded: ${directDeposits}`);
    }

    // 1. Check for expired betting races
    console.log('[CRON] Step 1: Checking for expired betting races...');
    const { data: expiredRaces, error: expiredError } = await supabase
      .from('races')
      .select('id, status, betting_ends_at')
      .eq('status', 'betting')
      .lt('betting_ends_at', nowIso);

    if (expiredError) {
      console.error('[CRON] ❌ Query error:', expiredError);
    }

    console.log('[CRON] Expired races found:', expiredRaces?.length ?? 0);

    // Execute expired races
    for (const race of expiredRaces ?? []) {
      console.log(`[CRON] Executing race: ${race.id}`);
      
      const result = await executeRace(race.id);
      if (result) {
        console.log(`[CRON] ✓ Race finished - Winner: ${result.winningHorseName}`);
        executed++;
      }
    }

    // 2. Check for active betting race
    console.log('[CRON] Step 2: Checking for active betting race...');
    const { data: activeRace } = await supabase
      .from('races')
      .select('id, status, betting_ends_at')
      .eq('status', 'betting')
      .maybeSingle();

    console.log('[CRON] Active race:', activeRace?.id ?? 'NONE');

    // 3. Start new race if none active
    if (!activeRace) {
      console.log('[CRON] Step 3: Starting new race...');
      startedRaceId = await startNewRace();
      console.log('[CRON] New race:', startedRaceId ?? 'FAILED');
    }

    const duration = Date.now() - startTime;
    console.log(`[CRON] ✓ Completed in ${duration}ms`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return NextResponse.json({
      ok: true,
      executed,
      startedRaceId,
      directDeposits,
      timestamp: nowIso,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error('[CRON] ❌ Fatal error:', error);
    return NextResponse.json({ error: 'Internal error', details: String(error) }, { status: 500 });
  }
}