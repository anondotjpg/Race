// app/api/horses/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, supabase } from '@/app/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const raceId = searchParams.get('raceId');
  
  const supabase = createServerSupabaseClient();
  
  try {
    // Get all horses (without private keys)
    const { data: horses, error: horsesError } = await supabase
      .from('horses')
      .select('id, name, color, emoji, wallet_address, created_at');
    
    if (horsesError) throw horsesError;
    
    // If raceId provided, get odds for that race
    if (raceId) {
      const { data: bets } = await supabase
        .from('bets')
        .select('horse_id, amount')
        .eq('race_id', raceId)
        .eq('status', 'confirmed');
      
      // Calculate total pool from actual bets (source of truth)
      const totalPool = bets?.reduce((sum, b) => sum + b.amount, 0) || 0;
      
      const horsesWithOdds = horses?.map(horse => {
        const horseBets = bets?.filter(b => b.horse_id === horse.id) || [];
        const totalBets = horseBets.reduce((sum, b) => sum + b.amount, 0);
        
        // Calculate implied odds
        let odds = 0;
        if (totalBets > 0 && totalPool > 0) {
          odds = totalPool / totalBets;
        }
        
        return {
          ...horse,
          totalBets,
          odds: odds > 0 ? odds.toFixed(2) : '—',
          percentage: totalPool > 0 ? ((totalBets / totalPool) * 100).toFixed(1) : '0'
        };
      });
      
      return NextResponse.json({ horses: horsesWithOdds, totalPool });
    }
    
    return NextResponse.json({ horses });
  } catch (error) {
    console.error('Horses API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}