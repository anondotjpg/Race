// context/WalletContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef, useSyncExternalStore } from 'react';
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

// Global wallet store (outside React)
let walletAddress: string | null = null;
let phantomProvider: PhantomProvider | null = null;
const listeners = new Set<() => void>();

function getWallet() {
  return walletAddress;
}

function getProvider() {
  return phantomProvider;
}

function setWallet(addr: string | null) {
  walletAddress = addr;
  listeners.forEach(l => l());
}

function setProvider(p: PhantomProvider | null) {
  phantomProvider = p;
  listeners.forEach(l => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
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
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Use external store for wallet - ensures all components see same value
  const wallet = useSyncExternalStore(subscribe, getWallet, () => null);
  const provider = useSyncExternalStore(subscribe, getProvider, () => null);

  // Detect Phantom provider on mount
  useEffect(() => {
    const detectProvider = () => {
      const win = window as any;
      const phantom = win.phantom?.solana || win.solana;
      
      if (phantom?.isPhantom) {
        setProvider(phantom);
        
        // Check if already connected
        if (phantom.isConnected && phantom.publicKey) {
          setWallet(phantom.publicKey.toBase58());
        }
        
        // Listen for events
        phantom.on('connect', () => {
          if (phantom.publicKey) {
            setWallet(phantom.publicKey.toBase58());
          }
        });
        
        phantom.on('disconnect', () => {
          setWallet(null);
        });
        
        phantom.on('accountChanged', (pk: PublicKey | null) => {
          setWallet(pk ? pk.toBase58() : null);
        });
        
        return true;
      }
      return false;
    };

    if (!detectProvider()) {
      // Retry after delays
      setTimeout(detectProvider, 300);
      setTimeout(detectProvider, 1000);
    }
  }, []);

  const connect = useCallback(async () => {
    const p = getProvider();
    if (!p) {
      window.open('https://phantom.app/', '_blank');
      return;
    }

    try {
      setConnecting(true);
      setError(null);
      const response = await p.connect();
      setWallet(response.publicKey.toBase58());
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const p = getProvider();
    if (!p) return;
    try {
      await p.disconnect();
      setWallet(null);
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect');
    }
  }, []);

  const sendBet = useCallback(async (
    recipientAddress: string,
    amountSol: number
  ): Promise<string | null> => {
    const p = getProvider();
    const w = getWallet();
    
    if (!p) {
      setError('Phantom not detected');
      return null;
    }
    
    if (!w) {
      setError('Wallet not connected');
      return null;
    }

    try {
      setError(null);
      
      const connection = new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl('mainnet-beta'),
        'confirmed'
      );
      
      const fromPubkey = new PublicKey(w);
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
      
      const { signature } = await p.signAndSendTransaction(transaction);
      
      return signature;
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
      return null;
    }
  }, []);

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