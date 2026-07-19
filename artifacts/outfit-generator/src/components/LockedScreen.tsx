/**
 * LockedScreen — full-screen overlay shown when biometric lock is active.
 * Matches the app's plum / gold brand palette.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import type { BiometricResult } from '@/lib/biometric';

interface Props {
  onAuthenticate: () => Promise<BiometricResult>;
}

export function LockedScreen({ onAuthenticate }: Props) {
  const [status, setStatus] = useState<'idle' | 'pending' | 'failed'>('idle');

  const handleTryAgain = async () => {
    if (status === 'pending') return;
    setStatus('pending');
    const result = await onAuthenticate();
    if (result === 'success') {
      // parent unmounts us
      return;
    }
    setStatus(result === 'cancelled' ? 'idle' : 'failed');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
      style={{
        background:
          'linear-gradient(160deg, #3d0f18 0%, #1a0508 60%, #130306 100%)',
      }}
    >
      {/* Plaid-style decorative strip at top */}
      <div
        className="absolute top-0 left-0 right-0 h-1.5"
        style={{ background: '#d4af37' }}
      />

      {/* Lock icon area */}
      <div className="flex flex-col items-center gap-6 px-8 text-center">
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center border-2"
          style={{
            background:
              'linear-gradient(135deg, #7D1528 0%, #5C0F1E 100%)',
            borderColor: '#d4af37',
            boxShadow: '0 0 0 4px rgba(212,175,55,0.15), 4px 4px 0 rgba(0,0,0,0.5)',
          }}
        >
          <span className="text-5xl leading-none select-none">💎</span>
        </div>

        <div>
          <h1
            className="font-black uppercase text-white tracking-tight"
            style={{ fontSize: 28, letterSpacing: '-0.01em' }}
          >
            App Locked
          </h1>
          <p className="mt-1.5 text-sm font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Authenticate to continue
          </p>
        </div>

        {/* Error state */}
        {status === 'failed' && (
          <p
            className="text-xs font-bold px-4 py-2 rounded-xl"
            style={{ background: 'rgba(220,38,38,0.2)', color: '#fca5a5' }}
          >
            Authentication failed. Please try again.
          </p>
        )}

        {/* Try Again button */}
        <button
          onClick={handleTryAgain}
          disabled={status === 'pending'}
          className="px-10 py-4 rounded-2xl font-black uppercase text-sm tracking-wide
                     text-black transition-all active:translate-y-0.5 active:shadow-none
                     disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background:
              status === 'pending'
                ? '#5C0F1E'
                : 'linear-gradient(to bottom, #d4af37, #b8962e)',
            border: '2.5px solid rgba(255,255,255,0.25)',
            boxShadow:
              status === 'pending' ? 'none' : '3px 3px 0 rgba(0,0,0,0.5)',
            color: status === 'pending' ? 'rgba(255,255,255,0.7)' : '#1a0508',
          }}
        >
          {status === 'pending' ? 'Authenticating…' : 'Try Again'}
        </button>
      </div>

      {/* Gold strip at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1.5"
        style={{ background: '#d4af37' }}
      />
    </motion.div>
  );
}
