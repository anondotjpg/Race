// app/api/init-wallets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';
import { createPumpPortalWallet } from '@/app/lib/solana';

// This endpoint initializes horse wallets using PumpPortal
// Can be run multiple times - will replace existing wallets
// Protect this in production with auth!

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  
  // Check for admin secret
  const { secret } = await request.json();
  
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Get ALL horses
    const { data: horses, error } = await supabase
      .from('horses')
      .select('*');
    
    console.log('Found horses to update:', horses?.length);
    
    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    if (!horses || horses.length === 0) {
      return NextResponse.json({ 
        message: 'No horses found in database.',
        results: [] 
      });
    }
    
    const results = [];
    
    for (const horse of horses) {
      try {
        console.log(`Creating wallet for ${horse.name}...`);
        
        // Create wallet via PumpPortal (falls back to local generation)
        const wallet = await createPumpPortalWallet();
        
        console.log(`Wallet created for ${horse.name}:`, wallet.publicKey);
        
        // Update horse with new wallet (replaces existing)
        const { error: updateError } = await supabase
          .from('horses')
          .update({
            wallet_address: wallet.publicKey,
            wallet_private_key: wallet.privateKey,
            api_key: wallet.apiKey || null
          })
          .eq('id', horse.id);
        
        if (updateError) {
          console.error(`Update error for ${horse.name}:`, updateError);
          throw updateError;
        }
        
        results.push({
          horseName: horse.name,
          horseId: horse.id,
          walletAddress: wallet.publicKey,
          previousWallet: horse.wallet_address,
          success: true
        });
      } catch (walletError) {
        console.error(`Wallet error for ${horse.name}:`, walletError);
        results.push({
          horseName: horse.name,
          horseId: horse.id,
          success: false,
          error: String(walletError)
        });
      }
    }
    
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Wallet init error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}