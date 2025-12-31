// components/WalletConnect.tsx
'use client';

import { useWallet } from '../hooks/useWallet';

export function WalletConnect() {
  const { wallet, connected, connecting, error, hasProvider, connect, disconnect } = useWallet();

  if (!hasProvider) {
    return (
      <button
        onClick={() => window.open('https://phantom.app/', '_blank')}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 transition-colors font-bold"
      >
        <svg className="w-5 h-5" viewBox="0 0 128 128" fill="currentColor">
          <circle cx="64" cy="64" r="64" fill="#AB9FF2"/>
          <path d="M110.584 64.9142H99.142C99.142 41.7651 80.173 23 56.7724 23C33.6612 23 14.8716 41.3057 14.4118 64.0583C13.936 87.5106 35.5576 107 59.2202 107H63.3068C84.0829 107 110.584 86.4016 110.584 64.9142Z" fill="url(#paint0_linear)"/>
          <path d="M77.5765 67.3193C77.5765 71.8041 74.0064 75.4458 69.6112 75.4458C65.216 75.4458 61.6459 71.8041 61.6459 67.3193C61.6459 62.8346 65.216 59.1929 69.6112 59.1929C74.0064 59.1929 77.5765 62.8346 77.5765 67.3193Z" fill="white"/>
          <path d="M95.8426 67.3193C95.8426 71.8041 92.2725 75.4458 87.8773 75.4458C83.4821 75.4458 79.912 71.8041 79.912 67.3193C79.912 62.8346 83.4821 59.1929 87.8773 59.1929C92.2725 59.1929 95.8426 62.8346 95.8426 67.3193Z" fill="white"/>
          <defs>
            <linearGradient id="paint0_linear" x1="62.4982" y1="107" x2="62.4982" y2="23" gradientUnits="userSpaceOnUse">
              <stop stopColor="#534BB1"/>
              <stop offset="1" stopColor="#551BF9"/>
            </linearGradient>
          </defs>
        </svg>
        Install Phantom
      </button>
    );
  }

  if (connected && wallet) {
    return (
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-mono text-white/70">
            {wallet.slice(0, 4)}...{wallet.slice(-4)}
          </span>
        </div>
        <button
          onClick={disconnect}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-sm font-bold"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={connecting}
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all font-bold disabled:opacity-50"
    >
      {connecting ? (
        <>
          <span className="animate-spin">⟳</span>
          Connecting...
        </>
      ) : (
        <>
          <svg className="w-5 h-5" viewBox="0 0 128 128" fill="currentColor">
            <circle cx="64" cy="64" r="64" fill="#AB9FF2"/>
            <path d="M110.584 64.9142H99.142C99.142 41.7651 80.173 23 56.7724 23C33.6612 23 14.8716 41.3057 14.4118 64.0583C13.936 87.5106 35.5576 107 59.2202 107H63.3068C84.0829 107 110.584 86.4016 110.584 64.9142Z" fill="url(#paint0_linear_connect)"/>
            <defs>
              <linearGradient id="paint0_linear_connect" x1="62.4982" y1="107" x2="62.4982" y2="23" gradientUnits="userSpaceOnUse">
                <stop stopColor="#534BB1"/>
                <stop offset="1" stopColor="#551BF9"/>
              </linearGradient>
            </defs>
          </svg>
          Connect Wallet
        </>
      )}
    </button>
  );
}