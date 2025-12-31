// app/api/race/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest) {
  const supabase = createServerSupabaseClient();

  try {
    // Fetch current active race (betting or racing)
    const { data: race, error } = await supabase
      .from('races')
      .select('*')
      .in('status', ['betting', 'racing'])
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    // It's valid for race to be null
    // Cron will start a new one if needed
    return NextResponse.json({ race });
  } catch (err) {
    console.error('[api/race]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
