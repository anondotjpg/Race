// app/layout.tsx
import type { Metadata } from "next";
import { Geist_Mono, VT323 } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "./context/WalletContext";

// MONO-FIRST TERMINAL STACK
const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const vt323 = VT323({
  variable: "--font-vt323",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Derby",
  description: "On-chain horse racing terminal. Bet SOL. Live odds. Instant settlement.",
  keywords: [
    "solana",
    "horse racing",
    "betting",
    "crypto",
    "on-chain",
    "web3",
  ],
  openGraph: {
    title: "Degen Derby",
    description: "On-chain horse racing terminal",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`
          ${geistMono.variable}
          ${vt323.variable}
          bg-black text-[#1aff00]
          font-mono uppercase tracking-tight
          antialiased
          overflow-x-hidden
        `}
      >
        {/* GLOBAL CRT OVERLAY */}
        <div
          className="
            pointer-events-none fixed inset-0 z-[999]
            opacity-[0.08]
            bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.35)_50%)]
            bg-[length:100%_4px]
          "
        />

        {/* SUBTLE PHOSPHOR GLOW */}
        <div
          className="
            pointer-events-none fixed inset-0 z-[998]
            shadow-[inset_0_0_120px_rgba(26,255,0,0.06)]
          "
        />

        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}