// app/api/cron/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';
import { executeRace, startNewRace } from '@/app/lib/race-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  console.log('🕒 [CRON] invoked');

  const authHeader = request.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();
  const nowIso = new Date().toISOString();

  let executed = 0;
  let startedRaceId: string | null = null;

  try {
    // 1. Finish any expired betting races
    const { data: expiredRaces } = await supabase
      .from('races')
      .select('id')
      .eq('status', 'betting')
      .lt('betting_ends_at', nowIso);

    for (const race of expiredRaces ?? []) {
      console.log('[CRON] executing race:', race.id);
      const result = await executeRace(race.id);
      if (result) {
        console.log('[CRON] race finished, winner:', result.winningHorseName);
        executed++;
      }
    }

    // 2. Check for active race
    const { data: activeRace } = await supabase
      .from('races')
      .select('id')
      .eq('status', 'betting')
      .maybeSingle();

    // 3. Start new race if none active
    if (!activeRace) {
      startedRaceId = await startNewRace();
      console.log('[CRON] new race started:', startedRaceId);
    }

    return NextResponse.json({
      ok: true,
      executed,
      startedRaceId,
      timestamp: nowIso,
    });
  } catch (error) {
    console.error('[CRON] error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}