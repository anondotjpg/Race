// app/api/cron/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { executeRace, startNewRace } from '@/lib/race-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🕒 [CRON] Started at:', new Date().toISOString());

  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  console.log('[CRON] Auth header present:', !!authHeader);
  console.log('[CRON] CRON_SECRET configured:', !!cronSecret);
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('[CRON] ❌ Unauthorized - header mismatch');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  console.log('[CRON] ✓ Auth passed');

  let supabase;
  try {
    supabase = createServerSupabaseClient();
    console.log('[CRON] ✓ Supabase client created');
  } catch (err) {
    console.error('[CRON] ❌ Supabase client failed:', err);
    return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
  }

  const nowIso = new Date().toISOString();
  console.log('[CRON] Current time:', nowIso);

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
      console.error('[CRON] ❌ Query error (expired races):', expiredError);
    } else {
      console.log('[CRON] Expired races found:', expiredRaces?.length ?? 0);
      if (expiredRaces?.length) {
        console.log('[CRON] Expired race IDs:', expiredRaces.map(r => r.id));
      }
    }

    // Execute expired races
    for (const race of expiredRaces ?? []) {
      console.log(`[CRON] Executing race: ${race.id}`);
      console.log(`[CRON]   - betting_ends_at: ${race.betting_ends_at}`);
      
      try {
        const result = await executeRace(race.id);
        if (result) {
          console.log(`[CRON] ✓ Race ${race.id} finished - Winner: ${result.winningHorseName}`);
          executed++;
        } else {
          console.log(`[CRON] ⚠ Race ${race.id} returned null (already finished or error)`);
        }
      } catch (execError) {
        console.error(`[CRON] ❌ executeRace failed for ${race.id}:`, execError);
      }
    }

    // 2. Check for active race
    console.log('[CRON] Step 2: Checking for active betting race...');
    const { data: activeRace, error: activeError } = await supabase
      .from('races')
      .select('id, status, betting_ends_at')
      .eq('status', 'betting')
      .maybeSingle();

    if (activeError) {
      console.error('[CRON] ❌ Query error (active race):', activeError);
    } else {
      console.log('[CRON] Active race:', activeRace ? `${activeRace.id} (ends: ${activeRace.betting_ends_at})` : 'NONE');
    }

    // 3. Start new race if none active
    if (!activeRace) {
      console.log('[CRON] Step 3: Starting new race...');
      try {
        startedRaceId = await startNewRace();
        if (startedRaceId) {
          console.log(`[CRON] ✓ New race started: ${startedRaceId}`);
        } else {
          console.log('[CRON] ⚠ startNewRace returned null');
        }
      } catch (startError) {
        console.error('[CRON] ❌ startNewRace failed:', startError);
      }
    } else {
      console.log('[CRON] Step 3: Skipped - active race exists');
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
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return NextResponse.json({ error: 'Internal error', details: String(error) }, { status: 500 });
  }
}