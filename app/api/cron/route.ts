// app/api/cron/route.ts
// This endpoint should be called by a cron job every minute to manage races
// Use Vercel Cron, Supabase Edge Functions, or external cron service

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';
import { executeRace, startNewRace } from '@/app/lib/race-engine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify cron secret in production
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();

  try {
    // Check for races that need to be executed (betting ended)
    const { data: pendingRaces } = await supabase
      .from('races')
      .select('*')
      .eq('status', 'betting')
      .lt('betting_ends_at', new Date().toISOString());

    // Execute any pending races
    for (const race of pendingRaces || []) {
      console.log(`Executing race ${race.id}`);
      await executeRace(race.id);
    }

    // Check if we need to start a new race
    const { data: activeRaces } = await supabase
      .from('races')
      .select('*')
      .in('status', ['betting', 'racing']);

    if (!activeRaces || activeRaces.length === 0) {
      // No active races, check when last race finished
      const { data: lastRace } = await supabase
        .from('races')
        .select('*')
        .eq('status', 'finished')
        .order('finished_at', { ascending: false })
        .limit(1)
        .single();

      const shouldStartNew = !lastRace || 
        (lastRace.finished_at && 
         new Date().getTime() - new Date(lastRace.finished_at).getTime() > 30000); // 30 second break

      if (shouldStartNew) {
        const newRaceId = await startNewRace();
        console.log(`Started new race: ${newRaceId}`);
        return NextResponse.json({ 
          message: 'New race started', 
          raceId: newRaceId,
          executedRaces: pendingRaces?.length || 0
        });
      }
    }

    return NextResponse.json({ 
      message: 'Cron check complete',
      executedRaces: pendingRaces?.length || 0,
      activeRaces: activeRaces?.length || 0
    });
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}