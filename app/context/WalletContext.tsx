// context/WalletContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, Connection, clusterApiUrl } from '@solana/web3.js';

interface WalletContextType {
  wallet: string | null;
  connected: boolean;
  connecting: boolean;
  hasProvider: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendBet: (recipientAddress: string, amountSol: number) => Promise<string | null>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [hasProvider, setHasProvider] = useState(false);

  // Get Phantom provider
  const getPhantom = () => {
    if (typeof window === 'undefined') return null;
    const win = window as any;
    return win.phantom?.solana || win.solana || null;
  };

  // Check connection status
  const checkConnection = () => {
    const phantom = getPhantom();
    if (phantom?.isPhantom) {
      setHasProvider(true);
      if (phantom.isConnected && phantom.publicKey) {
        setWallet(phantom.publicKey.toBase58());
      } else {
        setWallet(null);
      }
    }
  };

  // Initialize and set up listeners
  useEffect(() => {
    const phantom = getPhantom();
    
    if (!phantom?.isPhantom) {
      // Retry a few times
      const t1 = setTimeout(checkConnection, 100);
      const t2 = setTimeout(checkConnection, 500);
      const t3 = setTimeout(checkConnection, 1000);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }

    setHasProvider(true);
    
    // Check if already connected
    if (phantom.isConnected && phantom.publicKey) {
      setWallet(phantom.publicKey.toBase58());
    }

    // Event handlers
    const onConnect = () => {
      const p = getPhantom();
      if (p?.publicKey) setWallet(p.publicKey.toBase58());
    };
    
    const onDisconnect = () => setWallet(null);
    
    const onAccountChange = (pk: any) => {
      if (pk) setWallet(pk.toBase58());
      else setWallet(null);
    };

    phantom.on('connect', onConnect);
    phantom.on('disconnect', onDisconnect);
    phantom.on('accountChanged', onAccountChange);

    // Poll connection status every second (backup)
    const interval = setInterval(checkConnection, 1000);

    return () => {
      phantom.off('connect', onConnect);
      phantom.off('disconnect', onDisconnect);
      phantom.off('accountChanged', onAccountChange);
      clearInterval(interval);
    };
  }, []);

  const connect = async () => {
    const phantom = getPhantom();
    if (!phantom) {
      window.open('https://phantom.app/', '_blank');
      return;
    }

    try {
      setConnecting(true);
      const resp = await phantom.connect();
      setWallet(resp.publicKey.toBase58());
    } catch (e) {
      console.error('Connect failed:', e);
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    const phantom = getPhantom();
    if (phantom) {
      try {
        await phantom.disconnect();
      } catch (e) {
        console.error('Disconnect failed:', e);
      }
    }
    setWallet(null);
  };

  const sendBet = async (recipientAddress: string, amountSol: number): Promise<string | null> => {
    const phantom = getPhantom();
    
    // Re-check wallet status
    if (!phantom?.isConnected || !phantom?.publicKey) {
      return null;
    }
    
    const currentWallet = phantom.publicKey.toBase58();

    try {
      // Use Helius or fallback RPCs
      const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC 
        || 'https://api.mainnet-beta.solana.com';
      
      const connection = new Connection(rpcUrl, 'confirmed');
      
      const fromPubkey = new PublicKey(currentWallet);
      const toPubkey = new PublicKey(recipientAddress);
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: Math.floor(amountSol * LAMPORTS_PER_SOL),
        })
      );
      
      // Get blockhash with retry
      let blockhash;
      try {
        const result = await connection.getLatestBlockhash('confirmed');
        blockhash = result.blockhash;
      } catch (e) {
        // Fallback: try without specifying commitment
        const result = await connection.getLatestBlockhash();
        blockhash = result.blockhash;
      }
      
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;
      
      const { signature } = await phantom.signAndSendTransaction(transaction);
      return signature;
    } catch (e: any) {
      console.error('Transaction failed:', e);
      // Return more specific error info
      if (e.message?.includes('User rejected')) {
        return null; // User cancelled
      }
      throw e; // Re-throw for other errors
    }
  };

  return (
    <WalletContext.Provider value={{
      wallet,
      connected: !!wallet,
      connecting,
      hasProvider,
      connect,
      disconnect,
      sendBet,
    }}>
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