// components/WalletConnect.tsx
'use client';

import { useWallet } from '../hooks/useWallet';

export function WalletConnect() {
  const { wallet, connected, connecting, hasProvider, connect, disconnect } = useWallet();

  if (!hasProvider) {
    return (
      <button
        onClick={() => window.open('https://phantom.app/', '_blank')}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-500 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-purple-500/20"
      >
        <svg className="w-4 h-4" viewBox="0 0 40 40" fill="currentColor">
          <path d="M34.8 19.6h-3.5c0-7.1-5.8-12.9-13-12.9-7 0-12.8 5.5-13 12.5-.2 7.2 6.4 13.2 13.2 13.2h1.2c6.4 0 15.1-6.3 15.1-12.8z"/>
        </svg>
        Get Phantom
      </button>
    );
  }

  if (connected && wallet) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-xl">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm text-gray-600 font-mono">
            {wallet.slice(0, 4)}...{wallet.slice(-4)}
          </span>
        </div>
        <button
          onClick={disconnect}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={connecting}
      className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {connecting ? (
        <>
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Connecting...</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" viewBox="0 0 40 40" fill="currentColor">
            <path d="M34.8 19.6h-3.5c0-7.1-5.8-12.9-13-12.9-7 0-12.8 5.5-13 12.5-.2 7.2 6.4 13.2 13.2 13.2h1.2c6.4 0 15.1-6.3 15.1-12.8z"/>
          </svg>
          <span>Connect</span>
        </>
      )}
    </button>
  );
}