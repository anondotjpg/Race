// app/api/cron/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';
import { executeRace, startNewRace } from '@/app/lib/race-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  try {
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

    // 3. Start new race if none active (do this immediately after executing!)
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
      timestamp: nowIso,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error('[CRON] ❌ Fatal error:', error);
    return NextResponse.json({ error: 'Internal error', details: String(error) }, { status: 500 });
  }
}