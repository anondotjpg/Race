// lib/solana.ts
import { 
  Connection, 
  PublicKey, 
  LAMPORTS_PER_SOL,
  Keypair,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  ComputeBudgetProgram
} from '@solana/web3.js';
import bs58 from 'bs58';

// Use your preferred RPC endpoint
const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';

export const connection = new Connection(RPC_ENDPOINT, 'confirmed');

// Create wallet locally using Solana web3.js
export function createWallet(): {
  publicKey: string;
  privateKey: string;
} {
  const keypair = Keypair.generate();
  return {
    publicKey: keypair.publicKey.toBase58(),
    privateKey: bs58.encode(keypair.secretKey),
  };
}

// Create wallet using PumpPortal API
export async function createPumpPortalWallet(): Promise<{
  publicKey: string;
  privateKey: string;
  apiKey?: string;
}> {
  try {
    const response = await fetch('https://pumpportal.fun/api/create-wallet', {
      method: 'GET',
    });
    
    if (!response.ok) {
      throw new Error(`PumpPortal API error: ${response.status}`);
    }
    
    const data = await response.json();
    const publicKey = data.walletPublicKey;
    const privateKey = data.privateKey;
    const apiKey = data.apiKey;
    
    if (!publicKey || !privateKey) {
      throw new Error('Missing keys in PumpPortal response');
    }
    
    console.log('🟢 PumpPortal wallet created:', publicKey);
    return { publicKey, privateKey, apiKey };
  } catch (error) {
    console.error('🔴 PumpPortal failed, using local:', error);
    const keypair = Keypair.generate();
    return {
      publicKey: keypair.publicKey.toBase58(),
      privateKey: bs58.encode(keypair.secretKey),
    };
  }
}

// Check wallet balance
export async function getWalletBalance(walletAddress: string): Promise<number> {
  try {
    const publicKey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('Error getting balance:', error);
    return 0;
  }
}

// Monitor wallet for incoming transactions
export async function subscribeToWallet(
  walletAddress: string,
  onTransaction: (signature: string, amount: number, sender: string) => void
): Promise<number> {
  const publicKey = new PublicKey(walletAddress);
  
  const subscriptionId = connection.onAccountChange(
    publicKey,
    async (accountInfo, context) => {
      const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 1 });
      if (signatures.length > 0) {
        const sig = signatures[0];
        const tx = await connection.getTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0
        });
        
        if (tx && tx.meta) {
          const preBalance = tx.meta.preBalances[1] || 0;
          const postBalance = tx.meta.postBalances[1] || 0;
          const amount = (postBalance - preBalance) / LAMPORTS_PER_SOL;
          
          if (amount > 0) {
            const sender = tx.transaction.message.staticAccountKeys?.[0]?.toBase58() || 'unknown';
            onTransaction(sig.signature, amount, sender);
          }
        }
      }
    },
    'confirmed'
  );
  
  return subscriptionId;
}

// Send SOL payout to single winner
export async function sendPayout(
  fromPrivateKey: string,
  toWallet: string,
  amountSol: number
): Promise<string | null> {
  try {
    const fromKeypair = Keypair.fromSecretKey(bs58.decode(fromPrivateKey));
    const toPublicKey = new PublicKey(toWallet);
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toPublicKey,
        lamports: Math.floor(amountSol * LAMPORTS_PER_SOL),
      })
    );
    
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [fromKeypair]
    );
    
    return signature;
  } catch (error) {
    console.error('Payout failed:', error);
    return null;
  }
}

// ============================================================
// PRODUCTION BATCH PAYOUTS - With balance check, retries, tracking
// ============================================================
export async function sendTrackedPayouts(
  fromPrivateKey: string,
  payouts: Array<{ id: string; wallet: string; amount: number }>,
  onPayoutComplete?: (id: string, success: boolean, signature?: string) => Promise<void>
): Promise<{ successful: number; failed: number; signatures: string[] }> {
  const MAX_TRANSFERS_PER_TX = 15; // Conservative limit
  const MAX_RETRIES = 3;
  const fromKeypair = Keypair.fromSecretKey(bs58.decode(fromPrivateKey));
  
  if (payouts.length === 0) {
    return { successful: 0, failed: 0, signatures: [] };
  }

  // Check balance first
  const balance = await connection.getBalance(fromKeypair.publicKey);
  const totalNeeded = payouts.reduce((sum, p) => sum + p.amount, 0) * LAMPORTS_PER_SOL;
  const feesEstimate = Math.ceil(payouts.length / MAX_TRANSFERS_PER_TX) * 10000;
  
  if (balance < totalNeeded + feesEstimate) {
    console.error(`[Payouts] Insufficient: ${balance / LAMPORTS_PER_SOL} SOL, need ${(totalNeeded + feesEstimate) / LAMPORTS_PER_SOL} SOL`);
    
    // Mark all as failed
    if (onPayoutComplete) {
      for (const p of payouts) {
        await onPayoutComplete(p.id, false);
      }
    }
    return { successful: 0, failed: payouts.length, signatures: [] };
  }

  // Split into batches
  const batches: Array<Array<{ id: string; wallet: string; amount: number }>> = [];
  for (let i = 0; i < payouts.length; i += MAX_TRANSFERS_PER_TX) {
    batches.push(payouts.slice(i, i + MAX_TRANSFERS_PER_TX));
  }

  console.log(`[Payouts] ${payouts.length} payouts → ${batches.length} batches`);

  const signatures: string[] = [];
  let successful = 0;
  let failed = 0;

  // Process batches SEQUENTIALLY to avoid nonce conflicts
  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    let retries = 0;
    let batchSuccess = false;

    while (retries < MAX_RETRIES && !batchSuccess) {
      try {
        // Get fresh blockhash for each attempt
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        
        const transaction = new Transaction();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromKeypair.publicKey;
        
        // Priority fee for faster confirmation
        transaction.add(
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5000 })
        );

        for (const payout of batch) {
          transaction.add(
            SystemProgram.transfer({
              fromPubkey: fromKeypair.publicKey,
              toPubkey: new PublicKey(payout.wallet),
              lamports: Math.floor(payout.amount * LAMPORTS_PER_SOL),
            })
          );
        }

        const signature = await sendAndConfirmTransaction(
          connection,
          transaction,
          [fromKeypair],
          { commitment: 'confirmed', maxRetries: 3 }
        );

        signatures.push(signature);
        successful += batch.length;
        batchSuccess = true;
        
        // Notify success for each payout
        if (onPayoutComplete) {
          for (const payout of batch) {
            await onPayoutComplete(payout.id, true, signature);
          }
        }
        
        console.log(`[Batch ${batchIdx + 1}/${batches.length}] ✓ ${batch.length} payouts`);
        
        // Small delay between batches
        await new Promise(r => setTimeout(r, 500));
        
      } catch (error: any) {
        retries++;
        console.error(`[Batch ${batchIdx + 1}] Attempt ${retries} failed:`, error.message);
        
        if (retries >= MAX_RETRIES) {
          failed += batch.length;
          
          // Notify failure for each payout
          if (onPayoutComplete) {
            for (const payout of batch) {
              await onPayoutComplete(payout.id, false);
            }
          }
        } else {
          // Exponential backoff
          await new Promise(r => setTimeout(r, 2000 * retries));
        }
      }
    }
  }

  console.log(`[Payouts] Done: ${successful} ok, ${failed} failed`);
  return { successful, failed, signatures };
}

// ============================================================
// SIMPLE BATCH PAYOUTS - For smaller scale (no tracking)
// ============================================================
export async function sendBatchPayouts(
  fromPrivateKey: string,
  payouts: Array<{ wallet: string; amount: number }>
): Promise<{ success: boolean; signature?: string; failed: number[] }> {
  const MAX_TRANSFERS_PER_TX = 15;
  const MAX_RETRIES = 3;
  
  if (payouts.length === 0) {
    return { success: true, failed: [] };
  }

  const fromKeypair = Keypair.fromSecretKey(bs58.decode(fromPrivateKey));
  const failedIndices: number[] = [];
  let lastSignature: string | undefined;

  // Split into batches
  const batches: Array<Array<{ wallet: string; amount: number; index: number }>> = [];
  for (let i = 0; i < payouts.length; i += MAX_TRANSFERS_PER_TX) {
    batches.push(
      payouts.slice(i, i + MAX_TRANSFERS_PER_TX).map((p, idx) => ({
        ...p,
        index: i + idx
      }))
    );
  }

  console.log(`[Batch] ${payouts.length} payouts → ${batches.length} batch(es)`);

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    let retries = 0;
    let batchSuccess = false;

    while (retries < MAX_RETRIES && !batchSuccess) {
      try {
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        
        const transaction = new Transaction();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromKeypair.publicKey;
        
        transaction.add(
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5000 })
        );

        for (const payout of batch) {
          transaction.add(
            SystemProgram.transfer({
              fromPubkey: fromKeypair.publicKey,
              toPubkey: new PublicKey(payout.wallet),
              lamports: Math.floor(payout.amount * LAMPORTS_PER_SOL),
            })
          );
        }

        const signature = await sendAndConfirmTransaction(
          connection,
          transaction,
          [fromKeypair],
          { commitment: 'confirmed', maxRetries: 3 }
        );

        lastSignature = signature;
        batchSuccess = true;
        console.log(`[Batch ${batchIdx + 1}/${batches.length}] ✓ ${batch.length} payouts`);
        
        await new Promise(r => setTimeout(r, 500));
        
      } catch (error: any) {
        retries++;
        console.error(`[Batch ${batchIdx + 1}] Attempt ${retries} failed:`, error.message);
        
        if (retries >= MAX_RETRIES) {
          batch.forEach(p => failedIndices.push(p.index));
        } else {
          await new Promise(r => setTimeout(r, 2000 * retries));
        }
      }
    }
  }

  return {
    success: failedIndices.length === 0,
    signature: lastSignature,
    failed: failedIndices
  };
}

// Verify a transaction exists and get amount (with retries)
export async function verifyTransaction(
  signature: string,
  expectedRecipient: string
): Promise<{ valid: boolean; amount: number; sender: string }> {
  const MAX_RETRIES = 5;
  const RETRY_DELAY_MS = 2000;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const tx = await connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed'
      });
      
      if (!tx || !tx.meta) {
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          continue;
        }
        return { valid: false, amount: 0, sender: '' };
      }
      
      const accountKeys = tx.transaction.message.staticAccountKeys;
      const recipientIndex = accountKeys?.findIndex(
        key => key.toBase58() === expectedRecipient
      );
      
      if (recipientIndex === undefined || recipientIndex === -1) {
        return { valid: false, amount: 0, sender: '' };
      }
      
      const preBalance = tx.meta.preBalances[recipientIndex] || 0;
      const postBalance = tx.meta.postBalances[recipientIndex] || 0;
      const amount = (postBalance - preBalance) / LAMPORTS_PER_SOL;
      const sender = accountKeys?.[0]?.toBase58() || '';
      
      return { valid: amount > 0, amount, sender };
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
      return { valid: false, amount: 0, sender: '' };
    }
  }
  
  return { valid: false, amount: 0, sender: '' };
}

// Aggregate horse wallets → house wallet (with retries)
export async function aggregateFunds(
  horsePrivateKeys: string[],
  houseWallet: string
): Promise<number> {
  let totalCollected = 0;
  const MIN_BALANCE_LAMPORTS = 900000;
  const MAX_RETRIES = 2;
  
  for (const privateKey of horsePrivateKeys) {
    let retries = 0;
    
    while (retries < MAX_RETRIES) {
      try {
        const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
        const balance = await connection.getBalance(keypair.publicKey);
        const sendAmount = balance - MIN_BALANCE_LAMPORTS;
        
        if (sendAmount > 10000) {
          const { blockhash } = await connection.getLatestBlockhash('confirmed');
          
          const transaction = new Transaction();
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = keypair.publicKey;
          
          transaction.add(
            SystemProgram.transfer({
              fromPubkey: keypair.publicKey,
              toPubkey: new PublicKey(houseWallet),
              lamports: sendAmount,
            })
          );
          
          await sendAndConfirmTransaction(connection, transaction, [keypair]);
          totalCollected += sendAmount / LAMPORTS_PER_SOL;
        }
        break; // Success, exit retry loop
        
      } catch (error) {
        retries++;
        if (retries >= MAX_RETRIES) {
          console.error('Aggregate failed after retries:', error);
        } else {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
  }
  
  return totalCollected;
}

// ============================================================
// PARALLEL AGGREGATE - Faster collection from horse wallets
// ============================================================
export async function batchAggregateFunds(
  horsePrivateKeys: string[],
  houseWallet: string,
  concurrency: number = 3
): Promise<{ collected: number; failed: number }> {
  const MIN_BALANCE_LAMPORTS = 900000;
  let totalCollected = 0;
  let failedCount = 0;

  // Process sequentially in small groups to avoid rate limits
  for (let i = 0; i < horsePrivateKeys.length; i += concurrency) {
    const batch = horsePrivateKeys.slice(i, i + concurrency);
    
    const results = await Promise.allSettled(
      batch.map(async (privateKey) => {
        const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
        const balance = await connection.getBalance(keypair.publicKey);
        const sendAmount = balance - MIN_BALANCE_LAMPORTS;
        
        if (sendAmount <= 10000) return 0;
        
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        
        const transaction = new Transaction();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = keypair.publicKey;
        
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: new PublicKey(houseWallet),
            lamports: sendAmount,
          })
        );
        
        await sendAndConfirmTransaction(connection, transaction, [keypair]);
        return sendAmount / LAMPORTS_PER_SOL;
      })
    );
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        totalCollected += result.value;
      } else {
        failedCount++;
        console.error('Aggregate batch failed:', result.reason);
      }
    }
    
    // Small delay between groups
    if (i + concurrency < horsePrivateKeys.length) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log(`[Aggregate] ${totalCollected.toFixed(4)} SOL, ${failedCount} failed`);
  return { collected: totalCollected, failed: failedCount };
}