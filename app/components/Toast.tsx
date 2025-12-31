'use client';

import { useEffect } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error';
  onClose: () => void;
  duration?: number;
}

export function Toast({
  message,
  type = 'success',
  onClose,
  duration = 4000,
}: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration]);

  const isError = type === 'error';

  return (
    <div
      className="
        fixed bottom-6 right-6 z-[80]
        bg-[#c0c0c0] p-1
        border-2 border-t-[#dfdfdf] border-l-[#dfdfdf]
        border-b-[#404040] border-r-[#404040]
        font-mono uppercase tracking-tight
        animate-[toast-in_0.25s_steps(4)_forwards]
      "
    >
      <div
        className={`
          relative bg-black px-4 py-3
          border-2 border-t-[#404040] border-l-[#404040]
          border-b-[#dfdfdf] border-r-[#dfdfdf]
          ${isError ? 'text-red-400' : 'text-[#1aff00]'}
        `}
      >
        {/* CRT scanlines */}
        <div
          className="
            absolute inset-0 pointer-events-none opacity-10
            bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)]
            bg-[length:100%_2px]
          "
        />

        <div className="relative z-10 flex items-start gap-2">
          <span className="font-black">
            {isError ? '⚠' : '✓'}
          </span>
          <span className="text-xs leading-snug">
            {message}
          </span>
        </div>
      </div>

      <style jsx>{`
        @keyframes toast-in {
          from {
            transform: translateY(10px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}