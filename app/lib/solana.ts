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
  console.log('🔵 Starting PumpPortal wallet creation...');
  
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
// BATCH PAYOUTS - Send up to 20 payouts in single transaction
// ============================================================
export async function sendBatchPayouts(
  fromPrivateKey: string,
  payouts: Array<{ wallet: string; amount: number }>
): Promise<{ success: boolean; signature?: string; failed: number[] }> {
  const MAX_TRANSFERS_PER_TX = 20; // Solana limit
  
  if (payouts.length === 0) {
    return { success: true, failed: [] };
  }

  const fromKeypair = Keypair.fromSecretKey(bs58.decode(fromPrivateKey));
  const failedIndices: number[] = [];
  let lastSignature: string | undefined;

  // Split into batches of 20
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
    
    try {
      const transaction = new Transaction();
      
      // Priority fee for faster confirmation
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 })
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
        { commitment: 'confirmed' }
      );

      lastSignature = signature;
      console.log(`[Batch ${batchIdx + 1}/${batches.length}] ✓ ${batch.length} payouts`);
      
    } catch (error) {
      console.error(`[Batch ${batchIdx + 1}] ✗ Failed:`, error);
      batch.forEach(p => failedIndices.push(p.index));
    }
  }

  return {
    success: failedIndices.length === 0,
    signature: lastSignature,
    failed: failedIndices
  };
}

// ============================================================
// PARALLEL BATCH PAYOUTS - For 100+ payouts with concurrency
// ============================================================
export async function sendParallelPayouts(
  fromPrivateKey: string,
  payouts: Array<{ wallet: string; amount: number }>,
  concurrency: number = 3
): Promise<{ successful: number; failed: number; signatures: string[] }> {
  const MAX_TRANSFERS_PER_TX = 20;
  const fromKeypair = Keypair.fromSecretKey(bs58.decode(fromPrivateKey));
  
  // Split into batches of 20
  const batches: Array<Array<{ wallet: string; amount: number }>> = [];
  for (let i = 0; i < payouts.length; i += MAX_TRANSFERS_PER_TX) {
    batches.push(payouts.slice(i, i + MAX_TRANSFERS_PER_TX));
  }

  console.log(`[Parallel] ${payouts.length} payouts → ${batches.length} batches @ ${concurrency} concurrent`);

  const signatures: string[] = [];
  let successful = 0;
  let failed = 0;

  // Process with concurrency limit
  for (let i = 0; i < batches.length; i += concurrency) {
    const chunk = batches.slice(i, i + concurrency);
    
    const results = await Promise.allSettled(
      chunk.map(async (batch) => {
        const transaction = new Transaction();
        
        transaction.add(
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 })
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

        return sendAndConfirmTransaction(
          connection,
          transaction,
          [fromKeypair],
          { commitment: 'confirmed' }
        );
      })
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const batchSize = chunk[j].length;
      
      if (result.status === 'fulfilled') {
        signatures.push(result.value);
        successful += batchSize;
      } else {
        failed += batchSize;
        console.error(`[Parallel] Batch failed:`, result.reason);
      }
    }
  }

  console.log(`[Parallel] Done: ${successful} ok, ${failed} failed`);
  return { successful, failed, signatures };
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

// Aggregate horse wallets → house wallet (sequential)
export async function aggregateFunds(
  horsePrivateKeys: string[],
  houseWallet: string
): Promise<number> {
  let totalCollected = 0;
  const MIN_BALANCE_LAMPORTS = 900000; // Keep for rent
  
  for (const privateKey of horsePrivateKeys) {
    try {
      const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
      const balance = await connection.getBalance(keypair.publicKey);
      const sendAmount = balance - MIN_BALANCE_LAMPORTS;
      
      if (sendAmount > 10000) {
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: new PublicKey(houseWallet),
            lamports: sendAmount,
          })
        );
        
        await sendAndConfirmTransaction(connection, transaction, [keypair]);
        totalCollected += sendAmount / LAMPORTS_PER_SOL;
      }
    } catch (error) {
      console.error('Aggregate failed:', error);
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
  concurrency: number = 5
): Promise<{ collected: number; failed: number }> {
  const MIN_BALANCE_LAMPORTS = 900000;
  let totalCollected = 0;
  let failedCount = 0;

  for (let i = 0; i < horsePrivateKeys.length; i += concurrency) {
    const batch = horsePrivateKeys.slice(i, i + concurrency);
    
    const results = await Promise.allSettled(
      batch.map(async (privateKey) => {
        const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
        const balance = await connection.getBalance(keypair.publicKey);
        const sendAmount = balance - MIN_BALANCE_LAMPORTS;
        
        if (sendAmount <= 10000) return 0;
        
        const transaction = new Transaction().add(
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
      }
    }
  }

  console.log(`[Aggregate] ${totalCollected.toFixed(4)} SOL collected, ${failedCount} failed`);
  return { collected: totalCollected, failed: failedCount };
}