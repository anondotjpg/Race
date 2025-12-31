// app/api/race/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient();

  try {
    // Get current active race (betting or racing)
    const { data: race, error } = await supabase
      .from('races')
      .select('*')
      .in('status', ['betting', 'racing'])
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    // It is VALID to return null here
    // Cron will start a new race shortly
    return NextResponse.json({ race });
  } catch (error) {
    console.error('[RACE GET]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
