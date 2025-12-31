// app/api/bet/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';
import { verifyTransaction } from '@/app/lib/solana';
import { recordBet } from '@/app/lib/race-engine';

export async function POST(request: NextRequest) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎲 [BET] New bet request');
  
  const supabase = createServerSupabaseClient();
  
  try {
    const body = await request.json();
    const { raceId, horseId, txSignature, bettorWallet } = body;
    
    console.log('[BET] Request body:', {
      raceId: raceId || 'MISSING',
      horseId: horseId || 'MISSING',
      txSignature: txSignature ? txSignature.slice(0, 20) + '...' : 'MISSING',
      bettorWallet: bettorWallet ? bettorWallet.slice(0, 10) + '...' : 'MISSING'
    });
    
    if (!raceId || !horseId || !txSignature || !bettorWallet) {
      console.log('[BET] ❌ Missing required fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Get the horse's wallet address
    console.log('[BET] Looking up horse:', horseId);
    const { data: horse, error: horseError } = await supabase
      .from('horses')
      .select('wallet_address, name')
      .eq('id', horseId)
      .single();
    
    if (horseError) {
      console.log('[BET] ❌ Horse query error:', horseError);
      return NextResponse.json({ error: 'Horse not found' }, { status: 404 });
    }
    
    if (!horse) {
      console.log('[BET] ❌ Horse not found');
      return NextResponse.json({ error: 'Horse not found' }, { status: 404 });
    }
    
    console.log('[BET] Horse found:', horse.name, '| Wallet:', horse.wallet_address?.slice(0, 10) + '...');
    
    // Verify the transaction
    console.log('[BET] Verifying transaction...');
    const verification = await verifyTransaction(txSignature, horse.wallet_address);
    
    console.log('[BET] Verification result:', {
      valid: verification.valid,
      amount: verification.amount,
      sender: verification.sender ? verification.sender.slice(0, 10) + '...' : 'NONE'
    });
    
    if (!verification.valid) {
      console.log('[BET] ❌ Transaction verification failed');
      return NextResponse.json({ error: 'Transaction verification failed' }, { status: 400 });
    }
    
    if (verification.sender !== bettorWallet) {
      console.log('[BET] ❌ Sender mismatch:', {
        expected: bettorWallet.slice(0, 10) + '...',
        got: verification.sender?.slice(0, 10) + '...'
      });
      return NextResponse.json({ error: 'Sender wallet mismatch' }, { status: 400 });
    }
    
    // Record the bet
    console.log('[BET] Recording bet...');
    const success = await recordBet(
      raceId,
      horseId,
      bettorWallet,
      verification.amount,
      txSignature
    );
    
    if (!success) {
      console.log('[BET] ❌ recordBet returned false (race ended or duplicate)');
      return NextResponse.json({ error: 'Failed to record bet - race may have ended' }, { status: 400 });
    }
    
    console.log('[BET] ✓ Bet recorded successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return NextResponse.json({
      success: true,
      amount: verification.amount,
      horseId,
      raceId
    });
  } catch (error) {
    console.error('[BET] ❌ Exception:', error);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
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