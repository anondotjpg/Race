// app/api/cron/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { executeRace, startNewRace } from '@/lib/race-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Max time a race may stay in `racing` before force-finishing
const MAX_RACING_MS = 30_000;

export async function GET(request: NextRequest) {
  console.log('🕒 [CRON] invoked');

  const authHeader = request.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    console.error('[CRON] unauthorized');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  let executed = 0;
  let startedRaceId: string | null = null;

  try {
    // 1️⃣ Finish expired betting races
    const { data: expiredBetting } = await supabase
      .from('races')
      .select('id')
      .eq('status', 'betting')
      .lt('betting_ends_at', nowIso);

    console.log('[CRON] expired betting:', expiredBetting?.length ?? 0);

    for (const race of expiredBetting ?? []) {
      console.log('[CRON] executing race:', race.id);
      const result = await executeRace(race.id);
      if (result) executed++;
    }

    // 2️⃣ Force-finish stuck racing races
    const racingTimeoutIso = new Date(now - MAX_RACING_MS).toISOString();

    const { data: stuckRacing } = await supabase
      .from('races')
      .select('id, updated_at')
      .eq('status', 'racing')
      .lt('updated_at', racingTimeoutIso);

    console.log('[CRON] stuck racing:', stuckRacing?.length ?? 0);

    for (const race of stuckRacing ?? []) {
      console.log('[CRON] force-finishing race:', race.id);
      const result = await executeRace(race.id);
      if (result) executed++;
    }

    // 3️⃣ Check for any active race
    const { data: activeRace } = await supabase
      .from('races')
      .select('id, status')
      .in('status', ['betting', 'racing'])
      .limit(1)
      .maybeSingle();

    console.log('[CRON] active race:', activeRace?.id ?? 'none');

    // 4️⃣ Start new race if none active
    if (!activeRace) {
      startedRaceId = await startNewRace();
      console.log('[CRON] new race started:', startedRaceId);
    }

    return NextResponse.json({
      ok: true,
      executedRaces: executed,
      startedRaceId,
      activeRace: activeRace?.id ?? null,
      timestamp: nowIso,
    });
  } catch (error) {
    console.error('[CRON] error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}