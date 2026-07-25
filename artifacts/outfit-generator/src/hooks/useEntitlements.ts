/**
 * useEntitlements — centralised entitlement state backed by RevenueCat.
 *
 * Single source of truth: `_currentTier` (module-level, shared across all
 * hook instances via useSyncExternalStore).
 *
 * Persistence: localStorage key `mdc_tier` is a fast-read cache written on
 * every tier change.  RevenueCat is always the authoritative source.
 *
 * UNLOCK RULE: if Purchases.purchasePackage() returns without throwing,
 * the App Store completed the transaction → grant access immediately.
 * Do NOT gate unlock on the entitlement appearing in customerInfo — that
 * can lag by several seconds and caused Apple review rejections.
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

// ── External store (shared across all hook instances) ─────────────────────────

const STORAGE_KEY         = 'mdc_tier';
const STORAGE_PRODUCT_KEY = 'mdc_active_product';

function readStoredTier(): Tier {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'unlock' || v === 'premium') return v;
  } catch { /* private browsing */ }
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

/**
 * Update the global tier in-memory, notify all React subscribers, and
 * persist to localStorage.  Call this from anywhere — it is not a hook.
 */
export function setGlobalTier(t: Tier, product?: PurchaseProduct): void {
  if (_currentTier === t && !product) return; // skip no-op unless product changes
  try {
    localStorage.setItem(STORAGE_KEY, t);
    if (product) localStorage.setItem(STORAGE_PRODUCT_KEY, product);
  } catch {}
  _currentTier = t;
  _subscribers.forEach((fn) => fn());
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export type PurchaseResult = 'success' | 'cancelled' | 'unavailable';

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

  /**
   * Initiate an in-app purchase.
   *
   * KEY CONTRACT: if purchasePackage() returns without throwing, the App Store
   * completed the transaction.  We unlock IMMEDIATELY — we do not wait for the
   * RevenueCat entitlement to propagate (that can take seconds and caused the
   * "remained locked" rejection from Apple review).
   */
  const purchase = useCallback(
    async (product: PurchaseProduct): Promise<PurchaseResult> => {
      try {
        const pkg = await getPackageForProduct(product);
        if (!pkg) {
          console.error('[RevenueCat] Package not found for product:', product,
            '— check that it is added to the "default" offering in the RevenueCat dashboard');
          return 'unavailable';
        }
        console.log('[RevenueCat] Purchasing package:', pkg.identifier, pkg.packageType);

        // purchasePackage throws on user-cancel or failure.
        // If it returns → purchase is confirmed by the App Store → unlock now.
        await Purchases.purchasePackage({ aPackage: pkg });

        const newTier: Tier = PRODUCT_TIER_MAP[product] ?? PRODUCT_TIER[product] ?? 'unlock';
        setGlobalTier(newTier, product);

        // Background: confirm entitlement with RevenueCat (non-blocking).
        // The CustomerInfoUpdateListener in App.tsx will catch any async update.
        Purchases.getCustomerInfo().catch(() => {});

        return 'success';
      } catch (err: any) {
        if (err?.code === 'PURCHASE_CANCELLED' || err?.userCancelled === true) {
          return 'cancelled';
        }
        console.error('[RevenueCat] Purchase error:', err);
        return 'unavailable';
      }
    },
    [],
  );

  /**
   * Restore previous purchases.
   * Calls restorePurchases() which refreshes CustomerInfo from the App Store,
   * then checks the entitlement.  Falls back to a second getCustomerInfo if
   * the first response is stale.
   */
  const restore = useCallback(async (): Promise<PurchaseResult> => {
    try {
      const { customerInfo } = await Purchases.restorePurchases();
      if (ENTITLEMENT_ID in (customerInfo.entitlements?.active ?? {})) {
        setGlobalTier('unlock');
        return 'success';
      }
      // One retry in case RestorePurchases response was cached
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
