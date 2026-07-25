/**
 * useEntitlements — entitlement hook backed by RevenueCat.
 *
 * Tier is persisted in localStorage as a fast-read cache and kept in sync
 * after every purchase / restore.  The authoritative source is RevenueCat.
 */

import { useCallback, useSyncExternalStore } from 'react';
import { Purchases } from '@revenuecat/purchases-capacitor';
import type { Tier, TierCapabilities, PurchaseProduct } from '@/types/local';
import { TIER_CAPS, PRODUCT_TIER } from '@/types/local';
import {
  ENTITLEMENT_ID,
  PRODUCT_TIER_MAP,
  getPackageForProduct,
} from '@/lib/revenuecat';

// ── Shared external store ─────────────────────────────────────────────────────

const STORAGE_KEY         = 'mdc_tier';
const STORAGE_PRODUCT_KEY = 'mdc_active_product';

function readStoredTier(): Tier {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'unlock' || v === 'premium') return v;
  } catch {
    // private browsing
  }
  return 'free';
}

export function readStoredProduct(): PurchaseProduct | null {
  try {
    const v = localStorage.getItem(STORAGE_PRODUCT_KEY);
    if (v === 'monthly' || v === 'yearly' || v === 'lifetime') return v as PurchaseProduct;
  } catch {}
  return null;
}

let _currentTier: Tier = readStoredTier();
const _subscribers = new Set<() => void>();

function subscribeTier(notify: () => void) {
  _subscribers.add(notify);
  return () => { _subscribers.delete(notify); };
}

function getTierSnapshot(): Tier {
  return _currentTier;
}

/** Promote the tier globally and persist. Called after a successful purchase. */
export function setGlobalTier(t: Tier, product?: PurchaseProduct): void {
  try {
    localStorage.setItem(STORAGE_KEY, t);
    if (product) localStorage.setItem(STORAGE_PRODUCT_KEY, product);
  } catch {}
  _currentTier = t;
  _subscribers.forEach((fn) => fn());
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type PurchaseResult = 'success' | 'cancelled' | 'unavailable';

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useEntitlements() {
  const tier = useSyncExternalStore(subscribeTier, getTierSnapshot);
  const caps: TierCapabilities = TIER_CAPS[tier];

  const canAddItem = useCallback(
    (currentCount: number) =>
      caps.maxItems === null || currentCount < caps.maxItems,
    [caps.maxItems],
  );

  const canSaveOutfit = useCallback(
    (currentCount: number) =>
      caps.maxOutfits === null || currentCount < caps.maxOutfits,
    [caps.maxOutfits],
  );

  const purchase = useCallback(
    async (product: PurchaseProduct): Promise<PurchaseResult> => {
      try {
        const pkg = await getPackageForProduct(product);
        if (!pkg) {
          console.warn('[RevenueCat] Package not found for product:', product);
          return 'unavailable';
        }

        const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
        const newTier: Tier = PRODUCT_TIER_MAP[product] ?? PRODUCT_TIER[product] ?? 'unlock';

        // Primary check: entitlement in the purchase response
        if (ENTITLEMENT_ID in (customerInfo.entitlements?.active ?? {})) {
          setGlobalTier(newTier, product);
          return 'success';
        }

        // Fallback: re-fetch CustomerInfo — RevenueCat may not have propagated
        // the entitlement into the purchasePackage response yet.
        try {
          const { customerInfo: fresh } = await Purchases.getCustomerInfo();
          if (ENTITLEMENT_ID in (fresh.entitlements?.active ?? {})) {
            setGlobalTier(newTier, product);
            return 'success';
          }
        } catch {
          // network issue — if App Store confirmed the purchase, grant access optimistically
          console.warn('[RevenueCat] Post-purchase getCustomerInfo failed; granting optimistically');
          setGlobalTier(newTier, product);
          return 'success';
        }

        return 'cancelled';
      } catch (err: any) {
        // userCancelled is thrown as an error by the SDK
        if (err?.code === 'PURCHASE_CANCELLED' || err?.userCancelled === true) {
          return 'cancelled';
        }
        console.error('[RevenueCat] Purchase error:', err);
        return 'unavailable';
      }
    },
    [],
  );

  const restore = useCallback(async (): Promise<PurchaseResult> => {
    try {
      // restorePurchases re-fetches CustomerInfo automatically
      const { customerInfo } = await Purchases.restorePurchases();
      if (ENTITLEMENT_ID in (customerInfo.entitlements?.active ?? {})) {
        setGlobalTier('unlock');
        return 'success';
      }
      // Secondary check in case the first response was stale
      const { customerInfo: fresh } = await Purchases.getCustomerInfo();
      if (ENTITLEMENT_ID in (fresh.entitlements?.active ?? {})) {
        setGlobalTier('unlock');
        return 'success';
      }
      return 'cancelled';
    } catch (err) {
      console.error('[RevenueCat] Restore error:', err);
      return 'unavailable';
    }
  }, []);

  return { tier, caps, canAddItem, canSaveOutfit, purchase, restore };
}
