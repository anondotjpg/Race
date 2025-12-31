'use client';

import { useWallet } from "../context/WalletContext";

export function WalletConnect() {
  const { wallet, connected, connecting, hasProvider, connect, disconnect } = useWallet();

  const baseStyle = `
    h-[40px] px-4 flex items-center justify-center font-mono text-[13px] font-bold uppercase
    border-2 border-t-[#dfdfdf] border-l-[#dfdfdf] border-b-[#404040] border-r-[#404040]
    bg-[#c0c0c0] text-black transition-all
  `;

  const sunkenStyle = `
    h-[40px] px-3 flex items-center gap-3 bg-black text-[#1aff00]
    border-2 border-t-[#404040] border-l-[#404040] border-b-[#dfdfdf] border-r-[#dfdfdf]
  `;

  // 1. NO PROVIDER
  if (!hasProvider) {
    return (
      <button onClick={() => window.open('https://phantom.app/')} className={baseStyle}>
        Install Phantom
      </button>
    );
  }

  // 2. CONNECTING
  if (connecting) {
    return (
      <div className={sunkenStyle + " min-w-[160px]"}>
        <div className="flex gap-1 w-full">
          {[...Array(8)].map((_, i) => (
            <div 
              key={i} 
              className="h-3 w-full bg-[#1aff00] animate-pulse" 
              style={{ animationDelay: `${i * 0.1}s` }} 
            />
          ))}
        </div>
      </div>
    );
  }

  // 3. CONNECTED
  if (connected && wallet) {
    return (
      <div className="flex items-center gap-1">
        <div className={sunkenStyle}>
          <div className="w-2 h-2 bg-[#1aff00] shadow-[0_0_5px_#1aff00] animate-pulse" />
          <span>{wallet.slice(0, 4)}..{wallet.slice(-4)}</span>
        </div>
        <button 
          onClick={disconnect} 
          className={baseStyle + " px-3 active:border-t-[#404040] active:border-l-[#404040] active:border-b-[#dfdfdf] active:border-r-[#dfdfdf]"}
        >
          [X]
        </button>
      </div>
    );
  }

  // 4. DISCONNECTED
  return (
    <button 
      onClick={connect} 
      className={baseStyle + " min-w-[160px] active:border-t-[#404040] active:border-l-[#404040] active:border-b-[#dfdfdf] active:border-r-[#dfdfdf]"}
    >
      Connect
    </button>
  );
}