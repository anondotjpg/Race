// app/api/cron/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';
import { executeRace, startNewRace } from '@/app/lib/race-engine';

export const runtime = 'nodejs';
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

  let executed = 0;
  let startedRaceId: string | null = null;

  try {
    // ─────────────────────────────────────────────
    // 1. Execute expired betting races (deterministic)
    // ─────────────────────────────────────────────
    const { data: expiredRaces } = await supabase
      .from('races')
      .select('id')
      .eq('status', 'betting')
      .lt('betting_ends_at', nowIso)
      .order('betting_ends_at', { ascending: true });

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

    // ─────────────────────────────────────────────
    // 3. Start a new race if none active
    // ─────────────────────────────────────────────
    if (!activeRace) {
      startedRaceId = await startNewRace();
    }

    // ─────────────────────────────────────────────
    // 4. Stable cron response
    // ─────────────────────────────────────────────
    return NextResponse.json({
      ok: true,
      executedRaces: executed,
      startedRaceId,
      activeRace: !!activeRace || !!startedRaceId,
      timestamp: nowIso,
    });
  } catch (err) {
    console.error('[CRON]', err);
    return NextResponse.json(
      {
        ok: false,
        error: 'Internal error',
        executedRaces: executed,
        startedRaceId,
      },
      { status: 500 }
    );
  }
}
