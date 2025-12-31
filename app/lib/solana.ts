// lib/solana.ts
import { 
  Connection, 
  PublicKey, 
  LAMPORTS_PER_SOL,
  Keypair,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction
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
    console.log('🔵 Fetching from https://pumpportal.fun/api/create-wallet');
    const response = await fetch('https://pumpportal.fun/api/create-wallet', {
      method: 'GET',
    });
    
    console.log('🔵 Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`PumpPortal API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('🔵 PumpPortal raw response:', JSON.stringify(data, null, 2));
    
    // PumpPortal returns: walletPublicKey, privateKey, apiKey
    const publicKey = data.walletPublicKey;
    const privateKey = data.privateKey;
    const apiKey = data.apiKey;
    
    console.log('🔵 Extracted publicKey:', publicKey);
    console.log('🔵 Extracted privateKey:', privateKey ? `${privateKey.slice(0, 10)}...` : 'MISSING');
    console.log('🔵 Extracted apiKey:', apiKey ? `${apiKey.slice(0, 10)}...` : 'MISSING');
    
    if (!publicKey || !privateKey) {
      console.log('🔴 Missing keys! publicKey:', !!publicKey, 'privateKey:', !!privateKey);
      throw new Error('Missing keys in PumpPortal response');
    }
    
    console.log('🟢 PumpPortal wallet created successfully:', publicKey);
    
    return { publicKey, privateKey, apiKey };
  } catch (error) {
    console.error('🔴 PumpPortal failed:', error);
    console.log('🟡 Falling back to local wallet generation...');
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toBase58();
    console.log('🟢 Local wallet generated:', publicKey);
    return {
      publicKey,
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
      // Get recent transactions to find the deposit
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
            // Get sender from transaction
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

// Send SOL payout to winner
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

// Verify a transaction exists and get amount (with retries)
export async function verifyTransaction(
  signature: string,
  expectedRecipient: string
): Promise<{ valid: boolean; amount: number; sender: string }> {
  const MAX_RETRIES = 5;
  const RETRY_DELAY_MS = 2000; // 2 seconds between retries
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[verifyTransaction] Attempt ${attempt}/${MAX_RETRIES} for ${signature.slice(0, 20)}...`);
      
      const tx = await connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed'
      });
      
      if (!tx || !tx.meta) {
        console.log(`[verifyTransaction] Transaction not found yet, attempt ${attempt}`);
        
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
        console.log(`[verifyTransaction] Recipient not found in transaction`);
        return { valid: false, amount: 0, sender: '' };
      }
      
      const preBalance = tx.meta.preBalances[recipientIndex] || 0;
      const postBalance = tx.meta.postBalances[recipientIndex] || 0;
      const amount = (postBalance - preBalance) / LAMPORTS_PER_SOL;
      const sender = accountKeys?.[0]?.toBase58() || '';
      
      console.log(`[verifyTransaction] Success! Amount: ${amount} SOL, Sender: ${sender.slice(0, 10)}...`);
      
      return { valid: amount > 0, amount, sender };
    } catch (error) {
      console.error(`[verifyTransaction] Error on attempt ${attempt}:`, error);
      
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
      
      return { valid: false, amount: 0, sender: '' };
    }
  }
  
  return { valid: false, amount: 0, sender: '' };
}

// Aggregate all horse wallets into house wallet for payouts
export async function aggregateFunds(
  horsePrivateKeys: string[],
  houseWallet: string
): Promise<number> {
  let totalCollected = 0;
  
  // Minimum balance to keep account rent-exempt (~0.00089 SOL) + tx fee
  const MIN_BALANCE_LAMPORTS = 900000; // ~0.0009 SOL
  
  for (const privateKey of horsePrivateKeys) {
    try {
      const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
      const balance = await connection.getBalance(keypair.publicKey);
      
      // Only send if we have more than minimum + some buffer
      const sendAmount = balance - MIN_BALANCE_LAMPORTS;
      
      if (sendAmount > 10000) { // Only send if > 0.00001 SOL profit
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: new PublicKey(houseWallet),
            lamports: sendAmount,
          })
        );
        
        await sendAndConfirmTransaction(connection, transaction, [keypair]);
        totalCollected += sendAmount / LAMPORTS_PER_SOL;
        console.log(`Aggregated ${sendAmount / LAMPORTS_PER_SOL} SOL from ${keypair.publicKey.toBase58()}`);
      }
    } catch (error) {
      console.error('Failed to aggregate from wallet:', error);
    }
  }
  
  return totalCollected;
}