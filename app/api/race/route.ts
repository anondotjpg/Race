// app/api/race/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';
import { executeRace, startNewRace } from '@/app/lib/race-engine';

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  
  try {
    // Get current active race (betting only now, we skip racing status)
    const { data: race, error } = await supabase
      .from('races')
      .select('*')
      .eq('status', 'betting')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      throw error;
    }
    
    // Also get the most recent finished race for results display
    const { data: lastFinished } = await supabase
      .from('races')
      .select('*')
      .eq('status', 'finished')
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    // If no active race, try to start a new one
    if (!race) {
      const newRaceId = await startNewRace();
      
      if (newRaceId) {
        const { data: newRace } = await supabase
          .from('races')
          .select('*')
          .eq('id', newRaceId)
          .single();
        
        return NextResponse.json({ race: newRace, lastFinished });
      }
      
      // Return last finished if we couldn't start new race
      return NextResponse.json({ race: lastFinished, lastFinished });
    }
    
    return NextResponse.json({ race, lastFinished });
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