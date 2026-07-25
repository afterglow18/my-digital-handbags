/**
 * RevenueCat client — wraps @revenuecat/purchases-capacitor.
 *
 * Entitlement ID : "My Digital Handbags Pro"
 * Offering ID    : "default"  (offerings.current)
 * Products       : monthly.unlock | yearly.unlock | lifetime.unlock
 */
import { Purchases } from "@revenuecat/purchases-capacitor";
import type { PurchasesPackage, PurchasesOfferings } from "@revenuecat/purchases-capacitor";
import type { PurchaseProduct, Tier } from "@/types/local";

const TEST_KEY = import.meta.env.VITE_REVENUECAT_TEST_API_KEY as string;
const IOS_KEY  = import.meta.env.VITE_REVENUECAT_IOS_API_KEY  as string;

// ─── Entitlement identifier — must match RevenueCat dashboard exactly ─────────
export const ENTITLEMENT_ID = "My Digital Handbags Pro";

// ─── Package identifiers (RevenueCat default $rc_* names) ────────────────────
const PACKAGE_ID: Record<PurchaseProduct, string> = {
  monthly:  "$rc_monthly",
  yearly:   "$rc_annual",
  lifetime: "$rc_lifetime",
  premium:  "$rc_lifetime",
};

// ─── Package type enum values returned by the SDK (NOT "$rc_*") ───────────────
const PACKAGE_TYPE: Record<PurchaseProduct, string> = {
  monthly:  "MONTHLY",
  yearly:   "ANNUAL",
  lifetime: "LIFETIME",
  premium:  "LIFETIME",
};

// ─── Which tier each product unlocks ─────────────────────────────────────────
export const PRODUCT_TIER_MAP: Record<PurchaseProduct, Tier> = {
  monthly:  "unlock",
  yearly:   "unlock",
  lifetime: "unlock",
  premium:  "premium",
};

// ─── SDK initialisation ───────────────────────────────────────────────────────
let _initialised = false;
let _configurePromise: Promise<void> | null = null;

/** True only when running inside a real Capacitor native shell (iOS/Android). */
export function isNativePlatform(): boolean {
  return !!(window as any).Capacitor?.isNativePlatform?.();
}

/**
 * Initialise RevenueCat and return a promise that resolves when the SDK is
 * configured.  Safe to call multiple times — subsequent calls are no-ops.
 * On web (browser preview) the SDK is skipped entirely; the plugin does not
 * support web and would throw, triggering Vite's error overlay.
 */
export function initRevenueCat(): Promise<void> {
  if (_initialised && _configurePromise) return _configurePromise;
  _initialised = true;

  // RevenueCat Capacitor plugin is native-only. On web it throws
  // "Web not supported in this plugin." — skip it entirely.
  if (!isNativePlatform()) {
    console.log("[RevenueCat] Skipping — web environment");
    _configurePromise = Promise.resolve();
    return _configurePromise;
  }

  const apiKey = IOS_KEY ?? TEST_KEY;
  if (!apiKey) {
    console.warn("[RevenueCat] No API key — purchases disabled");
    _configurePromise = Promise.resolve();
    return _configurePromise;
  }

  _configurePromise = Purchases.configure({ apiKey })
    .then(() => console.log("[RevenueCat] Configured ✓"))
    .catch((e: unknown) => console.error("[RevenueCat] Configure error:", e));

  return _configurePromise;
}

// ─── Customer-info listener ───────────────────────────────────────────────────

/**
 * Register a callback that fires whenever RevenueCat pushes a CustomerInfo
 * update (e.g. after a purchase, restore, or subscription renewal).
 * Returns an unsubscribe function.
 *
 * Call this AFTER initRevenueCat() resolves.
 */
export function addCustomerInfoListener(
  onUpdate: (hasEntitlement: boolean) => void,
): () => void {
  if (!isNativePlatform()) return () => {};
  try {
    const listenerHandle = Purchases.addCustomerInfoUpdateListener((info) => {
      const active = ENTITLEMENT_ID in (info.entitlements?.active ?? {});
      onUpdate(active);
    });
    return () => {
      try { (listenerHandle as any)?.remove?.(); } catch { /* ignore */ }
    };
  } catch (e) {
    console.warn("[RevenueCat] addCustomerInfoUpdateListener failed:", e);
    return () => {};
  }
}

// ─── Package lookup ───────────────────────────────────────────────────────────

/**
 * Find the RevenueCat package for a given product.
 * Strategy: identifier match first ($rc_*), then packageType enum fallback.
 */
export async function getPackageForProduct(
  product: PurchaseProduct,
): Promise<PurchasesPackage | null> {
  const pkgId   = PACKAGE_ID[product];
  const pkgType = PACKAGE_TYPE[product];

  const offerings: PurchasesOfferings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current || current.availablePackages.length === 0) return null;

  return (
    current.availablePackages.find((p: PurchasesPackage) => p.identifier === pkgId) ??
    current.availablePackages.find((p: PurchasesPackage) => p.packageType === pkgType) ??
    null
  );
}

// ─── Startup sync ─────────────────────────────────────────────────────────────

/**
 * Fetch CustomerInfo once on cold launch and return whether the entitlement
 * is active.  Resolves false on any network error (local cache stands).
 */
export async function syncEntitlementOnStartup(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return ENTITLEMENT_ID in (customerInfo.entitlements?.active ?? {});
  } catch {
    return false;
  }
}
