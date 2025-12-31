// app/api/init-wallets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';
import { createPumpPortalWallet } from '@/app/lib/solana';

// This endpoint initializes horse wallets using PumpPortal
// Should only be called once during initial setup
// Protect this in production with auth!

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  
  // Check for admin secret
  const { secret } = await request.json();
  
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Get horses without wallets
    const { data: horses, error } = await supabase
      .from('horses')
      .select('*')
      .or('wallet_address.eq.PLACEHOLDER_WALLET_1,wallet_address.eq.PLACEHOLDER_WALLET_2,wallet_address.eq.PLACEHOLDER_WALLET_3,wallet_address.eq.PLACEHOLDER_WALLET_4,wallet_address.eq.PLACEHOLDER_WALLET_5');
    
    if (error) throw error;
    
    const results = [];
    
    for (const horse of horses || []) {
      try {
        // Create wallet via PumpPortal
        const wallet = await createPumpPortalWallet();
        
        // Update horse with real wallet
        const { error: updateError } = await supabase
          .from('horses')
          .update({
            wallet_address: wallet.publicKey,
            wallet_private_key: wallet.privateKey, // Encrypt in production!
            api_key: wallet.apiKey
          })
          .eq('id', horse.id);
        
        if (updateError) throw updateError;
        
        results.push({
          horseName: horse.name,
          walletAddress: wallet.publicKey,
          success: true
        });
      } catch (walletError) {
        results.push({
          horseName: horse.name,
          success: false,
          error: String(walletError)
        });
      }
    }
    
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Wallet init error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}