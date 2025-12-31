import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';
import { executeRace, startNewRace } from '@/app/lib/race-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// How long a race is allowed to stay in `racing` before force-finish
const MAX_RACING_MS = 30_000; // 30 seconds

export async function GET(request: NextRequest) {
  console.log('🕒 [CRON] invoked');

  // ─────────────────────────────────────────────
  // Auth
  // ─────────────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  console.log('[CRON] auth header:', authHeader);

  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    console.error('[CRON] ❌ unauthorized');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[CRON] ✅ authorized');

  const supabase = createServerSupabaseClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  let executed = 0;
  let startedRaceId: string | null = null;

  try {
    // ─────────────────────────────────────────────
    // 1. Execute expired BETTING races
    // ─────────────────────────────────────────────
    console.log('[CRON] checking expired betting races…');

    const { data: expiredBetting, error: expiredErr } = await supabase
      .from('races')
      .select('id, betting_ends_at')
      .eq('status', 'betting')
      .lt('betting_ends_at', nowIso)
      .order('betting_ends_at', { ascending: true });

    if (expiredErr) {
      console.error('[CRON] ❌ expiredBetting query error', expiredErr);
    }

    console.log(
      `[CRON] expired betting races found: ${expiredBetting?.length ?? 0}`,
      expiredBetting
    );

    for (const race of expiredBetting ?? []) {
      console.log('[CRON] ▶️ executing expired betting race', race.id);

      const result = await executeRace(race.id);

      if (result) {
        console.log('[CRON] ✅ race finished', result);
        executed++;
      } else {
        console.warn('[CRON] ⚠️ executeRace returned null', race.id);
      }
    }

    // ─────────────────────────────────────────────
    // 2. Force-finish STUCK RACING races
    // ─────────────────────────────────────────────
    const racingTimeoutIso = new Date(
      now - MAX_RACING_MS
    ).toISOString();

    console.log(
      '[CRON] checking stuck racing races older than',
      racingTimeoutIso
    );

    const { data: stuckRacing, error: stuckErr } = await supabase
      .from('races')
      .select('id, updated_at')
      .eq('status', 'racing')
      .lt('updated_at', racingTimeoutIso);

    if (stuckErr) {
      console.error('[CRON] ❌ stuckRacing query error', stuckErr);
    }

    console.log(
      `[CRON] stuck racing races found: ${stuckRacing?.length ?? 0}`,
      stuckRacing
    );

    for (const race of stuckRacing ?? []) {
      console.log('[CRON] ▶️ force-finishing stuck race', race.id);

      const result = await executeRace(race.id);

      if (result) {
        console.log('[CRON] ✅ stuck race finished', result);
        executed++;
      } else {
        console.warn('[CRON] ⚠️ executeRace returned null (stuck)', race.id);
      }
    }

    // ─────────────────────────────────────────────
    // 3. Check if any active race exists
    // ─────────────────────────────────────────────
    console.log('[CRON] checking active races…');

    const { data: activeRace, error: activeErr } = await supabase
      .from('races')
      .select('id, status')
      .in('status', ['betting', 'racing'])
      .limit(1)
      .maybeSingle();

    if (activeErr) {
      console.error('[CRON] ❌ activeRace query error', activeErr);
    }

    console.log('[CRON] activeRace:', activeRace);

    // ─────────────────────────────────────────────
    // 4. Start new race if none active
    // ─────────────────────────────────────────────
    if (!activeRace) {
      console.log('[CRON] 🚀 no active race — starting new one');

      startedRaceId = await startNewRace();

      console.log('[CRON] new race started:', startedRaceId);
    } else {
      console.log('[CRON] ⏸ active race exists — not starting new one');
    }

    // ─────────────────────────────────────────────
    // 5. Stable response
    // ─────────────────────────────────────────────
    console.log('[CRON] finished run', {
      executed,
      startedRaceId,
      timestamp: nowIso,
    });

    return NextResponse.json({
      ok: true,
      executedRaces: executed,
      startedRaceId,
      activeRace: !!activeRace || !!startedRaceId,
      timestamp: nowIso,
    });
  } catch (err) {
    console.error('[CRON] 💥 fatal error', err);
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
