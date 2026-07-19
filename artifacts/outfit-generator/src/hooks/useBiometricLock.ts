/**
 * useBiometricLock
 *
 * Manages the biometric app-lock feature:
 *  - persists the on/off setting in localStorage
 *  - locks the app on launch (if enabled) and whenever it returns from background
 *  - exposes enable / disable / authenticate helpers used by Settings and the lock screen
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  authenticateBiometric,
  checkBiometricAvailable,
  type BiometricResult,
} from '@/lib/biometric';

const STORAGE_KEY = 'biometric_lock_enabled';

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeEnabled(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  } catch {}
}

export function useBiometricLock() {
  const [enabled, setEnabled] = useState<boolean>(readEnabled);
  // isLocked = true means the screen is covered and auth is required
  const [isLocked, setIsLocked] = useState<boolean>(readEnabled);
  const needsAuthOnResume = useRef(false);

  // ── Lock on visibility hidden, require auth on resume ─────────────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App going to background — show lock immediately to hide content
        if (readEnabled()) {
          setIsLocked(true);
          needsAuthOnResume.current = true;
        }
      } else {
        // App returning to foreground
        if (needsAuthOnResume.current && readEnabled()) {
          needsAuthOnResume.current = false;
          // isLocked already true — LockedScreen is already visible
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // ── Public: try to authenticate (called by LockedScreen "Try Again") ───────
  const authenticate = useCallback(
    async (reason = 'Unlock My Handbags'): Promise<BiometricResult> => {
      const result = await authenticateBiometric(reason);
      if (result === 'success') {
        setIsLocked(false);
      }
      return result;
    },
    [],
  );

  // ── Public: enable the lock (auth first, then enable) ─────────────────────
  const enableLock = useCallback(async (): Promise<BiometricResult> => {
    const available = await checkBiometricAvailable();
    // In web dev mode, checkBiometricAvailable returns false — allow anyway
    if (!available && !!(window as any).Capacitor?.isNativePlatform?.()) {
      return 'unavailable';
    }
    const result = await authenticateBiometric(
      'Authenticate to enable app lock',
    );
    if (result === 'success') {
      writeEnabled(true);
      setEnabled(true);
    }
    return result;
  }, []);

  // ── Public: disable the lock (auth first, then disable) ───────────────────
  const disableLock = useCallback(async (): Promise<BiometricResult> => {
    const result = await authenticateBiometric(
      'Authenticate to disable app lock',
    );
    if (result === 'success') {
      writeEnabled(false);
      setEnabled(false);
      setIsLocked(false);
    }
    return result;
  }, []);

  return { enabled, isLocked, authenticate, enableLock, disableLock };
}
