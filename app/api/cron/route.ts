import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';
import { executeRace, startNewRace } from '@/app/lib/race-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// How long a race is allowed to stay in `racing` before force-finish
const MAX_RACING_MS = 30_000; // 30 seconds

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
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  let executed = 0;
  let startedRaceId: string | null = null;

  try {
    // ─────────────────────────────────────────────
    // 1. Execute expired BETTING races
    // ─────────────────────────────────────────────
    const { data: expiredBetting } = await supabase
      .from('races')
      .select('id')
      .eq('status', 'betting')
      .lt('betting_ends_at', nowIso)
      .order('betting_ends_at', { ascending: true });

    for (const race of expiredBetting ?? []) {
      const result = await executeRace(race.id);
      if (result) executed++;
    }

    // ─────────────────────────────────────────────
    // 2. Force-finish STUCK RACING races
    // ─────────────────────────────────────────────
    const racingTimeoutIso = new Date(
      now - MAX_RACING_MS
    ).toISOString();

    const { data: stuckRacing } = await supabase
      .from('races')
      .select('id')
      .eq('status', 'racing')
      .lt('updated_at', racingTimeoutIso);

    for (const race of stuckRacing ?? []) {
      const result = await executeRace(race.id);
      if (result) executed++;
    }

    // ─────────────────────────────────────────────
    // 3. Check if any active race exists
    // ─────────────────────────────────────────────
    const { data: activeRace } = await supabase
      .from('races')
      .select('id')
      .in('status', ['betting', 'racing'])
      .limit(1)
      .maybeSingle();

    // ─────────────────────────────────────────────
    // 4. Start new race if none active
    // ─────────────────────────────────────────────
    if (!activeRace) {
      startedRaceId = await startNewRace();
    }

    // ─────────────────────────────────────────────
    // 5. Stable cron response
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
