// app/api/monitor/route.ts
// Monitors horse wallets for direct deposits and records them as bets
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';
import { connection } from '@/app/lib/solana';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👀 [MONITOR] Checking for direct deposits...');

  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();
  let recorded = 0;

  try {
    // Get current betting race
    const { data: race } = await supabase
      .from('races')
      .select('id, status, betting_ends_at')
      .eq('status', 'betting')
      .maybeSingle();

    if (!race) {
      console.log('[MONITOR] No active betting race');
      return NextResponse.json({ ok: true, recorded: 0, message: 'No active race' });
    }

    console.log('[MONITOR] Active race:', race.id);

    // Get all horses
    const { data: horses } = await supabase
      .from('horses')
      .select('id, name, wallet_address');

    if (!horses || horses.length === 0) {
      return NextResponse.json({ ok: true, recorded: 0, message: 'No horses' });
    }

    // Check each horse wallet for recent transactions
    for (const horse of horses) {
      console.log(`[MONITOR] Checking ${horse.name} (${horse.wallet_address.slice(0, 10)}...)`);

      try {
        // Get recent signatures for this wallet
        const signatures = await connection.getSignaturesForAddress(
          new (await import('@solana/web3.js')).PublicKey(horse.wallet_address),
          { limit: 10 }
        );

        for (const sigInfo of signatures) {
          // Check if already recorded
          const { data: existing } = await supabase
            .from('bets')
            .select('id')
            .eq('tx_signature', sigInfo.signature)
            .maybeSingle();

          if (existing) continue; // Already recorded

          // Get transaction details
          const tx = await connection.getTransaction(sigInfo.signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
          });

          if (!tx || !tx.meta) continue;

          // Find the transfer to horse wallet
          const accountKeys = tx.transaction.message.staticAccountKeys;
          const horseIndex = accountKeys?.findIndex(
            key => key.toBase58() === horse.wallet_address
          );

          if (horseIndex === undefined || horseIndex === -1) continue;

          const preBalance = tx.meta.preBalances[horseIndex] || 0;
          const postBalance = tx.meta.postBalances[horseIndex] || 0;
          const amount = (postBalance - preBalance) / LAMPORTS_PER_SOL;

          if (amount <= 0) continue; // Not a deposit

          // Get sender
          const sender = accountKeys?.[0]?.toBase58() || '';
          if (!sender) continue;

          // Check if transaction is within betting period
          const txTime = sigInfo.blockTime ? sigInfo.blockTime * 1000 : Date.now();
          const bettingEnds = new Date(race.betting_ends_at).getTime();
          
          if (txTime > bettingEnds) {
            console.log(`[MONITOR] Skipping tx after betting ended: ${sigInfo.signature.slice(0, 20)}...`);
            continue;
          }

          // Record the bet!
          console.log(`[MONITOR] Recording bet: ${amount} SOL from ${sender.slice(0, 10)}... on ${horse.name}`);

          const { error: insertError } = await supabase.from('bets').insert({
            race_id: race.id,
            horse_id: horse.id,
            bettor_wallet: sender,
            amount,
            tx_signature: sigInfo.signature,
            status: 'confirmed',
          });

          if (insertError) {
            console.error('[MONITOR] Insert error:', insertError);
          } else {
            recorded++;
            console.log(`[MONITOR] ✓ Bet recorded!`);
          }
        }
      } catch (err) {
        console.error(`[MONITOR] Error checking ${horse.name}:`, err);
      }
    }

    console.log(`[MONITOR] Done. Recorded ${recorded} new bets.`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return NextResponse.json({ ok: true, recorded });
  } catch (error) {
    console.error('[MONITOR] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}