// app/api/bet/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';
import { verifyTransaction } from '@/app/lib/solana';
import { recordBet } from '@/app/lib/race-engine';

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  
  try {
    const { raceId, horseId, txSignature, bettorWallet } = await request.json();
    
    if (!raceId || !horseId || !txSignature || !bettorWallet) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Get the horse's wallet address
    const { data: horse, error: horseError } = await supabase
      .from('horses')
      .select('wallet_address')
      .eq('id', horseId)
      .single();
    
    if (horseError || !horse) {
      return NextResponse.json({ error: 'Horse not found' }, { status: 404 });
    }
    
    // Verify the transaction
    const verification = await verifyTransaction(txSignature, horse.wallet_address);
    
    if (!verification.valid) {
      return NextResponse.json({ error: 'Transaction verification failed' }, { status: 400 });
    }
    
    if (verification.sender !== bettorWallet) {
      return NextResponse.json({ error: 'Sender wallet mismatch' }, { status: 400 });
    }
    
    // Record the bet
    const success = await recordBet(
      raceId,
      horseId,
      bettorWallet,
      verification.amount,
      txSignature
    );
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to record bet - race may have ended' }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      amount: verification.amount,
      horseId,
      raceId
    });
  } catch (error) {
    console.error('Bet API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET bets for a race
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const raceId = searchParams.get('raceId');
  const wallet = searchParams.get('wallet');
  
  const supabase = createServerSupabaseClient();
  
  try {
    let query = supabase
      .from('bets')
      .select(`
        *,
        horse:horses(name, color, emoji)
      `);
    
    if (raceId) {
      query = query.eq('race_id', raceId);
    }
    
    if (wallet) {
      query = query.eq('bettor_wallet', wallet);
    }
    
    const { data: bets, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return NextResponse.json({ bets });
  } catch (error) {
    console.error('Bets API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}