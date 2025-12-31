// app/api/race/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';
import { executeRace, startNewRace } from '@/app/lib/race-engine';

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  
  try {
    // Get current active race
    const { data: race, error } = await supabase
      .from('races')
      .select('*')
      .in('status', ['betting', 'racing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      throw error;
    }
    
    // If no active race, start a new one
    if (!race) {
      const newRaceId = await startNewRace();
      if (!newRaceId) {
        return NextResponse.json({ error: 'Failed to start race' }, { status: 500 });
      }
      
      const { data: newRace } = await supabase
        .from('races')
        .select('*')
        .eq('id', newRaceId)
        .single();
      
      return NextResponse.json({ race: newRace });
    }
    
    return NextResponse.json({ race });
  } catch (error) {
    console.error('Race API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST to trigger race execution (called by cron or after betting ends)
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  
  try {
    const { action, raceId } = await request.json();
    
    if (action === 'execute' && raceId) {
      const result = await executeRace(raceId);
      
      if (result) {
        // Start next race after a delay
        setTimeout(async () => {
          await startNewRace();
        }, 30000); // 30 second break between races
        
        return NextResponse.json({ success: true, result });
      }
      
      return NextResponse.json({ error: 'Race execution failed' }, { status: 500 });
    }
    
    if (action === 'start') {
      const newRaceId = await startNewRace();
      return NextResponse.json({ success: true, raceId: newRaceId });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Race API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}