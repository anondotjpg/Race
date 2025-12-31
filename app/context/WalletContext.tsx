// context/WalletContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, Connection, clusterApiUrl } from '@solana/web3.js';

interface PhantomProvider {
  isPhantom: boolean;
  publicKey: PublicKey | null;
  isConnected: boolean;
  connect: () => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  signAndSendTransaction: (transaction: Transaction) => Promise<{ signature: string }>;
  on: (event: string, callback: (args: any) => void) => void;
  off: (event: string, callback: (args: any) => void) => void;
}

interface WalletContextType {
  wallet: string | null;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  hasProvider: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendBet: (recipientAddress: string, amountSol: number) => Promise<string | null>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<string | null>(null);
  const [provider, setProvider] = useState<PhantomProvider | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect Phantom provider
  useEffect(() => {
    const detectProvider = () => {
      const win = window as any;
      const phantom = win.phantom?.solana || win.solana;
      
      if (phantom?.isPhantom) {
        setProvider(phantom);
        
        if (phantom.isConnected && phantom.publicKey) {
          setWallet(phantom.publicKey.toBase58());
        }
        return true;
      }
      return false;
    };

    if (detectProvider()) return;

    // Wait for Phantom to load
    const timeout = setTimeout(detectProvider, 500);
    const timeout2 = setTimeout(detectProvider, 1000);
    
    return () => {
      clearTimeout(timeout);
      clearTimeout(timeout2);
    };
  }, []);

  // Listen for wallet events
  useEffect(() => {
    if (!provider) return;

    const handleConnect = () => {
      if (provider.publicKey) {
        setWallet(provider.publicKey.toBase58());
      }
    };

    const handleDisconnect = () => {
      setWallet(null);
    };

    const handleAccountChange = (publicKey: PublicKey | null) => {
      if (publicKey) {
        setWallet(publicKey.toBase58());
      } else {
        setWallet(null);
      }
    };

    provider.on('connect', handleConnect);
    provider.on('disconnect', handleDisconnect);
    provider.on('accountChanged', handleAccountChange);

    return () => {
      provider.off('connect', handleConnect);
      provider.off('disconnect', handleDisconnect);
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
      setError(err.message || 'Failed to connect');
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
    if (!provider) {
      setError('Phantom not detected');
      return null;
    }
    
    if (!wallet) {
      setError('Wallet not connected');
      return null;
    }

    try {
      setError(null);
      
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
      
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;
      
      const { signature } = await provider.signAndSendTransaction(transaction);
      
      return signature;
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
      return null;
    }
  }, [provider, wallet]);

  const value: WalletContextType = {
    wallet,
    connected: !!wallet,
    connecting,
    error,
    hasProvider: !!provider,
    connect,
    disconnect,
    sendBet,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}