// hooks/useWallet.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

interface PhantomProvider {
  isPhantom: boolean;
  publicKey: PublicKey | null;
  connect: () => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  signAndSendTransaction: (transaction: Transaction) => Promise<{ signature: string }>;
  on: (event: string, callback: (args: any) => void) => void;
  off: (event: string, callback: (args: any) => void) => void;
}

declare global {
  interface Window {
    solana?: PhantomProvider;
  }
}

export function useWallet() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [provider, setProvider] = useState<PhantomProvider | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if Phantom is installed
  useEffect(() => {
    if (typeof window !== 'undefined' && window.solana?.isPhantom) {
      setProvider(window.solana);
      
      // Check if already connected
      if (window.solana.publicKey) {
        setWallet(window.solana.publicKey.toBase58());
      }
    }
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (!provider) return;

    const handleAccountChange = (publicKey: PublicKey | null) => {
      if (publicKey) {
        setWallet(publicKey.toBase58());
      } else {
        setWallet(null);
      }
    };

    provider.on('accountChanged', handleAccountChange);
    return () => {
      provider.off('accountChanged', handleAccountChange);
    };
  }, [provider]);

  const connect = useCallback(async () => {
    if (!provider) {
      window.open('https://phantom.app/', '_blank');
      return;
    }

    try {
      setConnecting(true);
      setError(null);
      const response = await provider.connect();
      setWallet(response.publicKey.toBase58());
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setConnecting(false);
    }
  }, [provider]);

  const disconnect = useCallback(async () => {
    if (!provider) return;
    
    try {
      await provider.disconnect();
      setWallet(null);
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect');
    }
  }, [provider]);

  const sendBet = useCallback(async (
    recipientAddress: string,
    amountSol: number
  ): Promise<string | null> => {
    if (!provider || !wallet) {
      setError('Wallet not connected');
      return null;
    }

    try {
      setError(null);
      
      // Create transaction
      const { Connection, clusterApiUrl } = await import('@solana/web3.js');
      const connection = new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl('mainnet-beta'),
        'confirmed'
      );
      
      const fromPubkey = new PublicKey(wallet);
      const toPubkey = new PublicKey(recipientAddress);
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: Math.floor(amountSol * LAMPORTS_PER_SOL),
        })
      );
      
      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;
      
      // Sign and send
      const { signature } = await provider.signAndSendTransaction(transaction);
      
      return signature;
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
      return null;
    }
  }, [provider, wallet]);

  return {
    wallet,
    connected: !!wallet,
    connecting,
    error,
    hasProvider: !!provider,
    connect,
    disconnect,
    sendBet
  };
}