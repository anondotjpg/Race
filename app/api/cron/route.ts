// app/api/cron/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';
import { executeRace, startNewRace } from '@/app/lib/race-engine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // ─────────────────────────────────────────────
  // Auth (required in prod)
  // ─────────────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();
  const nowIso = new Date().toISOString();

  try {
    // ─────────────────────────────────────────────
    // 1. Execute expired betting races
    // ─────────────────────────────────────────────
    const { data: expiredRaces } = await supabase
      .from('races')
      .select('id')
      .eq('status', 'betting')
      .lt('betting_ends_at', nowIso);

    let executed = 0;

    for (const race of expiredRaces ?? []) {
      const result = await executeRace(race.id);
      if (result) executed++;
    }

    // ─────────────────────────────────────────────
    // 2. Check if an active race exists
    // ─────────────────────────────────────────────
    const { data: activeRace } = await supabase
      .from('races')
      .select('id')
      .in('status', ['betting', 'racing'])
      .limit(1)
      .maybeSingle();

    if (!activeRace) {
      // ─────────────────────────────────────────
      // 3. Attempt to start a new race
      // (DB guarantees safety)
      // ─────────────────────────────────────────
      const newRaceId = await startNewRace();

      if (newRaceId) {
        return NextResponse.json({
          message: 'New race started',
          raceId: newRaceId,
          executedRaces: executed,
        });
      }
    }

    return NextResponse.json({
      message: 'Cron ok',
      executedRaces: executed,
      activeRace: !!activeRace,
    });
  } catch (err) {
    console.error('[CRON]', err);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}
