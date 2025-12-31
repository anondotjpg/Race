'use client';

import { useWallet } from "../context/WalletContext";

export function WalletConnect() {
  const {
    wallet,
    connected,
    connecting,
    hasProvider,
    connect,
    disconnect,
  } = useWallet();

  // NO PROVIDER (GET PHANTOM)
  if (!hasProvider) {
    return (
      <button
        onClick={() => window.open('https://phantom.app/', '_blank')}
        className="
          flex items-center gap-2 px-4 py-2
          bg-black border-4 border-[#555]
          font-mono uppercase text-[#1aff00]
          hover:bg-[#050505]
        "
      >
        <svg className="w-4 h-4 text-[#1aff00]" viewBox="0 0 40 40" fill="currentColor">
          <path d="M34.8 19.6h-3.5c0-7.1-5.8-12.9-13-12.9-7 0-12.8 5.5-13 12.5-.2 7.2 6.4 13.2 13.2 13.2h1.2c6.4 0 15.1-6.3 15.1-12.8z"/>
        </svg>
        GET PHANTOM
      </button>
    );
  }

  // CONNECTED
  if (connected && wallet) {
    return (
      <div
        className="
          flex items-center gap-2
          bg-black border-4 border-[#555]
          px-3 py-2
          font-mono uppercase
        "
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-[#1aff00] animate-pulse" />
          <span className="text-[#1aff00] text-sm">
            {wallet.slice(0, 4)}...{wallet.slice(-4)}
          </span>
        </div>

        <button
          onClick={disconnect}
          className="
            ml-2 px-2 py-1
            border-2 border-red-500
            text-red-500
            hover:bg-red-500 hover:text-black
          "
          title="Disconnect"
        >
          X
        </button>
      </div>
    );
  }

  // CONNECT BUTTON
  return (
    <button
      onClick={connect}
      disabled={connecting}
      className="
        flex items-center gap-2 px-4 py-2
        bg-black border-4 border-yellow-400
        text-yellow-400 font-mono uppercase
        hover:bg-yellow-400 hover:text-black
        disabled:opacity-50 disabled:cursor-not-allowed
      "
    >
      {connecting ? (
        <>
          <span className="animate-pulse">CONNECTING</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" viewBox="0 0 40 40" fill="currentColor">
            <path d="M34.8 19.6h-3.5c0-7.1-5.8-12.9-13-12.9-7 0-12.8 5.5-13 12.5-.2 7.2 6.4 13.2 13.2 13.2h1.2c6.4 0 15.1-6.3 15.1-12.8z"/>
          </svg>
          CONNECT
        </>
      )}
    </button>
  );
}